import { apiClient } from '../../lib/api-client';

export async function submitCheckOut(bookingId: string, minimalCareReport: any) {
  return apiClient<{ checkout_time: string }>(`/bookings/${bookingId}/check-out`, {
    method: 'POST',
    body: JSON.stringify(minimalCareReport),
  });
}

