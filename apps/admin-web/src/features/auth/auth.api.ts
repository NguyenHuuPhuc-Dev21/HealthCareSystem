import { apiClient } from '../../lib/api-client';

export async function adminLogin(username: string, password: string, totpCode: string) {
  return apiClient<{ token: string; user: { id: string; role: string } }>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, totp_code: totpCode }),
  });
}

