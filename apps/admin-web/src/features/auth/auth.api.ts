import { apiClient } from '../../lib/api-client';
import type { RequestOtpResponse, Verify2faResponse, VerifyOtpResponse } from './auth.types';

/*
 * Bản Phase 0 dùng `POST /admin/auth/login` (username + password + TOTP) — theo baseline bệnh viện cũ.
 * SRS v2.0 + thiết kế SH1: Admin đăng nhập bằng SĐT + OTP như mọi tài khoản, sau đó bắt buộc 2FA.
 * ⚠️ Cần BE-1 xác nhận endpoint 2FA.
 */

/** POST /api/v1/auth/request-otp */
export async function requestOtp(phone: string) {
  return apiClient<RequestOtpResponse>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

/** POST /api/v1/auth/verify-otp — với Admin trả về challenge_token cho bước 2FA. */
export async function verifyOtp(phone: string, otp: string) {
  return apiClient<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
}

/** POST /api/v1/auth/verify-2fa — mã 6 số từ ứng dụng xác thực (TOTP). */
export async function verify2fa(challengeToken: string, code: string) {
  return apiClient<Verify2faResponse>('/auth/verify-2fa', {
    method: 'POST',
    body: JSON.stringify({ challenge_token: challengeToken, code }),
  });
}
