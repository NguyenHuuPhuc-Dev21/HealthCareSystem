import { apiClient } from '../../lib/api-client';

export async function searchUsers(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return apiClient<any[]>(`/admin/users?${query}`);
}

export async function updateUserStatus(userId: string, status: string, reason?: string) {
  return apiClient<{ updated: boolean }>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

