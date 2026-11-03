/**
 * Credential review decision rules — pure functions, no I/O (FR-AUTH-02, BR-21 §2.2–2.4, US-HP-04).
 *
 * Tier rule (single source for BE-1 and BE-2's tier-lifecycle sweep):
 *   TIER_2_SPECIALIST ⇔ nurse_profiles holds an APPROVED GPHN whose expiry date is after today.
 *   Everything else — degree only, retirement decision only, expired GPHN — is TIER_1_BASIC.
 *
 * First review (profile PENDING_VERIFICATION):
 *   ACTIVE only if CCCD front + back AND the degree are approved. Otherwise the profile stays
 *   PENDING_VERIFICATION and the nurse resubmits. kyc_status = VERIFIED iff both CCCD sides approved.
 * Later reviews (ACTIVE / SUSPENDED nurse sent a renewed GPHN): status unchanged, an approved GPHN
 *   is copied to the profile and the tier is recomputed → automatic re-upgrade to Tier 2.
 */
import { DocType, KycStatus, NurseTier, ProfileStatus } from '@healthcare-system/shared';
import { badRequest, conflict } from '../../core/errors';
import type { LockedProfile, PendingCredential, ReviewDecision, ReviewOutcome } from './credential-review.types';

export function computeTier(gphnNumber: string | null, gphnExpiryDate: string | null, today: string): NurseTier {
  return gphnNumber && gphnExpiryDate && gphnExpiryDate > today ? NurseTier.TIER_2_SPECIALIST : NurseTier.TIER_1_BASIC;
}

export function decideReviewOutcome(input: {
  profile: LockedProfile;
  pending: PendingCredential[];
  decisions: ReviewDecision[];
  today: string;
}): ReviewOutcome {
  const { profile, pending, decisions, today } = input;

  if (profile.profileStatus === ProfileStatus.BANNED) {
    throw conflict('PROFILE_BANNED', 'This nurse is permanently banned; credentials cannot be reviewed');
  }
  if (pending.length === 0) {
    throw conflict('NOTHING_TO_REVIEW', 'This nurse has no documents waiting for review');
  }

  // Every pending document must get exactly one decision — no partial reviews, no foreign ids.
  const byId = new Map(decisions.map((d) => [d.credentialId, d]));
  if (byId.size !== decisions.length) throw badRequest('DUPLICATE_DECISION', 'A document was decided twice');
  const unknown = decisions.filter((d) => !pending.some((p) => p.id === d.credentialId));
  if (unknown.length > 0) {
    throw badRequest('UNKNOWN_CREDENTIAL', 'Some decisions are not for a pending document of this nurse', {
      credentialIds: unknown.map((d) => d.credentialId),
    });
  }
  const missing = pending.filter((p) => !byId.has(p.id));
  if (missing.length > 0) {
    throw badRequest('INCOMPLETE_REVIEW', 'Every pending document needs a decision', {
      credentialIds: missing.map((p) => p.id),
    });
  }

  const approved = (p: PendingCredential) => byId.get(p.id)!.decision === 'APPROVED';
  const approvedOf = (type: DocType) => pending.filter((p) => p.docType === type && approved(p));

  // A GPHN can only be approved while it is still valid.
  const gphn = approvedOf(DocType.GPHN).at(-1);
  if (gphn && (!gphn.expiryDate || gphn.expiryDate <= today || !gphn.documentNumber)) {
    throw badRequest('GPHN_EXPIRED', 'This GPHN is expired (or incomplete) and cannot be approved — reject it instead');
  }
  const retiredBadge = profile.isRetiredMedicalStaff || approvedOf(DocType.RETIREMENT_DECISION).length > 0;

  if (profile.profileStatus === ProfileStatus.PENDING_VERIFICATION) {
    const front = pending.some((p) => p.docType === DocType.CCCD && p.side === 'FRONT' && approved(p));
    const back = pending.some((p) => p.docType === DocType.CCCD && p.side === 'BACK' && approved(p));
    const degree = approvedOf(DocType.DEGREE).length > 0;
    const identityOk = front && back;
    const kycStatus = identityOk ? KycStatus.VERIFIED : KycStatus.UNVERIFIED;

    if (!(identityOk && degree)) {
      return {
        profileStatus: ProfileStatus.PENDING_VERIFICATION,
        tier: profile.tier,
        kycStatus,
        isRetiredMedicalStaff: profile.isRetiredMedicalStaff,
        activated: false,
      };
    }
    const approvedGphn = gphn
      ? { number: gphn.documentNumber!, expiryDate: gphn.expiryDate!, scopeOfPractice: gphn.scopeOfPractice }
      : undefined;
    return {
      profileStatus: ProfileStatus.ACTIVE,
      tier: computeTier(approvedGphn?.number ?? null, approvedGphn?.expiryDate ?? null, today),
      kycStatus,
      ...(approvedGphn ? { approvedGphn } : {}),
      isRetiredMedicalStaff: retiredBadge,
      activated: true,
    };
  }

  // ACTIVE or SUSPENDED: renewal / supplementary documents.
  const approvedGphn = gphn
    ? { number: gphn.documentNumber!, expiryDate: gphn.expiryDate!, scopeOfPractice: gphn.scopeOfPractice }
    : undefined;
  const number = approvedGphn?.number ?? profile.gphnNumber;
  const expiry = approvedGphn?.expiryDate ?? profile.gphnExpiryDate;
  return {
    profileStatus: profile.profileStatus,
    tier: computeTier(number, expiry, today),
    ...(approvedGphn ? { approvedGphn } : {}),
    isRetiredMedicalStaff: retiredBadge,
    activated: false,
  };
}
