import { apiClient } from '../../lib/api-client';

export async function getAdminDashboard() {
  return apiClient<any>('/admin/dashboard');
}

