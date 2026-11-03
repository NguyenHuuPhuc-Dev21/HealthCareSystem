// import { apiClient } from '../../lib/api-client';

// export async function uploadRenewedGphn(data: FormData) {
//   return apiClient<{ credential_id: string; verification_status: string }>('/nurse/credentials/gphn', {
//     method: 'PUT',
//     body: data,
//   });
// }

import { DocType, NurseTier, VerificationStatus } from '@healthcare-system/shared';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';
import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import { USE_MOCK } from '../auth/auth.api';
import { mockGetAccount, mockUpdateAccount } from '../auth/auth.mock';

function currentPhone(): string {
  try {
    const raw = localStorage.getItem('carenest_nurse_session');
    return raw ? (JSON.parse(raw).user?.phone as string) : '';
  } catch {
    return '';
  }
}

/**
 * Lấy danh sách văn bằng của chính mình.
 * ĐIỂM CHỐT CONTRACT: SRS chỉ định nghĩa PUT /nurse/credentials/gphn.
 * GET này là đề xuất FE gửi BE-1 — nếu BE trả credentials kèm trong
 * verify-otp/profile thì bỏ hàm này và đọc từ AuthContext.
 */
export async function getMyCredentials(): Promise<ApiResponse<NurseCredential[]>> {
  if (USE_MOCK) {
    const account = mockGetAccount(currentPhone());
    return { success: true, data: account?.credentials ?? [] };
  }
  return apiClient<NurseCredential[]>('/nurse/credentials', { method: 'GET' });
}

export interface GphnUploadResult {
  credential: NurseCredential;
  profile: NurseProfile | null;
}

/** Tải GPHN đã gia hạn (FR-AUTH-01): PUT /nurse/credentials/gphn. */
export async function uploadRenewedGphn(data: FormData): Promise<ApiResponse<GphnUploadResult>> {
  if (USE_MOCK) {
    const phone = currentPhone();
    const account = mockGetAccount(phone);
    if (!account || !account.profile) {
      return {
        success: false,
        data: null as unknown as GphnUploadResult,
        error: { code: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy hồ sơ điều dưỡng' },
      };
    }
    const credential: NurseCredential = {
      id: `cred-${account.user.id}-gphn-${Date.now()}`,
      nurse_id: account.user.id,
      doc_type: DocType.GPHN,
      file_url: 'mock://gphn-renewed.jpg',
      expiry_date: (data.get('gphnExpiryDate') as string) || null,
      // GPHN mới ở PENDING cho tới khi Admin duyệt — tier KHÔNG đổi ở bước này.
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

  const res = await apiClient<{ credential_id: string; verification_status: string }>(
    '/nurse/credentials/gphn',
    { method: 'PUT', body: data },
  );
  if (!res.success) {
    return { success: false, data: null as unknown as GphnUploadResult, error: res.error };
  }
  return {
    success: false,
    data: null as unknown as GphnUploadResult,
    error: {
      code: 'CONTRACT_PENDING',
      message: 'Đã tải GPHN nhưng BE chưa trả văn bằng đầy đủ — chờ chốt contract với BE-1',
    },
  };
}

/**
 * CHỈ DÙNG KHI MOCK: giả lập Admin duyệt GPHN mới -> BE tự nâng lại Tier 2
 * (FR-AUTH-01). Không bao giờ được gọi trong bản chạy API thật.
 */
export async function mockAdminApproveGphn(): Promise<ApiResponse<GphnUploadResult>> {
  const phone = currentPhone();
  const account = mockGetAccount(phone);
  if (!account || !account.profile) {
    return {
      success: false,
      data: null as unknown as GphnUploadResult,
      error: { code: 'PROFILE_NOT_FOUND', message: 'Không tìm thấy hồ sơ' },
    };
  }
  const pending = account.credentials.find(
    (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING,
  );
  if (!pending) {
    return {
      success: false,
      data: null as unknown as GphnUploadResult,
      error: { code: 'NO_PENDING_GPHN', message: 'Không có GPHN nào đang chờ duyệt' },
    };
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
  return { success: true, data: { credential: { ...pending, verification_status: VerificationStatus.APPROVED }, profile } };
}