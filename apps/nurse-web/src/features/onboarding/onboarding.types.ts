import { DocType, KycStatus, NurseTier, ProfileStatus, VerificationStatus } from '@healthcare-system/shared';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';

export type UploadPurpose = 'CCCD_FRONT' | 'CCCD_BACK' | 'PORTRAIT' | 'DEGREE' | 'GPHN' | 'RETIREMENT_DECISION';

export interface UploadUrlDto {
  purpose: UploadPurpose;
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  contentType: string;
}

export interface CredentialViewDto {
  id: string;
  docType: DocType;
  side: 'FRONT' | 'BACK' | null;
  documentNumber: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  submittedAt: string;
}

export interface OnboardingStatusDto {
  profileStatus: ProfileStatus | null;
  tier: NurseTier | null;
  kycStatus: KycStatus;
  credentials: CredentialViewDto[];
}

export function mapCredentialView(c: CredentialViewDto, nurseId: string): NurseCredential {
  return {
    id: c.id,
    nurse_id: nurseId,
    doc_type: c.docType,
    file_url: '',
    issued_date: c.issuedDate ?? undefined,
    expiry_date: c.expiryDate ?? undefined,
    verification_status: c.verificationStatus,
    rejection_reason: c.rejectionReason ?? undefined,
    created_at: c.submittedAt,
  };
}

export function mapStatusToProfile(s: OnboardingStatusDto, nurseId: string): NurseProfile | null {
  if (!s.profileStatus) return null;
  const gphn = s.credentials.find((c) => c.docType === DocType.GPHN);
  const now = new Date().toISOString();
  return {
    user_id: nurseId,
    profile_status: s.profileStatus,
    tier: s.tier ?? NurseTier.TIER_1_BASIC,
    years_of_exp: 0,
    is_retired_medical_staff: false,
    is_online: false,
    rating_avg: 0,
    trust_score: 100,
    gphn_number: gphn?.documentNumber ?? undefined,
    gphn_expiry_date: gphn?.expiryDate ?? undefined,
    created_at: now,
    updated_at: now,
  };
}
