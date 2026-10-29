import { apiClient } from '../../lib/api-client';

export async function searchNurses(params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return apiClient<any[]>(`/nurses/search?${query}`);
}

