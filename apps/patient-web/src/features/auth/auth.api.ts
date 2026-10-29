import { apiClient } from '../../lib/api-client';

export async function requestOtp(phone: string) {
  return apiClient<{ requestId: string }>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone: string, otp: string) {
  return apiClient<{ token: string; user: { id: string; role: string } }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
}

