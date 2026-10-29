import { apiClient } from '../../lib/api-client';

export async function submitCustomerRating(bookingId: string, rating: number, comment?: string) {
  return apiClient<{ review_id: string }>(`/bookings/${bookingId}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  });
}

