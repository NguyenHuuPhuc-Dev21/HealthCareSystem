import { apiClient } from '../../lib/api-client';
import type {
  RequestOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from './auth.types';

/** POST /api/v1/auth/request-otp — gửi OTP 6 số qua SMS / Zalo ZNS. */
export async function requestOtp(phone: string) {
  return apiClient<RequestOtpResponse>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

/** POST /api/v1/auth/verify-otp — xác thực OTP, nhận phiên đăng nhập. */
export async function verifyOtp(payload: VerifyOtpRequest) {
  return apiClient<VerifyOtpResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
