import {
  DocType,
  KycStatus,
  NurseTier,
  ProfileStatus,
  VerificationStatus,
  type ApiResponse,
  type NurseCredential,
  type NurseProfile,
} from '@healthcare-system/shared';
import { mockGetAccount, mockSaveProfile, mockUpdateAccount } from '../auth/auth.mock';
import type {
  CredentialViewDto,
  OnboardingResult,
  OnboardingStatusDto,
  SubmitOnboardingInput,
  UploadPurpose,
  UploadUrlDto,
} from './onboarding.types';

function fail<T>(code: string, message: string): ApiResponse<T> {
  return { success: false, data: null as unknown as T, error: { code, message } };
}

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

function makeCred(
  nurseId: string,
  docType: DocType,
  status: VerificationStatus = VerificationStatus.PENDING,
  extra: Partial<NurseCredential> = {}
): NurseCredential {
  return {
    id: `cred-${nurseId}-${docType.toLowerCase()}-${Date.now()}`,
    nurse_id: nurseId,
    doc_type: docType,
    file_url: `mock://${docType.toLowerCase()}.jpg`,
    verification_status: status,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

/**
 * Mock sinh URL ký trước để tải file trực tiếp lên kho
 */
export async function mockGetUploadUrls(
  purposes: UploadPurpose[]
): Promise<ApiResponse<{ files: UploadUrlDto[] }>> {
  await new Promise((r) => setTimeout(r, 150));

  const files: UploadUrlDto[] = purposes.map((purpose) => ({
    purpose,
    objectKey: `mock-keys/nurse-onboarding-${purpose.toLowerCase()}-${Date.now()}.jpg`,
    uploadUrl: `mock://presigned-upload/${purpose.toLowerCase()}`,
    expiresInSeconds: 600,
    contentType: purpose === 'DEGREE' ? 'application/pdf' : 'image/jpeg',
  }));

  return ok({ files });
}

/**
 * Mock nộp hồ sơ eKYC điều dưỡng (FR-AUTH-01)
 */
export async function mockSubmitOnboarding(
  input: SubmitOnboardingInput,
  phone: string,
  userId: string
): Promise<ApiResponse<OnboardingResult>> {
  await new Promise((r) => setTimeout(r, 250));

  const cleanCccd = (input.cccdNumber || '').replace(/\D/g, '');
  if (cleanCccd.length !== 12) {
    return fail('VALIDATION_ERROR', 'Số CCCD phải đủ 12 chữ số hợp lệ.');
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  if (input.gphn) {
    if (!input.gphn.number?.trim()) {
      return fail('VALIDATION_ERROR', 'Vui lòng nhập số Giấy phép hành nghề (GPHN).');
    }
    if (!input.gphn.expiryDate || input.gphn.expiryDate <= todayStr) {
      return fail(
        'GPHN_EXPIRED',
        'GPHN đã hết hạn. Vui lòng kiểm tra lại hoặc bỏ chọn GPHN để xét duyệt Tầng 1.'
      );
    }
    if (input.gphn.issuedDate && input.gphn.expiryDate <= input.gphn.issuedDate) {
      return fail('VALIDATION_ERROR', 'Ngày hết hạn GPHN phải sau ngày cấp.');
    }
  }

  const now = new Date().toISOString();
  const effectiveUserId = userId || `nurse-${phone}`;

  const profile: NurseProfile = {
    user_id: effectiveUserId,
    tier: input.gphn ? NurseTier.TIER_2_SPECIALIST : NurseTier.TIER_1_BASIC,
    gphn_number: input.gphn?.number ?? null,
    gphn_expiry_date: input.gphn?.expiryDate ?? null,
    scope_of_practice: input.gphn?.scopeOfPractice || 'Điều dưỡng đa khoa',
    years_of_exp: Number(input.yearsOfExp ?? 0),
    is_retired_medical_staff: Boolean(input.retirementDecision),
    is_online: false,
    rating_avg: 0,
    trust_score: 100,
    profile_status: ProfileStatus.PENDING_VERIFICATION,
    created_at: now,
    updated_at: now,
  };

  const credentials: NurseCredential[] = [
    makeCred(effectiveUserId, DocType.CCCD),
    makeCred(effectiveUserId, DocType.DEGREE),
  ];

  if (input.gphn) {
    credentials.push(
      makeCred(effectiveUserId, DocType.GPHN, VerificationStatus.PENDING, {
        expiry_date: input.gphn.expiryDate,
        issued_date: input.gphn.issuedDate,
      })
    );
  }

  if (input.retirementDecision) {
    credentials.push(makeCred(effectiveUserId, DocType.RETIREMENT_DECISION));
  }

  mockSaveProfile(phone, profile, credentials);

  return ok({ profile, credentials });
}

/**
 * Mock đọc trạng thái onboarding và danh sách thẩm định giấy tờ
 */
export async function mockGetOnboardingStatus(
  phone: string,
  userId: string
): Promise<ApiResponse<OnboardingStatusDto>> {
  await new Promise((r) => setTimeout(r, 150));

  const account = mockGetAccount(phone);
  if (!account || !account.profile) {
    return ok({
      profileStatus: null,
      tier: null,
      kycStatus: KycStatus.PENDING,
      credentials: [],
    });
  }

  const credDtos: CredentialViewDto[] = account.credentials.map((c) => ({
    id: c.id,
    docType: c.doc_type,
    side: null,
    documentNumber: c.doc_type === DocType.GPHN ? account.profile?.gphn_number ?? null : null,
    issuedDate: c.issued_date ?? null,
    expiryDate: c.expiry_date ?? null,
    verificationStatus: c.verification_status,
    rejectionReason: c.rejection_reason ?? null,
    submittedAt: c.created_at,
  }));

  const allApproved =
    credDtos.length > 0 &&
    credDtos.every((c) => c.verificationStatus === VerificationStatus.APPROVED);

  return ok({
    profileStatus: account.profile.profile_status,
    tier: account.profile.tier,
    kycStatus: allApproved ? KycStatus.VERIFIED : KycStatus.PENDING,
    credentials: credDtos,
  });
}

/**
 * Helper giả lập Admin duyệt hoặc từ chối một giấy tờ (dùng cho test/demo)
 */
export function mockSetDocumentReviewResult(
  phone: string,
  docType: DocType,
  status: VerificationStatus,
  rejectionReason?: string
): void {
  const account = mockGetAccount(phone);
  if (!account) return;

  const creds = account.credentials.map((c) => {
    if (c.doc_type === docType) {
      return {
        ...c,
        verification_status: status,
        rejection_reason: status === VerificationStatus.REJECTED ? rejectionReason ?? 'Tài liệu không hợp lệ.' : undefined,
      };
    }
    return c;
  });

  mockUpdateAccount(phone, { credentials: creds });
}

/**
 * Helper giả lập Admin duyệt toàn bộ hồ sơ -> ACTIVE
 */
export function mockAdminApproveProfile(phone: string): void {
  const account = mockGetAccount(phone);
  if (!account || !account.profile) return;

  const approvedCreds = account.credentials.map((c) => ({
    ...c,
    verification_status: VerificationStatus.APPROVED,
    rejection_reason: undefined,
  }));

  mockUpdateAccount(phone, {
    profile: {
      ...account.profile,
      profile_status: ProfileStatus.ACTIVE,
    },
    credentials: approvedCreds,
  });
}
