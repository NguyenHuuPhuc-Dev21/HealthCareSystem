import {
  DocType,
  NurseTier,
  VerificationStatus,
  type ApiResponse,
  type NurseCredential,
  type NurseProfile,
} from '@healthcare-system/shared';
import { mockGetAccount, mockUpdateAccount } from '../auth/auth.mock';
import type { GphnRenewalInput, GphnUploadResult } from './credentials.api';

function fail<T>(code: string, message: string): ApiResponse<T> {
  return { success: false, data: null as unknown as T, error: { code, message } };
}

function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export async function mockGetMyCredentials(phone: string): Promise<ApiResponse<NurseCredential[]>> {
  await new Promise((r) => setTimeout(r, 120));
  const account = mockGetAccount(phone);
  return ok(account?.credentials ?? []);
}

export async function mockUploadRenewedGphn(
  input: GphnRenewalInput,
  phone: string,
  userId: string
): Promise<ApiResponse<GphnUploadResult>> {
  await new Promise((r) => setTimeout(r, 200));

  const account = mockGetAccount(phone);
  if (!account || !account.profile) {
    return fail('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ điều dưỡng.');
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (!input.expiryDate || input.expiryDate <= todayStr) {
    return fail('GPHN_EXPIRED', 'Ngày hết hạn của GPHN mới phải sau hôm nay.');
  }

  if (input.issuedDate && input.expiryDate <= input.issuedDate) {
    return fail('INVALID_DATE_ORDER', 'Ngày hết hạn phải sau ngày cấp GPHN.');
  }

  const effectiveUserId = userId || account.user.id;

  const newCredential: NurseCredential = {
    id: `cred-${effectiveUserId}-gphn-${Date.now()}`,
    nurse_id: effectiveUserId,
    doc_type: DocType.GPHN,
    file_url: input.fileUri || 'mock://gphn-renewed.jpg',
    issued_date: input.issuedDate,
    expiry_date: input.expiryDate,
    verification_status: VerificationStatus.PENDING,
    created_at: new Date().toISOString(),
  };

  // Thay thế GPHN cũ hoặc đưa bản mới nhất lên đầu / thay thế
  const updatedCredentials = [
    ...account.credentials.filter((c) => c.doc_type !== DocType.GPHN),
    newCredential,
  ];

  // Giữ nguyên tầng hiện tại trong lúc chờ duyệt
  mockUpdateAccount(phone, {
    credentials: updatedCredentials,
  });

  return ok({
    credential: newCredential,
    profile: account.profile,
  });
}

export async function mockAdminApproveGphn(phone: string): Promise<ApiResponse<GphnUploadResult>> {
  await new Promise((r) => setTimeout(r, 150));

  const account = mockGetAccount(phone);
  if (!account || !account.profile) {
    return fail('PROFILE_NOT_FOUND', 'Không tìm thấy hồ sơ điều dưỡng.');
  }

  const pending = account.credentials.find(
    (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING
  );

  if (!pending) {
    return fail('NO_PENDING_GPHN', 'Không có GPHN nào đang chờ thẩm định.');
  }

  const approvedCredential: NurseCredential = {
    ...pending,
    verification_status: VerificationStatus.APPROVED,
    reviewed_at: new Date().toISOString(),
  };

  const updatedCredentials = account.credentials.map((c) =>
    c.id === pending.id ? approvedCredential : c
  );

  const updatedProfile: NurseProfile = {
    ...account.profile,
    tier: NurseTier.TIER_2_SPECIALIST,
    gphn_expiry_date: pending.expiry_date ?? account.profile.gphn_expiry_date,
    updated_at: new Date().toISOString(),
  };

  mockUpdateAccount(phone, {
    credentials: updatedCredentials,
    profile: updatedProfile,
  });

  return ok({
    credential: approvedCredential,
    profile: updatedProfile,
  });
}

/**
 * Helper cho phép đổi ngày hết hạn GPHN nhanh chóng để test các mức cảnh báo (vàng, đỏ)
 */
export function mockSetGphnExpiryForTesting(
  phone: string,
  expiryDate: string,
  downgradeTierIfExpired: boolean = true
): NurseProfile | null {
  const account = mockGetAccount(phone);
  if (!account || !account.profile) return null;

  const todayStr = new Date().toISOString().slice(0, 10);
  const isExpired = expiryDate < todayStr;

  const updatedProfile: NurseProfile = {
    ...account.profile,
    gphn_expiry_date: expiryDate,
    tier:
      isExpired && downgradeTierIfExpired
        ? NurseTier.TIER_1_BASIC
        : account.profile.tier,
    updated_at: new Date().toISOString(),
  };

  const updatedCredentials = account.credentials.map((c) => {
    if (c.doc_type === DocType.GPHN) {
      return {
        ...c,
        expiry_date: expiryDate,
        verification_status: VerificationStatus.APPROVED,
      };
    }
    return c;
  });

  mockUpdateAccount(phone, {
    profile: updatedProfile,
    credentials: updatedCredentials,
  });

  return updatedProfile;
}
