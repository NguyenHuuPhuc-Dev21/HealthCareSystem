import { apiClient } from '../../lib/api-client';

export async function createDispute(bookingId: string, reason: string, evidenceUrls: string[]) {
  return apiClient<{ dispute_id: string }>(`/bookings/${bookingId}/disputes`, {
    method: 'POST',
    body: JSON.stringify({ reason, evidence_urls: evidenceUrls }),
  });
}

