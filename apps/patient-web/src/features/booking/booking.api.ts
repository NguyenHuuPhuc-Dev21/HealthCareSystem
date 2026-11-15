import { apiClient } from '../../lib/api-client';

export async function createBooking(data: any) {
  return apiClient<{ booking_id: string; payment_hold_expires_at: string }>('/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

