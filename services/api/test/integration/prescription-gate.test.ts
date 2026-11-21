import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { UserRole } from '@healthcare-system/shared';
import { AppError } from '../../src/core/errors';
import * as storage from '../../src/core/storage';
import { assertRecordAccess } from '../../src/modules/privacy-consent/privacy-consent.service';
import { PrescriptionGateService } from '../../src/modules/prescription-gate/prescription-gate.service';
import { createTestPool, createTestUser, findOrCreateAdmin } from './helpers';

/**
 * prescription-gate on real PostgreSQL 16 (FR-BOOK-02 Layer 2): the SQL behind "who may open a
 * prescription" — bookings, booking_offers, nurse_profiles — plus BE-3's medical-record window
 * for the assigned nurse and the VIEW_MEDICAL_RECORD audit row. Storage is faked (no S3 needed).
 * (Test users are not deleted: audit_logs references them.)
 */
describe('prescription-gate — prescription access (integration)', () => {
  let pool: Pool;
  let service: PrescriptionGateService;
  let customerId: string;
  let adminId: string;
  let profileId: string;
  let invasiveServiceId: string;
  let slot = 0;
  // 2026-11-14 09:00 in Vietnam
  const NOW = Date.parse('2026-11-14T02:00:00Z');

  beforeAll(async () => {
    pool = createTestPool();
    customerId = await createTestUser(pool);
    adminId = await findOrCreateAdmin(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, location_type, data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Bệnh nhân test', 'HOME', TRUE, now()) RETURNING id`,
      [customerId],
    );
    profileId = p.rows[0].id;
    const s = await pool.query("SELECT id FROM service_categories WHERE is_invasive AND NOT is_prohibited ORDER BY code LIMIT 1");
    invasiveServiceId = s.rows[0].id;

    service = new PrescriptionGateService({
      storage: {
        buildObjectKey: storage.buildObjectKey,
        createUploadUrl: async (objectKey) => ({ url: `https://storage.test/put/${objectKey}`, objectKey, expiresInSeconds: 600 }),
        createDownloadUrl: async (objectKey) => ({ url: `https://storage.test/get/${objectKey}`, objectKey, expiresInSeconds: 600 }),
        statObject: async () => null,
        readObjectHead: async () => null,
      },
      db: pool,
      getNumber: async () => 7,
      assertAssignedNurseAccess: async (bookingId, nurseId) => {
        await assertRecordAccess(pool, { bookingId, nurseId }, { now: new Date(NOW), expiryHours: 12 });
      },
      maxUploadBytes: storage.MAX_UPLOAD_BYTES,
      now: () => NOW,
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createNurse(opts: { tier?: string; gphnExpiry?: string | null; status?: string } = {}): Promise<string> {
    const phone = `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng test', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const tier = opts.tier ?? 'TIER_2_SPECIALIST';
    const expiry = opts.gphnExpiry === undefined ? '2028-12-31' : opts.gphnExpiry;
    await pool.query(
      `INSERT INTO nurse_profiles (user_id, tier, gphn_number, gphn_expiry_date, profile_status)
       VALUES ($1, $2::nurse_tier_enum, $3, $4::date, $5::profile_status_enum)`,
      [rows[0].id, tier, expiry ? `GPHN-${randomUUID().slice(0, 6)}` : null, expiry, opts.status ?? 'ACTIVE'],
    );
    return rows[0].id;
  }

  /** A booking of the test customer; each call uses its own day so shifts never overlap. */
  async function createBooking(opts: { status?: string; nurseId?: string | null; withPrescription?: boolean } = {}): Promise<string> {
    slot += 1;
    const start = new Date(Date.UTC(2026, 11, slot, 2, 0, 0));
    const key = opts.withPrescription === false ? null : storage.buildObjectKey('prescription', customerId, 'image/jpeg');
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status, prescription_image_url, prescription_issued_date)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'BANK_TRANSFER', $6, $7, 300000, 300000, $8::execution_status_enum, $9, $10::date)
       RETURNING id`,
      [
        `P-${randomUUID().slice(0, 12)}`,
        customerId,
        profileId,
        opts.nurseId ?? null,
        invasiveServiceId,
        start,
        new Date(start.getTime() + 7_200_000),
        opts.status ?? 'MATCHING',
        key,
        key ? '2026-11-12' : null,
      ],
    );
    return rows[0].id;
  }

  async function offer(bookingId: string, nurseId: string, opts: { status?: string; expiresAt?: Date | null } = {}): Promise<void> {
    await pool.query(
      `INSERT INTO booking_offers (booking_id, nurse_id, offer_type, status, expires_at)
       VALUES ($1, $2, 'JOB_BOARD', $3::offer_status_enum, $4)`,
      [bookingId, nurseId, opts.status ?? 'SENT', opts.expiresAt === undefined ? new Date(NOW + 900_000) : opts.expiresAt],
    );
  }

  const audits = async (bookingId: string) =>
    (
      await pool.query(
        "SELECT actor_id, new_value, ip_address FROM audit_logs WHERE action_type = 'VIEW_MEDICAL_RECORD' AND target_id = $1 ORDER BY created_at",
        [bookingId],
      )
    ).rows;

  async function denied(p: Promise<unknown>, code: string, reason?: string): Promise<void> {
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe(code);
    if (reason) expect((err as AppError).details).toMatchObject({ reason });
  }

  const asNurse = (id: string) => ({ id, role: UserRole.NURSE, ip: '203.0.113.9' });

  it('a Tier 2 nurse with a live offer on a MATCHING booking gets a link, and the view is audited', async () => {
    const nurse = await createNurse();
    const booking = await createBooking();
    await offer(booking, nurse);

    const res = await service.getViewUrl(asNurse(nurse), booking);

    expect(res).toMatchObject({ basis: 'CANDIDATE_NURSE', expiresInSeconds: 600, issuedDate: '2026-11-12' });
    expect(res.url).toContain(`prescription/${customerId}/`);
    const rows = await audits(booking);
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBe(nurse);
    expect(rows[0].new_value).toEqual({ document: 'PRESCRIPTION', basis: 'CANDIDATE_NURSE' });
  });

  it('no offer, an answered offer or an expired offer → NOT_OFFERED', async () => {
    const booking = await createBooking();
    const noOffer = await createNurse();
    const declined = await createNurse();
    const expired = await createNurse();
    await offer(booking, declined, { status: 'DECLINED' });
    await offer(booking, expired, { expiresAt: new Date(NOW - 1000) });

    for (const nurse of [noOffer, declined, expired]) {
      await denied(service.getViewUrl(asNurse(nurse), booking), 'PRESCRIPTION_ACCESS_DENIED', 'NOT_OFFERED');
    }
    expect(await audits(booking)).toHaveLength(0);
  });

  it('an offer without an expiry time counts as live', async () => {
    const nurse = await createNurse();
    const booking = await createBooking();
    await offer(booking, nurse, { expiresAt: null });
    await expect(service.getViewUrl(asNurse(nurse), booking)).resolves.toMatchObject({ basis: 'CANDIDATE_NURSE' });
  });

  it('Tier 1, an expired or expiring-today GPHN, or a suspended profile → TIER_2_REQUIRED', async () => {
    const booking = await createBooking();
    const tier1 = await createNurse({ tier: 'TIER_1_BASIC', gphnExpiry: null });
    const expiredGphn = await createNurse({ gphnExpiry: '2026-11-13' });
    const expiresToday = await createNurse({ gphnExpiry: '2026-11-14' });
    const suspended = await createNurse({ status: 'SUSPENDED' });

    for (const nurse of [tier1, expiredGphn, expiresToday, suspended]) {
      await offer(booking, nurse);
      await denied(service.getViewUrl(asNurse(nurse), booking), 'PRESCRIPTION_ACCESS_DENIED', 'TIER_2_REQUIRED');
    }
  });

  it('once the booking is CONFIRMED: the assigned nurse may view, every other nurse may not', async () => {
    const assigned = await createNurse();
    const other = await createNurse();
    const booking = await createBooking({ status: 'CONFIRMED', nurseId: assigned });
    await offer(booking, other); // a stale offer must not help

    await expect(service.getViewUrl(asNurse(assigned), booking)).resolves.toMatchObject({ basis: 'ASSIGNED_NURSE' });
    await denied(service.getViewUrl(asNurse(other), booking), 'PRESCRIPTION_ACCESS_DENIED', 'BOOKING_NOT_OPEN');
  });

  it('the assigned nurse loses access when the booking is cancelled (medical-record window closed)', async () => {
    const assigned = await createNurse();
    const booking = await createBooking({ status: 'CANCELLED', nurseId: assigned });
    await denied(service.getViewUrl(asNurse(assigned), booking), 'RECORD_ACCESS_DENIED', 'WINDOW_CLOSED');
  });

  it('customer: own booking yes (not audited), someone else\'s booking looks like it does not exist', async () => {
    const booking = await createBooking();
    const stranger = await createTestUser(pool);

    await expect(service.getViewUrl({ id: customerId, role: UserRole.PATIENT }, booking)).resolves.toMatchObject({ basis: 'OWNER' });
    await denied(service.getViewUrl({ id: stranger, role: UserRole.PATIENT }, booking), 'BOOKING_NOT_FOUND');
    expect(await audits(booking)).toHaveLength(0);
  });

  it('Admin may view and is audited with the IP; a booking without a prescription is a 404', async () => {
    const booking = await createBooking();
    await expect(service.getViewUrl({ id: adminId, role: UserRole.ADMIN, ip: '198.51.100.7' }, booking)).resolves.toMatchObject({ basis: 'ADMIN' });
    const rows = await audits(booking);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: adminId, ip_address: '198.51.100.7' });

    const none = await createBooking({ withPrescription: false });
    await denied(service.getViewUrl({ id: adminId, role: UserRole.ADMIN }, none), 'PRESCRIPTION_NOT_FOUND');
    await denied(service.getViewUrl({ id: adminId, role: UserRole.ADMIN }, randomUUID()), 'BOOKING_NOT_FOUND');
  });
});
