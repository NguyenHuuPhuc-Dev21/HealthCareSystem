import { apiClient } from '../../lib/api-client';

export async function submitDisputeRebuttal(disputeId: string, rebuttal: string, evidenceUrls: string[]) {
  return apiClient<{ updated: boolean }>(`/disputes/${disputeId}/rebuttal`, {
    method: 'POST',
    body: JSON.stringify({ rebuttal, evidence_urls: evidenceUrls }),
  });
}

