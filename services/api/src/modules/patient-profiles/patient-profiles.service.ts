/**
 * patient-profiles — customer eKYC + care-recipient profiles (BE-2 · Phase 1).
 * Traceability: FR-AUTH-03 · FR-PRIV-01 §1 · BR-14 §2.1–2.2 · US-HP-06 AC-01..03 · RTM TC-KYC-01
 * Contract: docs/api/patient-profiles.api.md
 *
 *  - Customer eKYC: CCCD front/back + live portrait, uploaded straight to private storage with
 *    presigned PUTs (same pipeline and file checks as nurse onboarding, BE-1). Status
 *    UNVERIFIED → PENDING → VERIFIED; an Admin rejection sends it back to UNVERIFIED with a reason.
 *    Review method/vendor is still open (OD-10): MVP = manual Admin review.
 *  - Patient profiles: a profile cannot be saved without the Decree-13 consent tick — the consent
 *    columns come from BE-3's captureConsent (server timestamp, IP, device id).
 *  - Guards for bookings (Phase 3): assertCanBookForProfile = ownership + consent (BE-3) + the
 *    location-based eKYC gate (HOME needs VERIFIED, HOSPITAL does not).
 */
import { AuditAction, KycStatus, PRESIGNED_URL_MAX_EXPIRY_SECONDS, UserRole } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { withTransaction, type DbClient, type Queryable } from '../../core/database';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../core/errors';
import * as storage from '../../core/storage';
import { getNurseOnboardingService, todayInVietnam } from '../nurse-onboarding/nurse-onboarding.service';
import { assertConsentActive, captureConsent } from '../privacy-consent/privacy-consent.service';
import type { ConsentColumns, ConsentInput } from '../privacy-consent/privacy-consent.types';
import { checkEkycGate, dobProblem, ekycSubmissionBlocker, maskCccd } from './patient-profiles.policy';
import { PgPatientProfilesRepo } from './patient-profiles.repo';
import type {
  CreateProfileBody,
  EkycUploadUrlsBody,
  ReviewEkycBody,
  SubmitEkycBody,
  UpdateProfileBody,
} from './patient-profiles.schema';
import type {
  BookableProfile,
  CustomerIdentityRow,
  CustomerKycDocuments,
  EkycDossierView,
  EkycQueueItem,
  EkycStatusView,
  EkycUploadPurpose,
  PatientProfileRow,
  PatientProfileSummary,
  PatientProfileView,
  ProfileFields,
  UploadUrlView,
} from './patient-profiles.types';

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505';

export interface UploadPort {
  /** Presigned PUT per file; the server builds the object key from the user id. */
  requestUploadUrls(userId: string, body: EkycUploadUrlsBody): Promise<UploadUrlView[]>;
  /** Owner, purpose, exists, size, real type by magic bytes — throws 400 on failure. */
  verifyUploadedFile(userId: string, purpose: EkycUploadPurpose, key: string): Promise<void>;
}

/** The repo surface the service uses (PgPatientProfilesRepo satisfies it; tests pass a fake). */
export type PatientProfilesRepo = Pick<
  PgPatientProfilesRepo,
  | 'getCustomer'
  | 'lockCustomer'
  | 'saveEkycSubmission'
  | 'saveEkycDecision'
  | 'listEkycQueue'
  | 'insertProfile'
  | 'listProfiles'
  | 'findOwnedProfile'
  | 'lockOwnedProfile'
  | 'updateProfile'
>;

export interface PatientProfilesDeps {
  /** Read-only repo (pool). */
  repo: PatientProfilesRepo;
  /** Runs `fn` in one DB transaction with a repo bound to it, plus the raw client (for audit). */
  withTx<T>(fn: (repo: PatientProfilesRepo, client: Queryable) => Promise<T>): Promise<T>;
  uploads: UploadPort;
  /** Presigned GET for an object key (≤ 10 minutes). */
  downloadUrl(key: string): Promise<string>;
  /** BE-3 privacy-consent captureConsent (injected so tests control the clock). */
  captureConsent(input: ConsentInput): ConsentColumns;
  writeAudit: typeof writeAuditLog;
  now?: () => number;
}

// ---- mapping ------------------------------------------------------------------

const num = (v: string | number | null): number | null => (v === null || v === undefined ? null : Number(v));
const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);

