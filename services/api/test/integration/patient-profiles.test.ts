import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { writeAuditLog } from '../../src/core/audit';
import { runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { captureConsent } from '../../src/modules/privacy-consent/privacy-consent.service';
import { PgPatientProfilesRepo } from '../../src/modules/patient-profiles/patient-profiles.repo';
import { createProfileSchema } from '../../src/modules/patient-profiles/patient-profiles.schema';
import { PatientProfilesService, assertCanBookForProfile } from '../../src/modules/patient-profiles/patient-profiles.service';
import { createTestPool, createTestUser, findOrCreateAdmin } from './helpers';

/**
 * patient-profiles trên PostgreSQL 16 thật: SQL của repo, consent của BE-3, eKYC + audit,
 * và guard đặt lịch (US-HP-06 AC-01..03, TC-KYC-01).
 * File upload/kiểm tra file được giả lập (đã có test riêng ở nurse-onboarding).
 * (User test không bị xóa: audit_logs tham chiếu tới họ.)
 */
describe('patient-profiles (integration)', () => {
  let pool: Pool;
  let adminId: string;
  let service: PatientProfilesService;

  const body = (over: Record<string, unknown> = {}) =>
    createProfileSchema.parse({
      fullName: 'Lê Văn D',
      dob: '1950-02-03',
      gender: 'MALE',
      weightKg: 81.5,
      mobilityStatus: 'BEDRIDDEN',
      medicalHistory: 'Đái tháo đường type 2',
      addressText: '1 Lê Lợi, Q1',
      locationType: 'HOME',
      lat: 10.7731,
      lng: 106.7031,
      dataConsentAccepted: true,
      ...over,
    });
  const ctx = { ip: '203.0.113.9', deviceId: 'web-test' };
  const cccd = () => `0${Math.floor(Math.random() * 1e11).toString().padStart(11, '0')}`;
  const identity = (userId: string) => ({
    cccdFrontKey: `kyc-cccd/${userId}/front.jpg`,
    cccdBackKey: `kyc-cccd/${userId}/back.jpg`,
    portraitKey: `kyc-selfie/${userId}/selfie.jpg`,
  });

  async function rejectsWith(p: Promise<unknown>, status: number, code: string) {
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect([(err as AppError).status, (err as AppError).code]).toEqual([status, code]);
  }

  beforeAll(async () => {
    pool = createTestPool();
    adminId = await findOrCreateAdmin(pool);
    service = new PatientProfilesService({
      repo: new PgPatientProfilesRepo(pool),
      withTx: (fn) => runInTransaction(pool, (client) => fn(new PgPatientProfilesRepo(client), client)),
      uploads: { requestUploadUrls: async () => [], verifyUploadedFile: async () => undefined },
      downloadUrl: async (key) => `https://signed.test/${key}`,
      captureConsent: (input) => captureConsent(input),
      writeAudit: writeAuditLog,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates a profile with consent columns stored, lists it without medical history', async () => {
    const customer = await createTestUser(pool);
    const view = await service.createProfile(customer, body(), ctx);
    expect(view).toMatchObject({ fullName: 'Lê Văn D', dob: '1950-02-03', weightKg: 81.5, lat: 10.7731, consent: { accepted: true } });

    const { rows } = await pool.query(
      'SELECT data_consent_accepted, consent_timestamp, consent_ip, consent_device_id FROM patient_profiles WHERE id = $1',
      [view.id],
    );
    expect(rows[0]).toMatchObject({ data_consent_accepted: true, consent_ip: '203.0.113.9', consent_device_id: 'web-test' });
    expect(rows[0].consent_timestamp).toBeInstanceOf(Date);

    const list = await service.listProfiles(customer);
    expect(list.map((p) => p.id)).toEqual([view.id]);
    expect(list[0]).not.toHaveProperty('medicalHistory');
  });

  it('without consent nothing is written (400 CONSENT_REQUIRED)', async () => {
    const customer = await createTestUser(pool);
    await rejectsWith(service.createProfile(customer, body({ dataConsentAccepted: false }), ctx), 400, 'CONSENT_REQUIRED');
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM patient_profiles WHERE customer_id = $1', [customer]);
    expect(rows[0].n).toBe(0);
  });

  it('PATCH updates only whitelisted columns; other customers get 403', async () => {
    const owner = await createTestUser(pool);
    const intruder = await createTestUser(pool);
    const view = await service.createProfile(owner, body(), ctx);

    const updated = await service.updateProfile(owner, view.id, { weightKg: 64, mobilityStatus: 'PARTIAL', medicalHistory: null });
    expect(updated).toMatchObject({ weightKg: 64, mobilityStatus: 'PARTIAL', medicalHistory: null, fullName: 'Lê Văn D' });
    await rejectsWith(service.updateProfile(intruder, view.id, { weightKg: 50 }), 403, 'FORBIDDEN');
    await rejectsWith(service.getProfile(intruder, view.id), 403, 'FORBIDDEN');
  });

  it('eKYC: submit → PENDING, admin approve → VERIFIED with audit; booking gate follows (TC-KYC-01)', async () => {
    const customer = await createTestUser(pool);
    const home = await service.createProfile(customer, body(), ctx);
    const hospital = await service.createProfile(customer, body({ locationType: 'HOSPITAL' }), ctx);

    // Before eKYC: HOME blocked, HOSPITAL allowed.
    await rejectsWith(assertCanBookForProfile(pool, customer, home.id), 403, 'EKYC_REQUIRED');
    await expect(assertCanBookForProfile(pool, customer, hospital.id)).resolves.toMatchObject({ locationType: 'HOSPITAL' });

    const number = cccd();
    await expect(service.submitEkyc(customer, { cccdNumber: number, identity: identity(customer) })).resolves.toMatchObject({
      kycStatus: 'PENDING',
    });
    // PENDING is still not enough for home care.
    await rejectsWith(assertCanBookForProfile(pool, customer, home.id), 403, 'EKYC_REQUIRED');

    const queue = await service.listEkycQueue(100, 0);
    expect(queue.some((q) => q.customerId === customer)).toBe(true);

    await service.reviewEkyc(adminId, customer, { decision: 'APPROVED' }, '198.51.100.2');
    await expect(assertCanBookForProfile(pool, customer, home.id)).resolves.toMatchObject({
      patientProfileId: home.id,
      locationType: 'HOME',
      weightKg: 81.5,
      mobilityStatus: 'BEDRIDDEN',
    });

    const audit = await pool.query(
      "SELECT actor_id, old_value, new_value FROM audit_logs WHERE action_type = 'REVIEW_CUSTOMER_KYC' AND target_id = $1",
      [customer],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      actor_id: adminId,
      old_value: { kycStatus: 'PENDING' },
      new_value: { kycStatus: 'VERIFIED', decision: 'APPROVED' },
    });
  });

  it('eKYC: the same CCCD on a second account → 409 CCCD_ALREADY_REGISTERED', async () => {
    const a = await createTestUser(pool);
    const b = await createTestUser(pool);
    const number = cccd();
    await service.submitEkyc(a, { cccdNumber: number, identity: identity(a) });
    await rejectsWith(service.submitEkyc(b, { cccdNumber: number, identity: identity(b) }), 409, 'CCCD_ALREADY_REGISTERED');
  });

  it('booking guard: consent withdrawn → 403 CONSENT_REQUIRED; foreign profile → 403 FORBIDDEN', async () => {
    const customer = await createTestUser(pool);
    const other = await createTestUser(pool);
    const p = await service.createProfile(customer, body({ locationType: 'HOSPITAL' }), ctx);
    await rejectsWith(assertCanBookForProfile(pool, other, p.id), 403, 'FORBIDDEN');

    await pool.query('UPDATE patient_profiles SET data_consent_accepted = FALSE, consent_withdrawn_at = now() WHERE id = $1', [p.id]);
    await rejectsWith(assertCanBookForProfile(pool, customer, p.id), 403, 'CONSENT_REQUIRED');
    await rejectsWith(service.updateProfile(customer, p.id, { weightKg: 70 }), 403, 'CONSENT_REQUIRED');
  });
});
