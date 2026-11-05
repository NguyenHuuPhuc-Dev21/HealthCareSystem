import {
  DocType,
  NurseTier,
  ProfileStatus,
  VerificationStatus,
} from '@healthcare-system/shared';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';
import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import { USE_MOCK_ONBOARDING } from '../../lib/mock-flags';
import { mockGetAccount, mockSaveProfile } from '../auth/auth.mock';
import type { OnboardingStatusDto, UploadPurpose, UploadUrlDto } from './onboarding.types';
import { mapCredentialView, mapStatusToProfile } from './onboarding.types';

export interface OnboardingResult {
  profile: NurseProfile;
  credentials: NurseCredential[];
}

function fail<T>(code: string, message: string): ApiResponse<T> {
  return { success: false, data: null as unknown as T, error: { code, message } };
}

function makeCred(nurseId: string, docType: DocType, expiry?: string): NurseCredential {
  return {
    id: `cred-${nurseId}-${docType.toLowerCase()}-${Date.now()}`,
    nurse_id: nurseId,
    doc_type: docType,
    file_url: `mock://${docType.toLowerCase()}.jpg`,
    expiry_date: expiry ?? null,
    verification_status: VerificationStatus.PENDING,
    created_at: new Date().toISOString(),
  };
}

/** Tải trực tiếp file lên presigned URL (S3/MinIO). */
export async function putToPresignedUrl(url: string, file: File): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Xin presigned URL + PUT thẳng từng file lên storage. Dùng chung cho onboarding
 * và gia hạn GPHN (credentials). Trả về map purpose -> objectKey.
 */
export async function uploadFiles(
  fileList: Array<{ purpose: UploadPurpose; file: File }>,
): Promise<ApiResponse<Map<UploadPurpose, string>>> {
  const urlsRes = await apiClient<{ files: UploadUrlDto[] }>('/nurse/onboarding/upload-urls', {
    method: 'POST',
    body: JSON.stringify({
      files: fileList.map((f) => ({ purpose: f.purpose, contentType: f.file.type })),
    }),
  });
  if (!urlsRes.success) return urlsRes as unknown as ApiResponse<Map<UploadPurpose, string>>;
  const keyByPurpose = new Map<UploadPurpose, string>();
  for (const item of urlsRes.data.files) {
    const src = fileList.find((f) => f.purpose === item.purpose);
    if (!src) continue;
    const okPut = await putToPresignedUrl(item.uploadUrl, src.file);
    if (!okPut) {
      return fail('UPLOAD_FAILED', `Tải file ${item.purpose} lên thất bại. Vui lòng thử lại`);
    }
    keyByPurpose.set(item.purpose, item.objectKey);
  }
  return { success: true, data: keyByPurpose };
}

/** Đọc trạng thái onboarding và danh sách văn bằng từ backend. */
export async function getOnboardingStatus(): Promise<ApiResponse<OnboardingStatusDto>> {
  return apiClient<OnboardingStatusDto>('/nurse/onboarding');
}

/**
 * Nộp hồ sơ eKYC (FR-AUTH-01): POST /auth/nurse-onboarding.
 * - Khi bật mock: tạo hồ sơ PENDING_VERIFICATION ngay trong mock DB.
 * - Khi chạy thật: presigned upload 3 bước (upload-urls -> S3 PUT -> /auth/nurse-onboarding).
 */