export function toProfileView(r: PatientProfileRow): PatientProfileView {
  return {
    id: r.id,
    fullName: r.full_name,
    dob: r.dob,
    gender: r.gender,
    weightKg: num(r.weight_kg),
    mobilityStatus: r.mobility_status,
    medicalHistory: r.medical_history,
    isInfectious: r.is_infectious,
    addressText: r.address_text,
    locationType: r.location_type,
    lat: num(r.lat),
    lng: num(r.lng),
    consent: {
      accepted: r.data_consent_accepted,
      acceptedAt: iso(r.consent_timestamp),
      withdrawnAt: iso(r.consent_withdrawn_at),
    },
    createdAt: iso(r.created_at)!,
  };
}

export function toProfileSummary(r: PatientProfileRow): PatientProfileSummary {
  const { medicalHistory: _hidden, ...rest } = toProfileView(r);
  return rest;
}

function toEkycStatus(c: CustomerIdentityRow): EkycStatusView {
  const d = c.kyc_documents;
  return {
    kycStatus: c.kyc_status,
    cccdNumberMasked: maskCccd(c.cccd_number),
    submittedAt: d?.submittedAt ?? null,
    reviewedAt: d?.reviewedAt ?? null,
    rejectionReason: c.kyc_status === KycStatus.UNVERIFIED ? (d?.rejectionReason ?? null) : null,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}

// ---- service ------------------------------------------------------------------

export class PatientProfilesService {
  constructor(private readonly deps: PatientProfilesDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  // ===== Customer eKYC (customer side) =====

  /** POST /patient/ekyc/upload-urls */
  requestEkycUploadUrls(customerId: string, body: EkycUploadUrlsBody): Promise<UploadUrlView[]> {
    return this.deps.uploads.requestUploadUrls(customerId, body);
  }

  /** POST /patient/ekyc — files are checked first, then one transaction moves the account to PENDING. */
  async submitEkyc(customerId: string, body: SubmitEkycBody): Promise<EkycStatusView> {
    const files: [EkycUploadPurpose, string][] = [
      ['CCCD_FRONT', body.identity.cccdFrontKey],
      ['CCCD_BACK', body.identity.cccdBackKey],
      ['PORTRAIT', body.identity.portraitKey],
    ];
    if (new Set(files.map(([, k]) => k)).size !== files.length) {
      throw badRequest('DUPLICATE_FILE', 'Each document must be a different file');
    }
    for (const [purpose, key] of files) await this.deps.uploads.verifyUploadedFile(customerId, purpose, key);

    try {
      return await this.deps.withTx(async (repo) => {
        const customer = await repo.lockCustomer(customerId);
        if (!customer || customer.role !== UserRole.PATIENT) throw forbidden('FORBIDDEN', 'Customer account required');
        const blocker = ekycSubmissionBlocker(customer.kyc_status);
        if (blocker === 'EKYC_ALREADY_VERIFIED') throw conflict(blocker, 'eKYC is already verified');
        if (blocker === 'EKYC_ALREADY_SUBMITTED') throw conflict(blocker, 'Your eKYC is waiting for review');

        const docs: CustomerKycDocuments = {
          cccdFrontKey: body.identity.cccdFrontKey,
          cccdBackKey: body.identity.cccdBackKey,
          portraitKey: body.identity.portraitKey,
          submittedAt: new Date(this.nowMs()).toISOString(),
        };
        await repo.saveEkycSubmission(customerId, body.cccdNumber, docs);
        return toEkycStatus({ ...customer, kyc_status: KycStatus.PENDING, cccd_number: body.cccdNumber, kyc_documents: docs });
      });
    } catch (err) {
      // uq_users_cccd_number: one CCCD = one account.
      if (isUniqueViolation(err)) throw conflict('CCCD_ALREADY_REGISTERED', 'This CCCD number is already used by another account');
      throw err;
    }
  }

  /** GET /patient/ekyc */
  async getEkycStatus(customerId: string): Promise<EkycStatusView> {
    const c = await this.deps.repo.getCustomer(customerId);
    if (!c || c.role !== UserRole.PATIENT) throw forbidden('FORBIDDEN', 'Customer account required');
    return toEkycStatus(c);
  }

  // ===== Customer eKYC (Admin side) =====

  /** GET /admin/customers/ekyc-queue — oldest submission first. */
  listEkycQueue(limit: number, offset: number): Promise<EkycQueueItem[]> {
    return this.deps.repo.listEkycQueue(limit, offset);
  }

  /** GET /admin/customers/:id/ekyc — identity files as 10-minute links (NFR-SEC-01). */
  async getEkycDossier(customerId: string): Promise<EkycDossierView> {
    const c = await this.deps.repo.getCustomer(customerId);
    if (!c || c.role !== UserRole.PATIENT) throw notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
    const link = async (key?: string) => (key ? this.deps.downloadUrl(key) : null);
    return {
      customerId: c.id,
      fullName: c.full_name,
      phone: c.phone,
      kycStatus: c.kyc_status,
      cccdNumber: c.cccd_number,
      submittedAt: c.kyc_documents?.submittedAt ?? null,
      identityFiles: {
        cccdFrontUrl: await link(c.kyc_documents?.cccdFrontKey),
        cccdBackUrl: await link(c.kyc_documents?.cccdBackKey),
        portraitUrl: await link(c.kyc_documents?.portraitKey),
      },
      linksExpireInSeconds: PRESIGNED_URL_MAX_EXPIRY_SECONDS,
    };
  }

  /** PATCH /admin/customers/:id/ekyc — reviewed_by + time + reason recorded, REVIEW_CUSTOMER_KYC audited. */
  async reviewEkyc(adminId: string, customerId: string, body: ReviewEkycBody, ip: string | null): Promise<EkycStatusView> {
    return this.deps.withTx(async (repo, client) => {
      const c = await repo.lockCustomer(customerId);
      if (!c || c.role !== UserRole.PATIENT) throw notFound('CUSTOMER_NOT_FOUND', 'Customer not found');
      if (c.kyc_status !== KycStatus.PENDING || !c.kyc_documents) {
        throw conflict('EKYC_NOT_PENDING', `eKYC is ${c.kyc_status}, nothing to review`);
      }
      const previous = c.kyc_status;
      const approved = body.decision === 'APPROVED';
      const next = approved ? KycStatus.VERIFIED : KycStatus.UNVERIFIED;
      const docs: CustomerKycDocuments = {
        ...c.kyc_documents,
        reviewedBy: adminId,
        reviewedAt: new Date(this.nowMs()).toISOString(),
        decision: body.decision,
        rejectionReason: approved ? null : (body.rejectionReason ?? null),
      };
      await repo.saveEkycDecision(customerId, next, docs);
      await this.deps.writeAudit(client, {
        actorId: adminId,
        action: AuditAction.REVIEW_CUSTOMER_KYC,
        targetTable: 'users',
        targetId: customerId,
        oldValue: { kycStatus: previous },
        // No CCCD number or file keys in the audit row: the decision is what is audited.
        newValue: { kycStatus: next, decision: body.decision, rejectionReason: docs.rejectionReason },
        ...(ip ? { ipAddress: ip } : {}),
      });
      return toEkycStatus({ ...c, kyc_status: next, kyc_documents: docs });
    });
  }

  // ===== Patient profiles =====

  /** POST /patient-profiles — no consent, no profile (US-HP-06 AC-03, BR-14 §2.2). */
  async createProfile(
    customerId: string,
    body: CreateProfileBody,
    ctx: { ip: string | null; deviceId: string | null },
  ): Promise<PatientProfileView> {
    // First, before anything is written: BE-3 refuses anything but an explicit `true` (400 CONSENT_REQUIRED).
    const consent = this.deps.captureConsent({ accepted: body.dataConsentAccepted, ip: ctx.ip, deviceId: ctx.deviceId });
    this.checkDob(body.dob ?? null);

    const fields: ProfileFields = {
      fullName: body.fullName,
      dob: body.dob ?? null,
      gender: (body.gender ?? null) as ProfileFields['gender'],
      weightKg: body.weightKg ?? null,
      mobilityStatus: body.mobilityStatus as ProfileFields['mobilityStatus'],
      medicalHistory: body.medicalHistory ?? null,
      isInfectious: body.isInfectious,
      addressText: body.addressText,
      locationType: body.locationType as ProfileFields['locationType'],
      lat: body.lat,
      lng: body.lng,
    };
    const row = await this.deps.withTx(async (repo) => {
      const customer = await repo.lockCustomer(customerId);
      if (!customer || customer.role !== UserRole.PATIENT) throw forbidden('FORBIDDEN', 'Customer account required');
      return repo.insertProfile(customerId, fields, consent);
    });
    return toProfileView(row);
  }

  /** GET /patient-profiles — the customer's live profiles, without medical history. */
  async listProfiles(customerId: string): Promise<PatientProfileSummary[]> {
    return (await this.deps.repo.listProfiles(customerId)).map(toProfileSummary);
  }

  /** GET /patient-profiles/:profileId — owner only; anything else is 403 (no existence leak). */
  async getProfile(customerId: string, profileId: string): Promise<PatientProfileView> {
    const row = await this.deps.repo.findOwnedProfile(customerId, profileId);
    if (!row) throw forbidden('FORBIDDEN', 'You cannot access this patient profile');
    return toProfileView(row);
  }

  /**
   * PATCH /patient-profiles/:profileId — owner only. While consent is withdrawn no new processing
   * is allowed (BR-17), so edits are refused with 403 CONSENT_REQUIRED.
   */
  async updateProfile(customerId: string, profileId: string, body: UpdateProfileBody): Promise<PatientProfileView> {
    if (body.dob !== undefined) this.checkDob(body.dob ?? null);
    const row = await this.deps.withTx(async (repo) => {
      const current = await repo.lockOwnedProfile(customerId, profileId);
      if (!current) throw forbidden('FORBIDDEN', 'You cannot access this patient profile');
      if (!current.data_consent_accepted) {
        throw forbidden('CONSENT_REQUIRED', 'Health-data consent was withdrawn; the profile cannot be changed');
      }
      return repo.updateProfile(profileId, body as Partial<ProfileFields>);
    });
    return toProfileView(row);
  }

  private checkDob(dob: string | null): void {
    const problem = dobProblem(dob, todayInVietnam(this.nowMs()));
    if (problem === 'DOB_IN_FUTURE') throw badRequest(problem, 'Date of birth cannot be in the future');
    if (problem === 'DOB_TOO_OLD') throw badRequest(problem, 'Date of birth is not plausible');
  }
}

// ---- guards for other modules (bookings · Phase 3) -------------------------------------

/**
 * Everything the booking API must check about WHO books FOR WHOM (US-HP-06 AC-01, BR-14 §2.1–2.2):
 *   1. the profile belongs to this customer and is not deleted   else 403 FORBIDDEN
 *   2. health-data consent is still active (BE-3)                  else 403 CONSENT_REQUIRED
 *   3. HOME care → customer eKYC VERIFIED                          else 403 EKYC_REQUIRED
 * Pass the booking transaction client so the checks see the same snapshot as the INSERT.
 * Returns the profile facts pricing needs (heavy-patient surcharge, location).
 */
export async function assertCanBookForProfile(
  db: Queryable,
  customerId: string,
  patientProfileId: string,
): Promise<BookableProfile> {
  const row = await new PgPatientProfilesRepo(db).findProfileForBooking(patientProfileId);
  if (!row || row.deleted_at !== null || row.customer_id !== customerId) {
    throw forbidden('FORBIDDEN', 'You cannot book for this patient profile');
  }
  await assertConsentActive(db, patientProfileId);
  const gate = checkEkycGate(row.owner_kyc_status, row.location_type);
  if (!gate.allowed) {
    throw new AppError(403, gate.code, 'Complete identity verification (CCCD eKYC) before booking home care', {
      kycStatus: row.owner_kyc_status,
    });
  }
  return {
    patientProfileId: row.id,
    locationType: row.location_type,
    weightKg: num(row.weight_kg),
    mobilityStatus: row.mobility_status,
    lat: num(row.lat),
    lng: num(row.lng),
  };
}

// ---- wiring with real dependencies ------------------------------------------------------

let singleton: PatientProfilesService | null = null;

export function getPatientProfilesService(): PatientProfilesService {
  if (!singleton) {
    const onboarding = getNurseOnboardingService();
    singleton = new PatientProfilesService({
      repo: new PgPatientProfilesRepo(),
      withTx: (fn) => withTransaction((client: DbClient) => fn(new PgPatientProfilesRepo(client), client)),
      uploads: {
        // Reuses BE-1's upload pipeline: same storage categories (kyc-cccd, kyc-selfie) and file checks.
        requestUploadUrls: async (userId, body) =>
          (await onboarding.requestUploadUrls(userId, body)) as UploadUrlView[],
        verifyUploadedFile: (userId, purpose, key) => onboarding.verifyUploadedFile(userId, purpose, key),
      },
      downloadUrl: async (key) => (await storage.createDownloadUrl(key)).url,
      captureConsent: (input) => captureConsent(input),
      writeAudit: writeAuditLog,
    });
  }
  return singleton;
}
