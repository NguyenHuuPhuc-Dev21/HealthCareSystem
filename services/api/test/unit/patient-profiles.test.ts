import { describe, expect, it } from 'vitest';
import { AuditAction, KycStatus, LocationType, MobilityStatus, UserRole } from '@healthcare-system/shared';
import { AppError } from '../../src/core/errors';
import { captureConsent } from '../../src/modules/privacy-consent/privacy-consent.service';
import {
  checkEkycGate,
  dobProblem,
  ekycSubmissionBlocker,
  maskCccd,
  requiresCustomerEkyc,
} from '../../src/modules/patient-profiles/patient-profiles.policy';
import {
  createProfileSchema,
  reviewEkycSchema,
  submitEkycSchema,
  updateProfileSchema,
} from '../../src/modules/patient-profiles/patient-profiles.schema';
import {
  PatientProfilesService,
  assertCanBookForProfile,
  type PatientProfilesRepo,
} from '../../src/modules/patient-profiles/patient-profiles.service';
import type {
  CustomerIdentityRow,
  CustomerKycDocuments,
  PatientProfileRow,
  ProfileFields,
} from '../../src/modules/patient-profiles/patient-profiles.types';

/**
 * patient-profiles — FR-AUTH-03, US-HP-06 AC-01..03, RTM TC-KYC-01.
 * Pure policy + schema, then the service against an in-memory repo.
 */

const NOW = Date.parse('2026-11-05T03:00:00Z'); // 10:00 in Vietnam
const CUSTOMER = '11111111-1111-4111-8111-111111111111';
const OTHER_CUSTOMER = '22222222-2222-4222-8222-222222222222';
const ADMIN = '60000000-0000-4000-8000-000000000001';
const PROFILE = '33333333-3333-4333-8333-333333333333';
const keyOf = (category: string, n: number) => `${category}/${CUSTOMER}/file-${n}.jpg`;
const IDENTITY = { cccdFrontKey: keyOf('kyc-cccd', 1), cccdBackKey: keyOf('kyc-cccd', 2), portraitKey: keyOf('kyc-selfie', 3) };

function expectAppError(err: unknown, status: number, code: string) {
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  expect((err as AppError).code).toBe(code);
}

async function rejectsWith(p: Promise<unknown>, status: number, code: string) {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expectAppError(err, status, code);
}

