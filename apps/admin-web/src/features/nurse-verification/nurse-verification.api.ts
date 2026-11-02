import { apiClient } from '../../lib/api-client';

export async function verifyNurse(nurseId: string, decision: 'APPROVED' | 'REJECTED', tier?: string, notes?: string) {
  return apiClient<{ updated: boolean }>(`/admin/nurses/${nurseId}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ decision, tier, notes }),
  });
}

