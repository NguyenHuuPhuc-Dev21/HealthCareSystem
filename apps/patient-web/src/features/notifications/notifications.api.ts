import { apiClient } from '../../lib/api-client';

export async function getNotifications() {
  return apiClient<any[]>('/notifications');
}

