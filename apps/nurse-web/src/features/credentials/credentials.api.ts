import { DocType, NurseTier, VerificationStatus } from '@healthcare-system/shared';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';
import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import { USE_MOCK_CREDENTIALS, USE_MOCK_ONBOARDING } from '../../lib/mock-flags';
import { mockGetAccount, mockUpdateAccount } from '../auth/auth.mock';
import { getOnboardingStatus, uploadFiles } from '../onboarding/onboarding.api';
import { mapCredentialView, mapStatusToProfile } from '../onboarding/onboarding.types';

function currentSession(): { phone: string; userId: string } {
  try {
    const raw = localStorage.getItem('carenest_nurse_session');
    const s = raw ? JSON.parse(raw) : null;
    return { phone: s?.user?.phone ?? '', userId: s?.user?.id ?? '' };
  } catch {
    return { phone: '', userId: '' };
  }
}

function fail<T>(code: string, message: string): ApiResponse<T> {
  return { success: false, data: null as unknown as T, error: { code, message } };
}

/**
 * Danh sách văn bằng của chính mình.
 * - Thật: lấy từ GET /nurse/onboarding (cùng response với trạng thái hồ sơ).
 * - Mock: từ mock DB.
 */
export async function getMyCredentials(): Promise<ApiResponse<NurseCredential[]>> {
  if (USE_MOCK_ONBOARDING) {
    const account = mockGetAccount(currentSession().phone);
    return { success: true, data: account?.credentials ?? [] };
  }
  const { userId } = currentSession();
  const res = await getOnboardingStatus();
  if (!res.success) return res as unknown as ApiResponse<NurseCredential[]>;
  return { success: true, data: res.data.credentials.map((c) => mapCredentialView(c, userId)) };
}

export interface GphnUploadResult {
  credential: NurseCredential;
  profile: NurseProfile | null;
}

export interface GphnRenewalInput {
  file: File;
  number: string;
  issuedDate: string;
  expiryDate: string;
  issuingAuthority: string;
  scopeOfPractice: string;
}

/**
 * Tải GPHN đã gia hạn (FR-AUTH-01).
 * - Mock (VITE_MOCK_CREDENTIALS=true): như bản đầu — tạo credential PENDING trong mock DB.
 * - Thật: upload file qua presigned URL (purpose GPHN) rồi PUT /nurse/credentials/gphn
 *   với JSON {fileKey, number, issuedDate, expiryDate, issuingAuthority, scopeOfPractice}
 *   -> 202 PENDING_REVIEW (module credential-review của BE-1, đã có trên main).
 *   Sau đó đọc lại GET /nurse/onboarding để lấy danh sách văn bằng + hồ sơ mới nhất.
 */
export async function uploadRenewedGphn(input: GphnRenewalInput): Promise<ApiResponse<GphnUploadResult>> {
  if (USE_MOCK_CREDENTIALS) {
    const { phone } = currentSession();
    const account = mockGetAccount(phone);
    if (!account || !account.profile) {
      return fail('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ điều dưỡng');
    }
    const credential: NurseCredential = {
      id: `cred-${account.user.id}-gphn-${Date.now()}`,
      nurse_id: account.user.id,
      doc_type: DocType.GPHN,
      file_url: 'mock://gphn-renewed.jpg',
      issued_date: input.issuedDate,
      expiry_date: input.expiryDate,
      verification_status: VerificationStatus.PENDING,
      created_at: new Date().toISOString(),
    };
    const credentials = [
      ...account.credentials.filter((c) => c.doc_type !== DocType.GPHN),
      credential,
    ];
    mockUpdateAccount(phone, { credentials });
    return { success: true, data: { credential, profile: account.profile } };
  }

  const up = await uploadFiles([{ purpose: 'GPHN', file: input.file }]);
  if (!up.success) return up as unknown as ApiResponse<GphnUploadResult>;
  const fileKey = up.data.get('GPHN');
  if (!fileKey) return fail('UPLOAD_FAILED', 'Không lấy được địa chỉ tải file GPHN');

  const res = await apiClient<{ status: 'PENDING_REVIEW' }>('/nurse/credentials/gphn', {
    method: 'PUT',
    body: JSON.stringify({
      fileKey,
      number: input.number,
      issuedDate: input.issuedDate,
      expiryDate: input.expiryDate,
      issuingAuthority: input.issuingAuthority,
      scopeOfPractice: input.scopeOfPractice,
    }),
  });
  if (!res.success) return res as unknown as ApiResponse<GphnUploadResult>;

  const { userId } = currentSession();
  const statusRes = await getOnboardingStatus();
  if (!statusRes.success) return statusRes as unknown as ApiResponse<GphnUploadResult>;
  const credentials = statusRes.data.credentials.map((c) => mapCredentialView(c, userId));
  const credential =
    credentials.find(
      (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING,
    ) ?? credentials.find((c) => c.doc_type === DocType.GPHN);
  if (!credential) return fail('UNEXPECTED_RESPONSE', 'Đã gửi GPHN nhưng không đọc lại được danh sách văn bằng');
  return {
    success: true,
    data: { credential, profile: mapStatusToProfile(statusRes.data, userId) },
  };
}

/**
 * CHỈ DÙNG KHI MOCK: giả lập Admin duyệt GPHN mới -> nâng lại Tier 2 (FR-AUTH-01).
 * BE chưa có credential-review (router /admin/nurses còn comment trong app.ts)
 * nên vòng duyệt này chưa nối thật được.
 */
export async function mockAdminApproveGphn(): Promise<ApiResponse<GphnUploadResult>> {
  const { phone } = currentSession();
  const account = mockGetAccount(phone);
  if (!account || !account.profile) {
    return fail('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ');
  }
  const pending = account.credentials.find(
    (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING,
  );
  if (!pending) {
    return fail('NO_PENDING_GPHN', 'Không có GPHN nào đang chờ duyệt');
  }
  const credentials = account.credentials.map((c) =>
    c.id === pending.id
      ? { ...c, verification_status: VerificationStatus.APPROVED, reviewed_at: new Date().toISOString() }
      : c,
  );
  const profile: NurseProfile = {
    ...account.profile,
    tier: NurseTier.TIER_2_SPECIALIST,
    gphn_expiry_date: pending.expiry_date ?? account.profile.gphn_expiry_date,
    updated_at: new Date().toISOString(),
  };
  mockUpdateAccount(phone, { credentials, profile });
  return {
    success: true,
    data: {
      credential: { ...pending, verification_status: VerificationStatus.APPROVED },
      profile,
    },
  };
}
