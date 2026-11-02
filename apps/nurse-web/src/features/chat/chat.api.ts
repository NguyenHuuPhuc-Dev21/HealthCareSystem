import { apiClient } from '../../lib/api-client';

export async function getConversation(bookingId: string) {
  return apiClient<any>(`/bookings/${bookingId}/conversation`);
}

export async function sendMessage(bookingId: string, content: string) {
  return apiClient<any>(`/bookings/${bookingId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

