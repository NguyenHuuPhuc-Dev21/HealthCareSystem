import { apiClient } from '../../lib/api-client';

export async function getCommissionPaymentLink(bookingId: string) {
  return apiClient<{ checkout_url: string; qr_code: string; due_time: string }>(
    `/bookings/${bookingId}/commission-payment-link`,
    { method: 'POST' }
  );
}

