import { apiClient } from '../../lib/api-client';

export async function getServiceCategories() {
  return apiClient<any[]>('/admin/services/categories');
}

export async function updateServiceCategory(id: string, payload: any) {
  return apiClient<any>(`/admin/services/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

