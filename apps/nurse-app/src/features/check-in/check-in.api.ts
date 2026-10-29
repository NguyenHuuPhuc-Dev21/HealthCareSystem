import { apiClient } from '../../lib/api-client';

export interface CheckInPayload {
  bookingId: string;
  latitude: number;
  longitude: number;
  isMockLocation: boolean;
  selfieImage: FormData;
}

export async function submitCheckIn(bookingId: string, formData: FormData) {
  return apiClient<{ execution_status: string; checked_in_at: string }>(
    `/bookings/${bookingId}/check-in`,
    {
      method: 'POST',
      body: formData,
    }
  );
}

