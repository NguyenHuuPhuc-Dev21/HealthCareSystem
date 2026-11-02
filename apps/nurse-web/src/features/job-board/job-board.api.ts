import { apiClient } from '../../lib/api-client';

export async function getJobBoard() {
  return apiClient<any[]>('/nurse/job-board');
}

export async function acceptJob(bookingId: string) {
  return apiClient<{ success: boolean; booking_id: string }>(`/bookings/${bookingId}/accept`, {
    method: 'POST',
  });
}

