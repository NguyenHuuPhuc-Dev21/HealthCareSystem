// import { apiClient } from '../../lib/api-client';

// export async function requestOtp(phone: string) {
//   return apiClient<{ requestId: string }>('/auth/request-otp', {
//     method: 'POST',
//     body: JSON.stringify({ phone }),
//   });
// }

// export async function verifyOtp(phone: string, otp: string) {
//   return apiClient<{ token: string; user: { id: string; role: string } }>('/auth/verify-otp', {
//     method: 'POST',
//     body: JSON.stringify({ phone, otp }),
//   });
// }

import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import { mockRequestOtp, mockVerifyOtp } from './auth.mock';
import type { RequestOtpData, SessionData } from './auth.types';

/** Bật/tắt mock bằng .env.local — xem env.local.example. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function requestOtp(phone: string): Promise<ApiResponse<RequestOtpData>> {
  if (USE_MOCK) return mockRequestOtp(phone);
  return apiClient<RequestOtpData>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, otp: string): Promise<ApiResponse<SessionData>> {
  if (USE_MOCK) return mockVerifyOtp(phone, otp);
  return apiClient<SessionData>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
}