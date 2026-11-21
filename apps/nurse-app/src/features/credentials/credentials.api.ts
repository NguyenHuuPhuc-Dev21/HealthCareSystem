import {
  DocType,
  NurseTier,
  VerificationStatus,
  mapCredentialView,
  mapStatusToProfile,
  type ApiResponse,
  type NurseCredential,
  type NurseProfile,
} from '@healthcare-system/shared';
import { apiClient } from '../../lib/api-client';
import { env } from '../../lib/env';
import { loadSession } from '../../lib/storage';
import {
  getOnboardingStatus,
  getUploadUrls,
  putFileToPresignedUrl,
} from '../onboarding/onboarding.api';
import {
  mockAdminApproveGphn as mockApproveImpl,
  mockGetMyCredentials,
  mockUploadRenewedGphn,
} from './credentials.mock';

export interface GphnRenewalInput {
  fileUri: string;
  number: string;
  issuedDate: string;
  expiryDate: string;
  issuingAuthority: string;
  scopeOfPractice: string;
}

export interface GphnUploadResult {
  credential: NurseCredential;
  profile: NurseProfile | null;
}

export type GphnAlertTone = 'crimson' | 'amber' | 'jade' | 'neutral';

export interface GphnAlertInfo {
  status: 'EXPIRED' | 'EXPIRING_SOON' | 'VALID' | 'PENDING' | 'NONE';
  daysRemaining: number | null;
  label: string;
  description: string;
  tone: GphnAlertTone;
  actionRequired: boolean;
}

function fail<T>(code: string, message: string): ApiResponse<T> {
  return { success: false, data: null as unknown as T, error: { code, message } };
}

/**
 * Tính số ngày còn lại của GPHN tính theo ngày lịch so với referenceDate.
 * - Trả về null nếu không có expiryDate.
 * - Trả về <= 0 nếu đã hết hạn.
 * - Trả về > 0 nếu còn hiệu lực.
 */
