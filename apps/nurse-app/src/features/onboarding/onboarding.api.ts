import {
  mapCredentialView,
  mapStatusToProfile,
  type ApiResponse,
} from '@healthcare-system/shared';
import { apiClient } from '../../lib/api-client';
import { env } from '../../lib/env';
import { loadSession } from '../../lib/storage';
import {
  mockGetOnboardingStatus,
  mockGetUploadUrls,
  mockSubmitOnboarding,
} from './onboarding.mock';
import type {
  OnboardingResult,
  OnboardingStatusDto,
  SubmitOnboardingInput,
  UploadPurpose,
  UploadUrlDto,
} from './onboarding.types';

function fail<T>(code: string, message: string): ApiResponse<T> {
  return { success: false, data: null as unknown as T, error: { code, message } };
}

/**
 * Lấy danh sách URL ký trước (presigned URL) từ backend để tải trực tiếp lên kho lưu trữ.
 * Sống tối đa 10 phút (PRESIGNED_URL_MAX_EXPIRY_SECONDS = 600s).
 */
export async function getUploadUrls(
  purposes: UploadPurpose[]
): Promise<ApiResponse<{ files: UploadUrlDto[] }>> {
  if (env.useMockOnboarding) {
    return mockGetUploadUrls(purposes);
  }

  const filesPayload = purposes.map((purpose) => ({
    purpose,
    contentType: purpose === 'DEGREE' ? 'application/pdf' : 'image/jpeg',
  }));

  return apiClient<{ files: UploadUrlDto[] }>('/nurse/onboarding/upload-urls', {
    method: 'POST',
    body: JSON.stringify({ files: filesPayload }),
  });
}

/**
 * Tải trực tiếp file ảnh / tài liệu lên presigned URL (S3 / MinIO).
 * Sử dụng fetch với blob từ URI nội bộ trên thiết bị (file://...).
 */
export async function putFileToPresignedUrl(
  url: string,
  fileUri: string,
  contentType: string = 'image/jpeg'
): Promise<boolean> {
  // Trong môi trường mock hoặc URL mock
  if (env.useMockOnboarding || url.startsWith('mock://') || fileUri.startsWith('mock://')) {
    await new Promise((r) => setTimeout(r, 100));
    return true;
  }

  try {
    const fileResponse = await fetch(fileUri);
    const blob = await fileResponse.blob();

    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
    });

    return uploadRes.ok;
  } catch {
    return false;
  }
}

/**
 * Nộp hồ sơ eKYC điều dưỡng (FR-AUTH-01): POST /api/v1/auth/nurse-onboarding.
 * Sau khi nộp thành công, hồ sơ chuyển sang PENDING_VERIFICATION để Admin thẩm định.
 */
export async function submitOnboarding(
  input: SubmitOnboardingInput
): Promise<ApiResponse<OnboardingResult>> {
  const session = await loadSession();
  const phone = session?.user?.phone || '0903333333';
  const userId = session?.user?.id || 'nurse-me';

  if (env.useMockOnboarding) {
    return mockSubmitOnboarding(input, phone, userId);
  }

  const res = await apiClient<OnboardingStatusDto>('/auth/nurse-onboarding', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!res.success) {
    return res as unknown as ApiResponse<OnboardingResult>;
  }

  const profile = mapStatusToProfile(res.data, userId);
  const credentials = res.data.credentials.map((c) => mapCredentialView(c, userId));

  if (!profile) {
    return fail('MAPPING_ERROR', 'Không thể đồng bộ hồ sơ sau khi nộp.');
  }

  return {
    success: true,
    data: {
      profile,
      credentials,
    },
  };
}

/**
 * Đọc trạng thái phê duyệt hồ sơ và kết quả thẩm định từng giấy tờ: GET /api/v1/nurse/onboarding.
 */
export async function getOnboardingStatus(): Promise<ApiResponse<OnboardingStatusDto>> {
  const session = await loadSession();
  const phone = session?.user?.phone || '0903333333';
  const userId = session?.user?.id || 'nurse-me';

  if (env.useMockOnboarding) {
    return mockGetOnboardingStatus(phone, userId);
  }

  return apiClient<OnboardingStatusDto>('/nurse/onboarding');
}