// ---------------------------------------------------------------------------
describe('policy', () => {
  it('eKYC gate: HOME needs VERIFIED, HOSPITAL does not (FR-AUTH-03 §2, TC-KYC-01)', () => {
    expect(requiresCustomerEkyc(LocationType.HOME)).toBe(true);
    expect(requiresCustomerEkyc(LocationType.HOSPITAL)).toBe(false);
    expect(checkEkycGate(KycStatus.UNVERIFIED, LocationType.HOME)).toEqual({ allowed: false, code: 'EKYC_REQUIRED' });
    expect(checkEkycGate(KycStatus.PENDING, LocationType.HOME)).toEqual({ allowed: false, code: 'EKYC_REQUIRED' });
    expect(checkEkycGate(KycStatus.VERIFIED, LocationType.HOME)).toEqual({ allowed: true });
    expect(checkEkycGate(KycStatus.UNVERIFIED, LocationType.HOSPITAL)).toEqual({ allowed: true });
  });

  it('who may submit eKYC', () => {
    expect(ekycSubmissionBlocker(KycStatus.UNVERIFIED)).toBeNull();
    expect(ekycSubmissionBlocker(KycStatus.PENDING)).toBe('EKYC_ALREADY_SUBMITTED');
    expect(ekycSubmissionBlocker(KycStatus.VERIFIED)).toBe('EKYC_ALREADY_VERIFIED');
  });

  it('masks the CCCD number except the last 4 digits', () => {
    expect(maskCccd('079200001234')).toBe('********1234');
    expect(maskCccd(null)).toBeNull();
  });

  it('date of birth checks', () => {
    expect(dobProblem('2026-11-05', '2026-11-05')).toBeNull();
    expect(dobProblem('2026-11-06', '2026-11-05')).toBe('DOB_IN_FUTURE');
    expect(dobProblem('1899-12-31', '2026-11-05')).toBe('DOB_TOO_OLD');
    expect(dobProblem(null, '2026-11-05')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
const validProfileBody = {
  fullName: 'Trần Văn B',
  dob: '1948-05-02',
  gender: 'MALE',
  weightKg: 82.5,
  mobilityStatus: 'BEDRIDDEN',
  medicalHistory: 'Tăng huyết áp',
  isInfectious: false,
  addressText: '12 Nguyễn Huệ, Q1, TP.HCM',
  locationType: 'HOME',
  lat: 10.7769,
  lng: 106.7009,
  dataConsentAccepted: true,
};

describe('schema', () => {
  it('create: strict whitelist, defaults, coordinates required', () => {
    expect(createProfileSchema.safeParse(validProfileBody).success).toBe(true);
    expect(createProfileSchema.safeParse({ ...validProfileBody, customerId: OTHER_CUSTOMER }).success).toBe(false);
    const { lat: _lat, ...noLat } = validProfileBody;
    expect(createProfileSchema.safeParse(noLat).success).toBe(false);
    const minimal = createProfileSchema.parse({ fullName: 'A', addressText: 'x', locationType: 'HOSPITAL', lat: 1, lng: 1 });
    expect(minimal).toMatchObject({ mobilityStatus: 'NORMAL', isInfectious: false });
  });

  it('update: at least one field, no consent fields, lat/lng together', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.safeParse({ weightKg: 70 }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ dataConsentAccepted: true }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ lat: 10 }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ lat: 10, lng: 106 }).success).toBe(true);
  });

  it('eKYC submit and review', () => {
    expect(submitEkycSchema.safeParse({ cccdNumber: '079200001234', identity: IDENTITY }).success).toBe(true);
    expect(submitEkycSchema.safeParse({ cccdNumber: '0792', identity: IDENTITY }).success).toBe(false);
    expect(reviewEkycSchema.safeParse({ decision: 'APPROVED' }).success).toBe(true);
    expect(reviewEkycSchema.safeParse({ decision: 'REJECTED' }).success).toBe(false);
    expect(reviewEkycSchema.safeParse({ decision: 'REJECTED', rejectionReason: 'Ảnh CCCD bị mờ' }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// In-memory repo
// ---------------------------------------------------------------------------

class FakeRepo implements PatientProfilesRepo {
  customers = new Map<string, CustomerIdentityRow>();
  profiles = new Map<string, PatientProfileRow & { deleted_at: Date | null }>();
  usedCccd = new Set<string>();
  inserts = 0;

  async getCustomer(id: string) {
    return this.customers.get(id) ?? null;
  }
  async lockCustomer(id: string) {
    return this.customers.get(id) ?? null;
  }
  async saveEkycSubmission(id: string, cccd: string, docs: CustomerKycDocuments) {
    if (this.usedCccd.has(cccd)) throw Object.assign(new Error('duplicate key'), { code: '23505' });
    const c = this.customers.get(id)!;
    Object.assign(c, { cccd_number: cccd, kyc_documents: docs, kyc_status: KycStatus.PENDING });
  }
  async saveEkycDecision(id: string, status: KycStatus, docs: CustomerKycDocuments) {
    Object.assign(this.customers.get(id)!, { kyc_status: status, kyc_documents: docs });
  }
  async listEkycQueue() {
    return [];
  }
  async insertProfile(customerId: string, f: ProfileFields, consent: any) {
    this.inserts += 1;
    const row = {
      id: PROFILE,
      customer_id: customerId,
      full_name: f.fullName,
      dob: f.dob,
      gender: f.gender,
      weight_kg: f.weightKg === null ? null : String(f.weightKg),
      mobility_status: f.mobilityStatus,
      medical_history: f.medicalHistory,
      is_infectious: f.isInfectious,
      address_text: f.addressText,
      location_type: f.locationType,
      lat: String(f.lat),
      lng: String(f.lng),
      data_consent_accepted: consent.data_consent_accepted,
      consent_timestamp: consent.consent_timestamp,
      consent_withdrawn_at: null,
      created_at: new Date(NOW),
      deleted_at: null,
    };
    this.profiles.set(row.id, row);
    return row;
  }
  async listProfiles(customerId: string) {
    return [...this.profiles.values()].filter((p) => p.customer_id === customerId && !p.deleted_at);
  }
  async findOwnedProfile(customerId: string, profileId: string) {
    const p = this.profiles.get(profileId);
    return p && p.customer_id === customerId && !p.deleted_at ? p : null;
  }
  async lockOwnedProfile(customerId: string, profileId: string) {
    return this.findOwnedProfile(customerId, profileId);
  }
  async updateProfile(profileId: string, patch: Partial<ProfileFields>) {
    const p = this.profiles.get(profileId)!;
    if (patch.weightKg !== undefined) p.weight_kg = patch.weightKg === null ? null : String(patch.weightKg);
    if (patch.fullName !== undefined) p.full_name = patch.fullName;
    return p;
  }
}

function customer(overrides: Partial<CustomerIdentityRow> = {}): CustomerIdentityRow {
  return {
    id: CUSTOMER,
    role: UserRole.PATIENT,
    full_name: 'Nguyễn Thị A',
    phone: '0901234567',
    kyc_status: KycStatus.UNVERIFIED,
    cccd_number: null,
    kyc_documents: null,
    ...overrides,
  };
}

function setup() {
  const repo = new FakeRepo();
  repo.customers.set(CUSTOMER, customer());
  const audits: any[] = [];
  const verified: string[] = [];
  const service = new PatientProfilesService({
    repo,
    withTx: (fn) => fn(repo, { query: async () => ({ rows: [], rowCount: 0 }) } as any),
    uploads: {
      requestUploadUrls: async () => [],
      verifyUploadedFile: async (_u, purpose, key) => {
        verified.push(`${purpose}:${key}`);
      },
    },
    downloadUrl: async (key) => `https://signed.example/${key}`,
    captureConsent: (input) => captureConsent(input, () => new Date(NOW)),
    writeAudit: (async (_db: unknown, entry: unknown) => {
      audits.push(entry);
      return { id: 'a', createdAt: new Date(NOW) };
    }) as any,
    now: () => NOW,
  });
  return { repo, service, audits, verified };
}

const ctx = { ip: '203.0.113.7', deviceId: 'android-abc' };

describe('createProfile (US-HP-06 AC-02/03)', () => {
  it('saves the profile with the consent columns from privacy-consent (server time, IP, device)', async () => {
    const { repo, service } = setup();
    const view = await service.createProfile(CUSTOMER, createProfileSchema.parse(validProfileBody), ctx);
    expect(view).toMatchObject({
      fullName: 'Trần Văn B',
      weightKg: 82.5,
      mobilityStatus: MobilityStatus.BEDRIDDEN,
      locationType: LocationType.HOME,
      lat: 10.7769,
      consent: { accepted: true, acceptedAt: new Date(NOW).toISOString(), withdrawnAt: null },
    });
    expect(repo.inserts).toBe(1);
  });

  it.each([undefined, false, 'true', 1])('consent %s → 400 CONSENT_REQUIRED and nothing is written', async (accepted: unknown) => {
    const { repo, service } = setup();
    const body = createProfileSchema.parse({ ...validProfileBody, dataConsentAccepted: accepted });
    await rejectsWith(service.createProfile(CUSTOMER, body, ctx), 400, 'CONSENT_REQUIRED');
    expect(repo.inserts).toBe(0);
  });

  it('date of birth in the future → 400', async () => {
    const { service } = setup();
    const body = createProfileSchema.parse({ ...validProfileBody, dob: '2027-01-01' });
    await rejectsWith(service.createProfile(CUSTOMER, body, ctx), 400, 'DOB_IN_FUTURE');
  });

  it('a non-PATIENT account cannot create profiles', async () => {
    const { repo, service } = setup();
    repo.customers.set(CUSTOMER, customer({ role: UserRole.NURSE }));
    await rejectsWith(service.createProfile(CUSTOMER, createProfileSchema.parse(validProfileBody), ctx), 403, 'FORBIDDEN');
  });
});

describe('read / update profiles', () => {
  it('list hides medical history; owner read shows it', async () => {
    const { service } = setup();
    await service.createProfile(CUSTOMER, createProfileSchema.parse(validProfileBody), ctx);
    const [item] = await service.listProfiles(CUSTOMER);
    expect(item).not.toHaveProperty('medicalHistory');
    expect((await service.getProfile(CUSTOMER, PROFILE)).medicalHistory).toBe('Tăng huyết áp');
  });

  it('another customer gets 403 on read and update (no existence leak)', async () => {
    const { service } = setup();
    await service.createProfile(CUSTOMER, createProfileSchema.parse(validProfileBody), ctx);
    await rejectsWith(service.getProfile(OTHER_CUSTOMER, PROFILE), 403, 'FORBIDDEN');
    await rejectsWith(service.updateProfile(OTHER_CUSTOMER, PROFILE, { weightKg: 60 }), 403, 'FORBIDDEN');
  });

  it('update works while consent is active, refused with 403 CONSENT_REQUIRED after withdrawal', async () => {
    const { repo, service } = setup();
    await service.createProfile(CUSTOMER, createProfileSchema.parse(validProfileBody), ctx);
    expect((await service.updateProfile(CUSTOMER, PROFILE, { weightKg: 70 })).weightKg).toBe(70);

    repo.profiles.get(PROFILE)!.data_consent_accepted = false;
    await rejectsWith(service.updateProfile(CUSTOMER, PROFILE, { weightKg: 65 }), 403, 'CONSENT_REQUIRED');
  });
});

describe('customer eKYC', () => {
  it('submit: checks every file, moves to PENDING, returns a masked CCCD', async () => {
    const { repo, service, verified } = setup();
    const view = await service.submitEkyc(CUSTOMER, { cccdNumber: '079200001234', identity: IDENTITY });
    expect(verified).toEqual([`CCCD_FRONT:${IDENTITY.cccdFrontKey}`, `CCCD_BACK:${IDENTITY.cccdBackKey}`, `PORTRAIT:${IDENTITY.portraitKey}`]);
    expect(view).toMatchObject({ kycStatus: KycStatus.PENDING, cccdNumberMasked: '********1234', rejectionReason: null });
    expect(repo.customers.get(CUSTOMER)!.kyc_documents).toMatchObject({ ...IDENTITY, submittedAt: new Date(NOW).toISOString() });
  });

  it('submit: same file twice → 400 DUPLICATE_FILE', async () => {
    const { service } = setup();
    const identity = { ...IDENTITY, cccdBackKey: IDENTITY.cccdFrontKey };
    await rejectsWith(service.submitEkyc(CUSTOMER, { cccdNumber: '079200001234', identity }), 400, 'DUPLICATE_FILE');
  });

  it('submit: PENDING → 409, VERIFIED → 409', async () => {
    const { repo, service } = setup();
    repo.customers.set(CUSTOMER, customer({ kyc_status: KycStatus.PENDING }));
    await rejectsWith(service.submitEkyc(CUSTOMER, { cccdNumber: '079200001234', identity: IDENTITY }), 409, 'EKYC_ALREADY_SUBMITTED');
    repo.customers.set(CUSTOMER, customer({ kyc_status: KycStatus.VERIFIED }));
    await rejectsWith(service.submitEkyc(CUSTOMER, { cccdNumber: '079200001234', identity: IDENTITY }), 409, 'EKYC_ALREADY_VERIFIED');
  });

  it('submit: CCCD already used by another account → 409 CCCD_ALREADY_REGISTERED', async () => {
    const { repo, service } = setup();
    repo.usedCccd.add('079200001234');
    await rejectsWith(service.submitEkyc(CUSTOMER, { cccdNumber: '079200001234', identity: IDENTITY }), 409, 'CCCD_ALREADY_REGISTERED');
  });

  it('admin approves → VERIFIED, reviewer recorded, REVIEW_CUSTOMER_KYC audited without the CCCD number', async () => {
    const { repo, service, audits } = setup();
    await service.submitEkyc(CUSTOMER, { cccdNumber: '079200001234', identity: IDENTITY });
    const view = await service.reviewEkyc(ADMIN, CUSTOMER, { decision: 'APPROVED' }, '198.51.100.1');

    expect(view.kycStatus).toBe(KycStatus.VERIFIED);
    expect(repo.customers.get(CUSTOMER)!.kyc_documents).toMatchObject({ reviewedBy: ADMIN, decision: 'APPROVED' });
    expect(audits).toEqual([
      {
        actorId: ADMIN,
        action: AuditAction.REVIEW_CUSTOMER_KYC,
        targetTable: 'users',
        targetId: CUSTOMER,
        oldValue: { kycStatus: KycStatus.PENDING },
        newValue: { kycStatus: KycStatus.VERIFIED, decision: 'APPROVED', rejectionReason: null },
        ipAddress: '198.51.100.1',
      },
    ]);
    expect(JSON.stringify(audits)).not.toContain('079200001234');
  });

  it('admin rejects → back to UNVERIFIED with the reason; the customer may submit again', async () => {
    const { service } = setup();
    await service.submitEkyc(CUSTOMER, { cccdNumber: '079200001234', identity: IDENTITY });
    const view = await service.reviewEkyc(ADMIN, CUSTOMER, { decision: 'REJECTED', rejectionReason: 'Ảnh selfie không rõ mặt' }, null);
    expect(view).toMatchObject({ kycStatus: KycStatus.UNVERIFIED, rejectionReason: 'Ảnh selfie không rõ mặt' });
    await expect(service.submitEkyc(CUSTOMER, { cccdNumber: '079200001234', identity: IDENTITY })).resolves.toMatchObject({
      kycStatus: KycStatus.PENDING,
      rejectionReason: null,
    });
  });

  it('admin review of a non-pending account → 409 EKYC_NOT_PENDING', async () => {
    const { service } = setup();
    await rejectsWith(service.reviewEkyc(ADMIN, CUSTOMER, { decision: 'APPROVED' }, null), 409, 'EKYC_NOT_PENDING');
  });

  it('dossier returns 10-minute links, never raw keys', async () => {
    const { service } = setup();
    await service.submitEkyc(CUSTOMER, { cccdNumber: '079200001234', identity: IDENTITY });
    const d = await service.getEkycDossier(CUSTOMER);
    expect(d.identityFiles.cccdFrontUrl).toBe(`https://signed.example/${IDENTITY.cccdFrontKey}`);
    expect(d.linksExpireInSeconds).toBe(600);
  });
});

// ---------------------------------------------------------------------------
describe('assertCanBookForProfile (guard for bookings, Phase 3)', () => {
  /** Answers the two queries the guard runs: our profile lookup and BE-3's consent lookup. */
  function fakeDb(state: {
    customerId: string;
    locationType: LocationType;
    kyc: KycStatus;
    consent: boolean;
    deleted?: boolean;
  }) {
    return {
      async query(sql: string) {
        if (sql.includes('owner_kyc_status')) {
          return {
            rows: [
              {
                id: PROFILE,
                customer_id: state.customerId,
                location_type: state.locationType,
                weight_kg: '82.5',
                mobility_status: 'BEDRIDDEN',
                lat: '10.7769',
                lng: '106.7009',
                deleted_at: state.deleted ? new Date(NOW) : null,
                owner_kyc_status: state.kyc,
              },
            ],
            rowCount: 1,
          };
        }
        if (sql.includes('data_consent_accepted')) {
          return { rows: [{ id: PROFILE, data_consent_accepted: state.consent, deleted_at: state.deleted ? new Date(NOW) : null }], rowCount: 1 };
        }
        throw new Error(`unexpected SQL ${sql}`);
      },
    } as any;
  }

  it('TC-KYC-01: HOME care with unverified customer → 403 EKYC_REQUIRED', async () => {
    const db = fakeDb({ customerId: CUSTOMER, locationType: LocationType.HOME, kyc: KycStatus.UNVERIFIED, consent: true });
    await rejectsWith(assertCanBookForProfile(db, CUSTOMER, PROFILE), 403, 'EKYC_REQUIRED');
  });

  it('HOME care with VERIFIED customer → allowed, returns pricing facts', async () => {
    const db = fakeDb({ customerId: CUSTOMER, locationType: LocationType.HOME, kyc: KycStatus.VERIFIED, consent: true });
    await expect(assertCanBookForProfile(db, CUSTOMER, PROFILE)).resolves.toEqual({
      patientProfileId: PROFILE,
      locationType: LocationType.HOME,
      weightKg: 82.5,
      mobilityStatus: 'BEDRIDDEN',
      lat: 10.7769,
      lng: 106.7009,
    });
  });

  it('HOSPITAL care: phone + OTP is enough', async () => {
    const db = fakeDb({ customerId: CUSTOMER, locationType: LocationType.HOSPITAL, kyc: KycStatus.UNVERIFIED, consent: true });
    await expect(assertCanBookForProfile(db, CUSTOMER, PROFILE)).resolves.toMatchObject({ locationType: LocationType.HOSPITAL });
  });

  it('consent withdrawn → 403 CONSENT_REQUIRED (privacy-consent)', async () => {
    const db = fakeDb({ customerId: CUSTOMER, locationType: LocationType.HOSPITAL, kyc: KycStatus.VERIFIED, consent: false });
    await rejectsWith(assertCanBookForProfile(db, CUSTOMER, PROFILE), 403, 'CONSENT_REQUIRED');
  });

  it("someone else's or a deleted profile → 403 FORBIDDEN", async () => {
    const other = fakeDb({ customerId: OTHER_CUSTOMER, locationType: LocationType.HOME, kyc: KycStatus.VERIFIED, consent: true });
    await rejectsWith(assertCanBookForProfile(other, CUSTOMER, PROFILE), 403, 'FORBIDDEN');
    const deleted = fakeDb({ customerId: CUSTOMER, locationType: LocationType.HOME, kyc: KycStatus.VERIFIED, consent: true, deleted: true });
    await rejectsWith(assertCanBookForProfile(deleted, CUSTOMER, PROFILE), 403, 'FORBIDDEN');
  });
});
