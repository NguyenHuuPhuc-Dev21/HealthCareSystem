import { apiClient } from '../../lib/api-client';

export interface SosTriggerPayload {
  bookingId: string;
  latitude: number;
  longitude: number;
  currentVitals?: Record<string, unknown>;
}

export async function triggerSos(payload: SosTriggerPayload) {
  return apiClient<{ triggered: boolean; emergency_id: string }>(
    `/bookings/${payload.bookingId}/sos`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

