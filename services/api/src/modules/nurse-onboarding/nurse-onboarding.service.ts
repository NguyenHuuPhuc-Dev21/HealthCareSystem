/**
 * nurse-onboarding — FR-AUTH-01 eKYC dossier submission (BE-1 / Dev A, Phase 1).
 * Traceability: SRS §8 POST /api/v1/auth/nurse-onboarding · FR-AUTH-01 · BR-21 §2.1 · US-HP-04 AC-01
 *               SEC-7.1 (upload pipeline), NFR-SEC-01 (private storage, 10-minute presigned URLs)
 *
 * Flow:
 *  1. POST /nurse/onboarding/upload-urls → one presigned PUT per file (keys are server-generated).
 *  2. The app uploads each file straight to private storage.
 *  3. POST /auth/nurse-onboarding with the keys + CCCD/GPHN details. The server checks every file
 *     (owner, purpose, exists, ≤ 10 MB, real type by magic bytes) and then, in ONE transaction,
 *     creates/locks nurse_profiles (PENDING_VERIFICATION), writes users CCCD/KYC fields and inserts
 *     nurse_credentials rows (PENDING). Tier is NOT decided here — credential-review does that.
 *
 * Out of scope here: renewed GPHN for an ACTIVE nurse (PUT /nurse/credentials/gphn → credential-review).
 */

import { DocType, Gender, ProfileStatus, TIMEZONE_DISPLAY } from '@healthcare-system/shared';
import { withTransaction } from '../../core/database';
import { AppError, badRequest, conflict, forbidden } from '../../core/errors';
import * as storage from '../../core/storage';
import type { StorageCategory } from '../../core/storage';
import { PgOnboardingRepo } from './nurse-onboarding.repo';
import type { SubmitOnboardingBody, UploadUrlsBody } from './nurse-onboarding.schema';
import type {
  NewCredential,
  OnboardingRepo,
  OnboardingStatus,
  StoragePort,
  UploadPurpose,
  UploadUrlResult,
} from './nurse-onboarding.types';

const IMAGES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const IMAGES_OR_PDF = [...IMAGES, 'application/pdf'] as const;

/** Where each purpose is stored and which real file types it accepts. */
const PURPOSES: Record<UploadPurpose, { category: StorageCategory; types: readonly string[] }> = {
  CCCD_FRONT: { category: 'kyc-cccd', types: IMAGES },
  CCCD_BACK: { category: 'kyc-cccd', types: IMAGES },
  PORTRAIT: { category: 'kyc-selfie', types: IMAGES },
  DEGREE: { category: 'nurse-degree', types: IMAGES_OR_PDF },
  GPHN: { category: 'nurse-gphn', types: IMAGES_OR_PDF },
  RETIREMENT_DECISION: { category: 'nurse-retirement', types: IMAGES_OR_PDF },
};

export interface NurseOnboardingDeps {
  storage: StoragePort;
  /** Read-only repo (pool). */
  repo: OnboardingRepo;
  /** Runs `fn` in one DB transaction with a repo bound to that transaction. */
  withTx<T>(fn: (repo: OnboardingRepo) => Promise<T>): Promise<T>;
  maxUploadBytes: number;
  now?: () => number;
}

/** Today's date (YYYY-MM-DD) in Vietnam time — the legal date for GPHN validity. */
export function todayInVietnam(nowMs: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_DISPLAY }).format(new Date(nowMs));
}

export class NurseOnboardingService {
  constructor(private readonly deps: NurseOnboardingDeps) {}

  /** Step 1: presigned PUT URLs. The client never chooses the object key. */
  async requestUploadUrls(userId: string, body: UploadUrlsBody): Promise<UploadUrlResult[]> {
    const results: UploadUrlResult[] = [];
    for (const file of body.files) {
      const rule = PURPOSES[file.purpose];
      if (!rule.types.includes(file.contentType)) {
        throw badRequest('CONTENT_TYPE_NOT_ALLOWED', `${file.purpose} accepts ${rule.types.join(', ')}`);
      }
      const objectKey = this.deps.storage.buildObjectKey(rule.category, userId, file.contentType);
      const url = await this.deps.storage.createUploadUrl(objectKey, file.contentType);
      results.push({
        purpose: file.purpose,
        objectKey,
        uploadUrl: url.url,
        expiresInSeconds: url.expiresInSeconds,
        contentType: file.contentType,
      });
    }
    return results;
  }

  /** Checks one uploaded file end-to-end. Throws a 400 with a specific code on failure. */
  private async verifyFile(userId: string, purpose: UploadPurpose, key: string): Promise<void> {
    const rule = PURPOSES[purpose];
    const details = { purpose, key };
    if (!storage.objectKeyBelongsTo(key, userId) || !key.startsWith(`${rule.category}/`)) {
      throw badRequest('INVALID_FILE_KEY', `File key is not a ${purpose} upload of this account`, details);
    }
    const info = await this.deps.storage.statObject(key);
    if (!info) throw badRequest('FILE_NOT_UPLOADED', `${purpose} file was not uploaded`, details);
    if (info.sizeBytes <= 0 || info.sizeBytes > this.deps.maxUploadBytes) {
      throw badRequest('FILE_TOO_LARGE', `${purpose} file must be between 1 byte and the size limit`, details);
    }
    const head = await this.deps.storage.readObjectHead(key);
    const realType = head ? storage.detectContentType(head) : null;
    if (!realType || !rule.types.includes(realType)) {
      throw badRequest('FILE_TYPE_NOT_ALLOWED', `${purpose} file content is not an accepted type`, details);
    }
  }

