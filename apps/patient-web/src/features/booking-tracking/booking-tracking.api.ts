import { apiClient } from '../../lib/api-client';

export async function getBookingTracking(bookingId: string) {
  return apiClient<any>(`/bookings/${bookingId}/tracking`);
}

