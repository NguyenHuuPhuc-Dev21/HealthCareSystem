export type {
  CredentialViewDto,
  OnboardingStatusDto,
  UploadPurpose,
  UploadUrlDto,
} from '@healthcare-system/shared';
export { mapCredentialView, mapStatusToProfile } from '@healthcare-system/shared';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';

export interface SubmitOnboardingInput {
  cccdNumber: string;
  yearsOfExp?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  identity: {
    cccdFrontKey: string;
    cccdBackKey: string;
    portraitKey: string;
  };
  degree: {
    fileKey: string;
    issuedDate?: string;
  };
  gphn?: {
    fileKey: string;
    number: string;
    issuedDate: string;
    expiryDate: string;
    issuingAuthority: string;
    scopeOfPractice: string;
  };
  retirementDecision?: {
    fileKey: string;
    issuedDate?: string;
  };
}

export interface OnboardingResult {
  profile: NurseProfile;
  credentials: NurseCredential[];
}