export function calculateGphnDaysRemaining(
  expiryDate: string | null | undefined,
  referenceDate: Date = new Date()
): number | null {
  if (!expiryDate) return null;
  const parts = expiryDate.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  const expiryUtc = Date.UTC(year, month - 1, day);
  const refUtc = Date.UTC(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  const diffMs = expiryUtc - refUtc;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Phân loại mức cảnh báo và nội dung hiển thị cho GPHN:
 * - PENDING: Hồ sơ mới đang chờ duyệt
 * - EXPIRED: days <= 0 (Khung đỏ: Bạn đã bị hạ về Tầng 1, nộp GPHN mới để được xét lại)
 * - EXPIRING_SOON: 0 < days <= 30 (Khung vàng: GPHN còn X ngày - nên cập nhật sớm)
 * - VALID: days > 30 (Khung ngọc jade: Còn hiệu lực)
 */
export function getGphnAlertInfo(
  expiryDate: string | null | undefined,
  hasPendingGphn: boolean = false,
  referenceDate: Date = new Date()
): GphnAlertInfo {
  if (hasPendingGphn) {
    return {
      status: 'PENDING',
      daysRemaining: calculateGphnDaysRemaining(expiryDate, referenceDate),
      label: 'GPHN mới đang chờ duyệt',
      description:
        'Hồ sơ đã gửi thành công và đang được Admin thẩm định. Sau khi duyệt, bạn sẽ tự động được nâng lại Cấp 2.',
      tone: 'amber',
      actionRequired: false,
    };
  }

  const days = calculateGphnDaysRemaining(expiryDate, referenceDate);
  if (days === null) {
    return {
      status: 'NONE',
      daysRemaining: null,
      label: 'Chưa cập nhật GPHN',
      description: 'Bạn đang hoạt động ở Tầng 1 (Chăm sóc cơ bản).',
      tone: 'neutral',
      actionRequired: true,
    };
  }

  if (days <= 0) {
    return {
      status: 'EXPIRED',
      daysRemaining: days,
      label: 'GPHN đã hết hạn',
      description: 'Bạn đã bị hạ về Tầng 1, nộp GPHN mới để được xét lại.',
      tone: 'crimson',
      actionRequired: true,
    };
  }

  if (days <= 30) {
    return {
      status: 'EXPIRING_SOON',
      daysRemaining: days,
      label: `GPHN còn ${days} ngày`,
      description: `Hết hạn ${expiryDate} — nên cập nhật sớm để không gián đoạn nhận ca Cấp 2.`,
      tone: 'amber',
      actionRequired: true,
    };
  }

  return {
    status: 'VALID',
    daysRemaining: days,
    label: `Còn hiệu lực (${days} ngày)`,
    description: `Hiệu lực đến ${expiryDate}`,
    tone: 'jade',
    actionRequired: false,
  };
}

/**
 * Lấy danh sách văn bằng & giấy tờ của điều dưỡng hiện tại.
 */
export async function getMyCredentials(): Promise<ApiResponse<NurseCredential[]>> {
  const session = await loadSession();
  const phone = session?.user?.phone || '0902222222';
  const userId = session?.user?.id || 'nurse-me';

  if (env.useMockCredentials) {
    return mockGetMyCredentials(phone);
  }

  const res = await getOnboardingStatus();
  if (!res.success) {
    return res as unknown as ApiResponse<NurseCredential[]>;
  }

  return {
    success: true,
    data: res.data.credentials.map((c) => mapCredentialView(c, userId)),
  };
}

/**
 * Tải GPHN đã gia hạn (FR-AUTH-01):
 * - Mock: cập nhật vào mock database với trạng thái PENDING.
 * - Thật: lấy presigned URL, đẩy file ảnh, gọi PUT /nurse/credentials/gphn.
 */
export async function uploadRenewedGphn(
  input: GphnRenewalInput
): Promise<ApiResponse<GphnUploadResult>> {
  const session = await loadSession();
  const phone = session?.user?.phone || '0902222222';
  const userId = session?.user?.id || 'nurse-me';

  if (env.useMockCredentials) {
    return mockUploadRenewedGphn(input, phone, userId);
  }

  // 1. Xin presigned upload URL cho purpose GPHN
  const urlsRes = await getUploadUrls(['GPHN']);
  if (!urlsRes.success || !urlsRes.data.files[0]) {
    return fail('UPLOAD_URL_FAILED', 'Không thể khởi tạo đường dẫn tải ảnh GPHN.');
  }

  const uploadTarget = urlsRes.data.files[0];

  // 2. Tải file ảnh lên kho lưu trữ
  const uploadSuccess = await putFileToPresignedUrl(
    uploadTarget.uploadUrl,
    input.fileUri,
    'image/jpeg'
  );

  if (!uploadSuccess) {
    return fail('STORAGE_UPLOAD_FAILED', 'Tải ảnh GPHN lên máy chủ thất bại.');
  }

  // 3. Gửi payload cập nhật GPHN
  const updateRes = await apiClient<{ status: 'PENDING_REVIEW' }>('/nurse/credentials/gphn', {
    method: 'PUT',
    body: JSON.stringify({
      fileKey: uploadTarget.objectKey,
      number: input.number,
      issuedDate: input.issuedDate,
      expiryDate: input.expiryDate,
      issuingAuthority: input.issuingAuthority,
      scopeOfPractice: input.scopeOfPractice,
    }),
  });

  if (!updateRes.success) {
    return updateRes as unknown as ApiResponse<GphnUploadResult>;
  }

  // 4. Đọc lại danh sách văn bằng và hồ sơ mới nhất
  const statusRes = await getOnboardingStatus();
  if (!statusRes.success) {
    return statusRes as unknown as ApiResponse<GphnUploadResult>;
  }

  const credentials = statusRes.data.credentials.map((c) => mapCredentialView(c, userId));
  const credential =
    credentials.find(
      (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING
    ) ?? credentials.find((c) => c.doc_type === DocType.GPHN);

  if (!credential) {
    return fail('UNEXPECTED_RESPONSE', 'Đã gửi GPHN nhưng không đọc lại được danh mục văn bằng.');
  }

  return {
    success: true,
    data: {
      credential,
      profile: mapStatusToProfile(statusRes.data, userId),
    },
  };
}

/**
 * Mô phỏng Admin duyệt GPHN mới (chỉ dùng trong chế độ Mock/DEV).
 */
export async function mockAdminApproveGphn(): Promise<ApiResponse<GphnUploadResult>> {
  const session = await loadSession();
  const phone = session?.user?.phone || '0902222222';
  return mockApproveImpl(phone);
}
