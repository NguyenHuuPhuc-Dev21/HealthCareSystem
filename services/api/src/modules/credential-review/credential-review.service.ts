/**
 * credential-review — Admin verification of nurse documents, tier assignment, GPHN renewal
 * (BE-1 / Dev A, Phase 1).
 * Traceability: SRS §8 PATCH /api/v1/admin/nurses/:id/verify, PUT /api/v1/nurse/credentials/gphn
 *               FR-AUTH-01 (renewal), FR-AUTH-02 · BR-21 §2.2–2.4, §2.7 · US-HP-04 AC-02/03/05 · TC-AUTH-01..03
 *
 * Every decision records reviewed_by / reviewed_at (+ rejection_reason). Decisions, the profile
 * change and the APPROVE_GPHN audit entry are written in ONE transaction with the profile and the
 * pending credentials locked (FOR UPDATE), so two Admins cannot review the same dossier at once.
 */
import { AuditAction, DocType, PRESIGNED_URL_MAX_EXPIRY_SECONDS, ProfileStatus } from '@healthcare-system/shared';
import { withTransaction } from '../../core/database';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors';
import * as storage from '../../core/storage';
import { getNurseOnboardingService, todayInVietnam } from '../nurse-onboarding/nurse-onboarding.service';
import { decideReviewOutcome } from './credential-review.policy';
import { PgReviewReadRepo, PgReviewRepo } from './credential-review.repo';
import type { GphnRenewalBody, VerifyBody } from './credential-review.schema';
import type { DossierRecord, QueueItem, ReviewReadRepo, ReviewRepo, ReviewOutcome } from './credential-review.types';

export interface CredentialReviewDeps {
  read: ReviewReadRepo;
  withTx<T>(fn: (repo: ReviewRepo) => Promise<T>): Promise<T>;
  /** Presigned GET for an object key (≤ 10 minutes). */
  downloadUrl(key: string): Promise<string>;
  /** Same file checks as onboarding (owner, purpose, size, magic bytes). */
  verifyGphnFile(nurseId: string, key: string): Promise<void>;
  now?: () => number;
}

export interface ReviewResult {
  nurseId: string;
  profileStatus: ProfileStatus;
  tier: ReviewOutcome['tier'];
  activated: boolean;
  isRetiredMedicalStaff: boolean;
}

export class CredentialReviewService {
  constructor(private readonly deps: CredentialReviewDeps) {}

  private today(): string {
    return todayInVietnam((this.deps.now ?? Date.now)());
  }

  /** GET /admin/nurses/verification-queue — oldest waiting first. */
  listQueue(limit: number, offset: number): Promise<QueueItem[]> {
    return this.deps.read.listQueue(limit, offset);
  }

  /** GET /admin/nurses/:id/dossier — everything the Admin needs, files as 10-minute links. */
  async getDossier(nurseId: string) {
    const d: DossierRecord | null = await this.deps.read.getDossier(nurseId);
    if (!d) throw notFound('NURSE_NOT_FOUND', 'Nurse profile not found');
    const link = async (key?: string) => (key ? this.deps.downloadUrl(key) : null);
    return {
      nurseId: d.nurseId,
      fullName: d.fullName,
      phone: d.phone,
      gender: d.gender,
      cccdNumber: d.cccdNumber,
      kycStatus: d.kycStatus,
      identityFiles: {
        cccdFrontUrl: await link(d.kycDocuments?.cccdFrontKey),
        cccdBackUrl: await link(d.kycDocuments?.cccdBackKey),
        portraitUrl: await link(d.kycDocuments?.portraitKey),
      },
      profile: d.profile,
      // Object keys stay server-side; the Admin gets 10-minute links (NFR-SEC-01).
      credentials: await Promise.all(
        d.credentials.map(async ({ fileKey, ...c }) => ({ ...c, fileUrl: await this.deps.downloadUrl(fileKey) })),
      ),
      linksExpireInSeconds: PRESIGNED_URL_MAX_EXPIRY_SECONDS,
    };
  }

  /** PATCH /admin/nurses/:id/verify */
  async verify(adminId: string, nurseId: string, body: VerifyBody, ip: string | null): Promise<ReviewResult> {
    const today = this.today();
    return this.deps.withTx(async (repo) => {
      const profile = await repo.lockProfile(nurseId);
      if (!profile) throw notFound('NURSE_NOT_FOUND', 'Nurse profile not found');
      const pending = await repo.lockPendingCredentials(nurseId);

      const outcome = decideReviewOutcome({ profile, pending, decisions: body.decisions, today });

      await repo.saveDecisions(nurseId, adminId, body.decisions);
      await repo.updateProfile(nurseId, outcome);
      if (outcome.kycStatus) await repo.setKycStatus(nurseId, outcome.kycStatus);

      if (outcome.approvedGphn) {
        await repo.insertAudit({
          actorId: adminId,
          action: AuditAction.APPROVE_GPHN,
          targetId: nurseId,
          oldValue: { tier: profile.tier, gphnNumber: profile.gphnNumber, gphnExpiryDate: profile.gphnExpiryDate },
          newValue: { tier: outcome.tier, gphnNumber: outcome.approvedGphn.number, gphnExpiryDate: outcome.approvedGphn.expiryDate },
          ip,
        });
      }

      return {
        nurseId,
        profileStatus: outcome.profileStatus,
        tier: outcome.tier,
        activated: outcome.activated,
        isRetiredMedicalStaff: outcome.isRetiredMedicalStaff,
      };
    });
  }

  /** PUT /nurse/credentials/gphn — an approved nurse sends a renewed GPHN (stays PENDING until reviewed). */
  async submitGphnRenewal(nurseId: string, body: GphnRenewalBody): Promise<void> {
    const today = this.today();
    if (body.issuedDate > today) throw badRequest('ISSUED_DATE_IN_FUTURE', 'The issue date cannot be in the future');
    if (body.expiryDate <= today) throw badRequest('GPHN_EXPIRED', 'This GPHN has already expired');
    await this.deps.verifyGphnFile(nurseId, body.fileKey);

    await this.deps.withTx(async (repo) => {
      const profile = await repo.lockProfile(nurseId);
      if (!profile) throw conflict('NOT_ONBOARDED', 'Submit the onboarding dossier first');
      if (profile.profileStatus === ProfileStatus.BANNED) {
        throw forbidden('ACCOUNT_BANNED', 'This account has been permanently locked');
      }
      if (profile.profileStatus === ProfileStatus.PENDING_VERIFICATION) {
        throw conflict('NOT_ONBOARDED', 'Your onboarding dossier is still under review');
      }
      const pending = await repo.lockPendingCredentials(nurseId);
      if (pending.some((p) => p.docType === DocType.GPHN)) {
        throw conflict('GPHN_RENEWAL_PENDING', 'A GPHN is already waiting for review');
      }
      await repo.insertGphn(nurseId, body);
    });
  }
}

// ---- wiring ----------------------------------------------------------------

let singleton: CredentialReviewService | null = null;

export function getCredentialReviewService(): CredentialReviewService {
  if (!singleton) {
    singleton = new CredentialReviewService({
      read: new PgReviewReadRepo(),
      withTx: (fn) => withTransaction((client) => fn(new PgReviewRepo(client))),
      downloadUrl: async (key) => (await storage.createDownloadUrl(key)).url,
      verifyGphnFile: (nurseId, key) => getNurseOnboardingService().verifyUploadedFile(nurseId, 'GPHN', key),
    });
  }
  return singleton;
}

