import type { DocType, Gender, KycStatus, NurseTier, ProfileStatus, VerificationStatus } from '@healthcare-system/shared';
import type { ObjectInfo, PresignedUrlResult, StorageCategory } from '../../core/storage';

/** What a single uploaded file is for. CCCD has two sides; the portrait is KYC-only. */
export type UploadPurpose = 'CCCD_FRONT' | 'CCCD_BACK' | 'PORTRAIT' | 'DEGREE' | 'GPHN' | 'RETIREMENT_DECISION';

export interface NewCredential {
  docType: DocType;
  fileKey: string;
  side?: 'FRONT' | 'BACK';
  documentNumber?: string;
  issuedDate?: string; // YYYY-MM-DD
  expiryDate?: string; // YYYY-MM-DD
  issuingAuthority?: string;
  scopeOfPractice?: string;
}

export interface CredentialView {
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

export interface OnboardingStatus {
  /** null = the nurse has not submitted the onboarding dossier yet. */
  profileStatus: ProfileStatus | null;
  tier: NurseTier | null;
  kycStatus: KycStatus;
  credentials: CredentialView[];
}

/** users.kyc_documents JSON written at onboarding (private storage keys only). */
export interface KycDocuments {
  cccdFrontKey: string;
  cccdBackKey: string;
  portraitKey: string;
  submittedAt: string;
}

export interface OnboardingRepo {
  /** Creates the profile if missing, then locks it (SELECT … FOR UPDATE). Call inside a transaction. */
  lockOrCreateProfile(userId: string, yearsOfExp: number): Promise<{ profileStatus: ProfileStatus; created: boolean }>;
  countPendingCredentials(userId: string): Promise<number>;
  /** Throws AppError 409 CCCD_ALREADY_REGISTERED if the CCCD number belongs to another account. */
  updateNurseIdentity(
    userId: string,
    input: { cccdNumber: string; gender?: Gender; kycDocuments: KycDocuments },
  ): Promise<void>;
  updateYearsOfExp(userId: string, yearsOfExp: number): Promise<void>;
  insertCredentials(userId: string, credentials: NewCredential[]): Promise<void>;
  getStatus(userId: string): Promise<OnboardingStatus | null>;
}

/** The parts of core/storage this module uses (injected so tests need no S3). */
export interface StoragePort {
  buildObjectKey(category: StorageCategory, ownerUserId: string, contentType: string): string;
  createUploadUrl(objectKey: string, contentType: string): Promise<PresignedUrlResult>;
  statObject(objectKey: string): Promise<ObjectInfo | null>;
  readObjectHead(objectKey: string): Promise<Buffer | null>;
}

export interface UploadUrlResult {
  purpose: UploadPurpose;
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  /** The client must send exactly this Content-Type header with the PUT. */
  contentType: string;
}
