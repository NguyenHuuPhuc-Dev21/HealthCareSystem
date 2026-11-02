import { apiClient } from '../../lib/api-client';

export async function getPaymentLink(bookingId: string) {
  return apiClient<{ checkout_url: string; qr_code: string }>(`/bookings/${bookingId}/payment-link`);
}

