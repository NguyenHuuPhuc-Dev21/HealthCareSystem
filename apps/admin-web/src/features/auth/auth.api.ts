import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type { AuthUser, RequestOtpResponse, Verify2faResponse, VerifyOtpResponse } from './auth.types';

/*
 * Đăng nhập Admin: SĐT + OTP như mọi tài khoản → Admin BẮT BUỘC thêm 2FA (TOTP).
 *
 * Lớp này là "biên dịch" giữa contract thật của BE-1 (module accounts-otp trên main,
 * docs/api/accounts-otp.api.md — camelCase, verify-otp trả union theo `status`)
 * và kiểu nội bộ mà các trang Admin đang dùng. Mọi ánh xạ field/mã lỗi nằm ở đây;
 * các trang không cần biết BE trả camelCase hay snake_case.
 * Mock (src/mocks/auth.handlers.ts) cũng trả đúng shape của BE để hai chế độ như nhau.
 */

interface PublicUserDto {
  id: string;
  phone: string;
  fullName: string;
  role: AuthUser['role'];
  kycStatus: AuthUser['kyc_status'];
}

interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
}

function mapUser(u: PublicUserDto): AuthUser {
  return {
    id: u.id,
    role: u.role,
    status: 'ACTIVE',
    kyc_status: u.kycStatus,
    full_name: u.fullName,
    phone: u.phone,
  };
}

/** Ánh xạ mã lỗi BE -> mã nội bộ mà auth.messages.ts hiểu. */
function mapError<T>(res: ApiResponse<T>): ApiResponse<T> {
  if (res.success || !res.error) return res;
  const d = (res.error.details ?? {}) as Record<string, unknown>;
  const remap: Record<string, { code: string; details?: Record<string, unknown> }> = {
    OTP_INVALID_OR_EXPIRED: {
      code: 'OTP_INVALID',
      details: { attempts_left: d.attemptsRemaining },
    },
    OTP_ATTEMPTS_EXCEEDED: { code: 'OTP_TOO_MANY_ATTEMPTS' },
    OTP_RESEND_TOO_SOON: {
      code: 'OTP_RATE_LIMITED',
      details: { retry_after_sec: d.retryAfterSeconds },
    },
    CHALLENGE_INVALID: { code: 'TWO_FA_CHALLENGE_EXPIRED' },
    TOTP_INVALID: { code: 'TWO_FA_INVALID', details: { attempts_left: d.attemptsRemaining } },
    TOTP_NOT_ENROLLED: { code: 'TWO_FA_CHALLENGE_EXPIRED' },
    VALIDATION_ERROR: { code: 'INVALID_PHONE' },
  };
  const m = remap[res.error.code];
  if (!m) return res;
  return {
    ...res,
    error: { ...res.error, code: m.code, details: m.details ?? res.error.details },
  };
}

interface RequestOtpDto {
  expiresInSeconds: number;
  resendAfterSeconds: number;
  devOtp?: string;
}

/** POST /api/v1/auth/request-otp */
export async function requestOtp(phone: string): Promise<ApiResponse<RequestOtpResponse>> {
  const res = await apiClient<RequestOtpDto>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
  if (!res.success) return mapError(res) as unknown as ApiResponse<RequestOtpResponse>;
  // Dev/staging (OTP_DEV_ECHO): BE trả mã kèm response -> lưu để trang OTP hiện lên.
  if (res.data.devOtp) sessionStorage.setItem('dev_otp', res.data.devOtp);
  else sessionStorage.removeItem('dev_otp');
  return {
    success: true,
    data: {
      expires_in_sec: res.data.expiresInSeconds,
      resend_after_sec: res.data.resendAfterSeconds,
      is_new_user: false, // BE không tiết lộ số đã đăng ký hay chưa (chống dò tài khoản)
    },
  };
}

type VerifyOtpDto =
  | { status: 'AUTHENTICATED'; user: PublicUserDto; tokens: TokenPairDto }
  | { status: 'REGISTRATION_REQUIRED'; registrationToken: string; expiresInSeconds: number }
  | { status: 'SECOND_FACTOR_REQUIRED'; challengeToken: string; expiresInSeconds: number; enrolled: boolean };

/** POST /api/v1/auth/verify-otp — Admin luôn rơi vào nhánh SECOND_FACTOR_REQUIRED. */
export async function verifyOtp(phone: string, otp: string): Promise<ApiResponse<VerifyOtpResponse>> {
  const res = await apiClient<VerifyOtpDto>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
  if (!res.success) return mapError(res) as unknown as ApiResponse<VerifyOtpResponse>;
  switch (res.data.status) {
    case 'AUTHENTICATED':
      return {
        success: true,
        data: { requires_2fa: false, access_token: res.data.tokens.accessToken, user: mapUser(res.data.user) },
      };
    case 'SECOND_FACTOR_REQUIRED':
      // Mang theo cờ enrolled sang trang 2FA: chưa enrol thì phải qua bước setup trước.
      sessionStorage.setItem('admin_2fa_enrolled', res.data.enrolled ? '1' : '0');
      return {
        success: true,
        data: {
          requires_2fa: true,
          challenge_token: res.data.challengeToken,
          challenge_expires_in_sec: res.data.expiresInSeconds,
        },
      };
    case 'REGISTRATION_REQUIRED':
      return {
        success: false,
        data: null as unknown as VerifyOtpResponse,
        error: {
          code: 'ACCOUNT_NOT_REGISTERED',
          message: 'Số điện thoại này chưa có tài khoản. Admin Console không tự đăng ký — liên hệ quản trị hệ thống.',
        },
      };
  }
}

export interface TwoFaSetupResult {
  secret: string;
  otpauthUrl: string;
  issuer: string;
  accountName: string;
}

/** POST /api/v1/auth/2fa/setup — lấy secret để cài vào ứng dụng xác thực (lần đầu). */
export async function setup2fa(challengeToken: string): Promise<ApiResponse<TwoFaSetupResult>> {
  const res = await apiClient<TwoFaSetupResult>('/auth/2fa/setup', {
    method: 'POST',
    body: JSON.stringify({ challengeToken }),
  });
  return mapError(res);
}

/** POST /api/v1/auth/verify-2fa — mã 6 số từ ứng dụng xác thực (TOTP). */
export async function verify2fa(challengeToken: string, code: string): Promise<ApiResponse<Verify2faResponse>> {
  const res = await apiClient<{ user: PublicUserDto; tokens: TokenPairDto }>('/auth/verify-2fa', {
    method: 'POST',
    body: JSON.stringify({ challengeToken, code }),
  });
  if (!res.success) return mapError(res) as unknown as ApiResponse<Verify2faResponse>;
  return {
    success: true,
    data: { access_token: res.data.tokens.accessToken, user: mapUser(res.data.user) },
  };
}