  /** Step 3: POST /auth/nurse-onboarding. */
  async submit(userId: string, body: SubmitOnboardingBody): Promise<OnboardingStatus> {
    const today = todayInVietnam((this.deps.now ?? Date.now)());

    // ---- date rules (before touching storage or the DB) ----
    const issued = [body.degree.issuedDate, body.gphn?.issuedDate, body.retirementDecision?.issuedDate];
    if (issued.some((d) => d !== undefined && d > today)) {
      throw badRequest('ISSUED_DATE_IN_FUTURE', 'An issue date cannot be in the future');
    }
    if (body.gphn && body.gphn.expiryDate <= today) {
      // An expired GPHN cannot unlock Tier 2. Submit without it (Tier 1) or with a renewed one.
      throw badRequest('GPHN_EXPIRED', 'The GPHN has expired. Submit a valid GPHN or none.');
    }

    // ---- files ----
    const files: [UploadPurpose, string][] = [
      ['CCCD_FRONT', body.identity.cccdFrontKey],
      ['CCCD_BACK', body.identity.cccdBackKey],
      ['PORTRAIT', body.identity.portraitKey],
      ['DEGREE', body.degree.fileKey],
    ];
    if (body.gphn) files.push(['GPHN', body.gphn.fileKey]);
    if (body.retirementDecision) files.push(['RETIREMENT_DECISION', body.retirementDecision.fileKey]);
    if (new Set(files.map(([, k]) => k)).size !== files.length) {
      throw badRequest('DUPLICATE_FILE', 'Each document must be a different file');
    }
    for (const [purpose, key] of files) await this.verifyFile(userId, purpose, key);

    const credentials: NewCredential[] = [
      { docType: DocType.CCCD, side: 'FRONT', fileKey: body.identity.cccdFrontKey, documentNumber: body.cccdNumber },
      { docType: DocType.CCCD, side: 'BACK', fileKey: body.identity.cccdBackKey, documentNumber: body.cccdNumber },
      { docType: DocType.DEGREE, fileKey: body.degree.fileKey, issuedDate: body.degree.issuedDate },
    ];
    if (body.gphn) {
      credentials.push({
        docType: DocType.GPHN,
        fileKey: body.gphn.fileKey,
        documentNumber: body.gphn.number,
        issuedDate: body.gphn.issuedDate,
        expiryDate: body.gphn.expiryDate,
        issuingAuthority: body.gphn.issuingAuthority,
        scopeOfPractice: body.gphn.scopeOfPractice,
      });
    }
    if (body.retirementDecision) {
      credentials.push({
        docType: DocType.RETIREMENT_DECISION,
        fileKey: body.retirementDecision.fileKey,
        issuedDate: body.retirementDecision.issuedDate,
      });
    }

    // ---- one transaction: lock profile, check state, write everything ----
    await this.deps.withTx(async (repo) => {
      const { profileStatus, created } = await repo.lockOrCreateProfile(userId, body.yearsOfExp);
      if (profileStatus === ProfileStatus.BANNED) {
        throw forbidden('ACCOUNT_BANNED', 'This account has been permanently locked');
      }
      if (profileStatus === ProfileStatus.ACTIVE || profileStatus === ProfileStatus.SUSPENDED) {
        throw conflict('ALREADY_VERIFIED', 'Profile already verified. Upload a renewed GPHN from the credentials screen.');
      }
      if (!created && (await repo.countPendingCredentials(userId)) > 0) {
        throw conflict('ONBOARDING_ALREADY_SUBMITTED', 'Your documents are waiting for review');
      }
      await repo.updateNurseIdentity(userId, {
        cccdNumber: body.cccdNumber,
        ...(body.gender ? { gender: body.gender as Gender } : {}),
        kycDocuments: {
          cccdFrontKey: body.identity.cccdFrontKey,
          cccdBackKey: body.identity.cccdBackKey,
          portraitKey: body.identity.portraitKey,
          submittedAt: new Date((this.deps.now ?? Date.now)()).toISOString(),
        },
      });
      if (!created) await repo.updateYearsOfExp(userId, body.yearsOfExp);
      await repo.insertCredentials(userId, credentials);
    });

    return this.getStatus(userId);
  }

  async getStatus(userId: string): Promise<OnboardingStatus> {
    const status = await this.deps.repo.getStatus(userId);
    if (!status) throw new AppError(404, 'NURSE_NOT_FOUND', 'Nurse account not found');
    return status;
  }
}

// ---- wiring with real dependencies ----------------------------------------

let singleton: NurseOnboardingService | null = null;

export function getNurseOnboardingService(): NurseOnboardingService {
  if (!singleton) {
    singleton = new NurseOnboardingService({
      storage: {
        buildObjectKey: storage.buildObjectKey,
        createUploadUrl: (key, type) => storage.createUploadUrl(key, type),
        statObject: storage.statObject,
        readObjectHead: (key) => storage.readObjectHead(key),
      },
      repo: new PgOnboardingRepo(),
      withTx: (fn) => withTransaction((client) => fn(new PgOnboardingRepo(client))),
      maxUploadBytes: storage.MAX_UPLOAD_BYTES,
    });
  }
  return singleton;
}