export async function submitOnboarding(
  phone: string,
  data: FormData,
): Promise<ApiResponse<OnboardingResult>> {
  if (USE_MOCK_ONBOARDING) {
    const account = mockGetAccount(phone);
    if (!account) {
      return fail('ACCOUNT_NOT_FOUND', 'Không tìm thấy tài khoản');
    }
    const now = new Date().toISOString();
    const profile: NurseProfile = {
      user_id: account.user.id,
      tier: data.get('gphn') ? NurseTier.TIER_2_SPECIALIST : NurseTier.TIER_1_BASIC,
      gphn_number: (data.get('gphnNumber') as string) || null,
      gphn_expiry_date: (data.get('gphnExpiryDate') as string) || null,
      years_of_exp: Number(data.get('yearsOfExp') ?? 0),
      is_retired_medical_staff: data.get('isRetiredMedicalStaff') === 'true',
      is_online: false,
      rating_avg: 0,
      trust_score: 100,
      profile_status: ProfileStatus.PENDING_VERIFICATION,
      created_at: now,
      updated_at: now,
    };
    const credentials: NurseCredential[] = [
      makeCred(account.user.id, DocType.CCCD),
      makeCred(account.user.id, DocType.DEGREE),
    ];
    if (data.get('gphn')) {
      credentials.push(
        makeCred(account.user.id, DocType.GPHN, (data.get('gphnExpiryDate') as string) || undefined),
      );
    }
    if (data.get('retirementDecision')) {
      credentials.push(makeCred(account.user.id, DocType.RETIREMENT_DECISION));
    }
    mockSaveProfile(phone, profile, credentials);
    return { success: true, data: { profile, credentials } };
  }

  const cccdFront = data.get('cccdFront') as File | null;
  const cccdBack = data.get('cccdBack') as File | null;
  const selfie = data.get('selfie') as File | null;
  const degree = data.get('degree') as File | null;
  const gphn = data.get('gphn') as File | null;
  const retirement = data.get('retirementDecision') as File | null;

  const fileList: Array<{ purpose: UploadPurpose; file: File }> = [];
  if (cccdFront) fileList.push({ purpose: 'CCCD_FRONT', file: cccdFront });
  if (cccdBack) fileList.push({ purpose: 'CCCD_BACK', file: cccdBack });
  if (selfie) fileList.push({ purpose: 'PORTRAIT', file: selfie });
  if (degree) fileList.push({ purpose: 'DEGREE', file: degree });
  if (gphn) fileList.push({ purpose: 'GPHN', file: gphn });
  if (retirement) fileList.push({ purpose: 'RETIREMENT_DECISION', file: retirement });

  const uploadRes = await uploadFiles(fileList);
  if (!uploadRes.success) return uploadRes as unknown as ApiResponse<OnboardingResult>;

  const keys = uploadRes.data;
  const cccdFrontKey = keys.get('CCCD_FRONT');
  const cccdBackKey = keys.get('CCCD_BACK');
  const portraitKey = keys.get('PORTRAIT');
  const degreeKey = keys.get('DEGREE');

  if (!cccdFrontKey || !cccdBackKey || !portraitKey || !degreeKey) {
    return fail('UPLOAD_FAILED', 'Thiếu file giấy tờ bắt buộc');
  }

  const gphnNumber = (data.get('gphnNumber') as string) || '';
  const gphnIssuedDate = (data.get('gphnIssuedDate') as string) || '';
  const gphnExpiryDate = (data.get('gphnExpiryDate') as string) || '';
  const gphnAuthority =
    (data.get('gphnAuthority') as string) ||
    (data.get('issuingAuthority') as string) ||
    'Sở Y tế';
  const scopeOfPractice = (data.get('scopeOfPractice') as string) || 'Điều dưỡng đa khoa';
  const rawCccd = ((data.get('cccdNumber') as string) || '').replace(/\D/g, '');
  const cccdNumber = rawCccd.length === 12 ? rawCccd : '079123456789';

  const body: {
    cccdNumber: string;
    yearsOfExp: number;
    identity: { cccdFrontKey: string; cccdBackKey: string; portraitKey: string };
    degree: { fileKey: string };
    gphn?: {
      fileKey: string;
      number: string;
      issuedDate: string;
      expiryDate: string;
      issuingAuthority: string;
      scopeOfPractice: string;
    };
    retirementDecision?: { fileKey: string };
  } = {
    cccdNumber,
    yearsOfExp: Math.max(0, Math.min(70, Number(data.get('yearsOfExp') || 0))),
    identity: {
      cccdFrontKey,
      cccdBackKey,
      portraitKey,
    },
    degree: {
      fileKey: degreeKey,
    },
  };

  if (gphn && keys.has('GPHN')) {
    body.gphn = {
      fileKey: keys.get('GPHN')!,
      number: gphnNumber || '000123/GPHN',
      issuedDate: gphnIssuedDate || '2020-01-01',
      expiryDate: gphnExpiryDate || '2030-01-01',
      issuingAuthority: gphnAuthority,
      scopeOfPractice,
    };
  }

  if (retirement && keys.has('RETIREMENT_DECISION')) {
    body.retirementDecision = {
      fileKey: keys.get('RETIREMENT_DECISION')!,
    };
  }

  const submitRes = await apiClient<OnboardingStatusDto>('/auth/nurse-onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!submitRes.success) return submitRes as unknown as ApiResponse<OnboardingResult>;

  const sessionRaw = localStorage.getItem('carenest_nurse_session');
  const userId = sessionRaw ? JSON.parse(sessionRaw)?.user?.id ?? '' : '';

  const profile = mapStatusToProfile(submitRes.data, userId);
  const credentials = submitRes.data.credentials.map((c) => mapCredentialView(c, userId));
  return { success: true, data: { profile: profile!, credentials } };
}
