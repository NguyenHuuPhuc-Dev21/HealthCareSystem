import {
  buildSessionFromAuth,
  type ApiResponse,
  type BeVerifyAuthenticated,
  type RequestOtpData,
  type SessionData,
  type VerifyOutcome,
} from '@healthcare-system/shared';
import { apiClient } from '../../lib/api-client';
import { env } from '../../lib/env';
import * as mockAuth from './auth.mock';

/**
 * Chuẩn hóa số điện thoại: chuyển +84 thành 0, loại bỏ khoảng trắng, dấu chấm, dấu gạch nối
 */
export function normalizePhoneNumber(raw: string): string {
  let cleaned = raw.trim().replace(/[\s.-]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Kiểm tra số điện thoại di động Việt Nam hợp lệ: 10 chữ số bắt đầu bằng 0 (đầu số 03, 05, 07, 08, 09)
 */
export function isValidVietnamesePhone(raw: string): boolean {
  const normalized = normalizePhoneNumber(raw);
  return /^0[3|5|7|8|9]\d{8}$/.test(normalized);
}

interface BeVerifyRegistration {
  status: 'REGISTRATION_REQUIRED';
  registrationToken: string;
  expiresInSeconds: number;
}

interface BeVerifySecondFactor {
  status: 'SECOND_FACTOR_REQUIRED';
  challengeToken: string;
  expiresInSeconds: number;
  enrolled: boolean;
}

type BeVerifyResponse = BeVerifyAuthenticated | BeVerifyRegistration | BeVerifySecondFactor;

/**
 * Gửi yêu cầu nhận mã OTP qua SMS/Zalo ZNS (FR-AUTH-01)
 */
export async function requestOtp(phone: string): Promise<ApiResponse<RequestOtpData>> {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (env.useMockAuth) {
    return mockAuth.mockRequestOtp(normalizedPhone);
  }

  const res = await apiClient<{
    expiresInSeconds: number;
    resendAfterSeconds: number;
    devOtp?: string;
  }>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: normalizedPhone }),
  });

  if (!res.success) {
    return res as unknown as ApiResponse<RequestOtpData>;
  }

  return {
    success: true,
    data: {
      requestId: `req-${Date.now()}`,
      resendAfterSeconds: res.data.resendAfterSeconds,
      expiresInSeconds: res.data.expiresInSeconds,
      devOtp: res.data.devOtp,
    },
  };
}

/**
 * Xác thực mã OTP 6 chữ số
 */
export async function verifyOtp(phone: string, otp: string): Promise<ApiResponse<VerifyOutcome>> {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (env.useMockAuth) {
    return mockAuth.mockVerifyOtp(normalizedPhone, otp);
  }

  const res = await apiClient<BeVerifyResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: normalizedPhone, otp }),
  });

  if (!res.success) {
    return res as unknown as ApiResponse<VerifyOutcome>;
  }

  if (res.data.status === 'AUTHENTICATED') {
    // Gọi buildSessionFromAuth để chuẩn hóa SessionData
    const sessionRes = buildSessionFromAuth(res.data, null);
    if (!sessionRes.success) {
      return {
        success: false,
        data: null as any,
        error: sessionRes.error,
      };
    }
    return {
      success: true,
      data: {
        status: 'AUTHENTICATED',
        session: sessionRes.data!,
      },
    };
  }

  if (res.data.status === 'REGISTRATION_REQUIRED') {
    return {
      success: true,
      data: {
        status: 'REGISTRATION_REQUIRED',
        registrationToken: res.data.registrationToken,
      },
    };
  }

  return {
    success: false,
    data: null as any,
    error: {
      code: 'SECOND_FACTOR_UNSUPPORTED',
      message: 'Tài khoản yêu cầu xác thực 2 bước (2FA) không được hỗ trợ trên ứng dụng điều dưỡng.',
    },
  };
}

/**
 * Hoàn tất đăng ký tài khoản cho số điện thoại mới (nhập họ tên đầy đủ)
 */
export async function completeRegistration(
  registrationToken: string,
  fullName: string
): Promise<ApiResponse<SessionData>> {
  if (env.useMockAuth) {
    return mockAuth.mockCompleteRegistration(registrationToken, fullName);
  }

  const res = await apiClient<BeVerifyAuthenticated>('/auth/complete-registration', {
    method: 'POST',
    body: JSON.stringify({
      registrationToken,
      fullName: fullName.trim(),
      role: 'NURSE',
    }),
  });

  if (!res.success) {
    return res as unknown as ApiResponse<SessionData>;
  }

  const sessionRes = buildSessionFromAuth(res.data, null);
  if (!sessionRes.success) {
    return {
      success: false,
      data: null as any,
      error: sessionRes.error,
    };
  }

  return {
    success: true,
    data: sessionRes.data!,
  };
}

/**
 * Đăng xuất tài khoản khỏi máy chủ và thu hồi refresh token
 */
export async function logoutServer(refreshToken?: string | null): Promise<void> {
  if (env.useMockAuth) {
    await mockAuth.mockLogoutServer();
    return;
  }

  if (refreshToken) {
    await apiClient('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
}
