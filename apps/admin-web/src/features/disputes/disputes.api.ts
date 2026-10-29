import { apiClient } from '../../lib/api-client';

export async function resolveDispute(disputeId: string, resolution: 'RESOLVED_CUSTOMER' | 'RESOLVED_NURSE', notes: string) {
  return apiClient<{ updated: boolean }>(`/admin/disputes/${disputeId}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolution, notes }),
  });
}

