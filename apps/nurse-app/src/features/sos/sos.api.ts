import { apiClient, ApiResponse } from '../../lib/api-client';
import { enqueueAction, isNetworkConnected } from '../active-shift/offline-queue';

export interface SosTriggerPayload {
  bookingId: string;
  latitude: number;
  longitude: number;
  currentVitals?: Record<string, unknown>;
}

export interface SosResponseData {
  triggered: boolean;
  emergency_id: string;
}

export interface SosResult extends ApiResponse<SosResponseData> {
  isOfflineQueued?: boolean;
}

export async function triggerSos(payload: SosTriggerPayload): Promise<SosResult> {
  const online = await isNetworkConnected();

  if (!online) {
    await enqueueAction({
      bookingId: payload.bookingId,
      type: 'TRIGGER_SOS',
      payload,
    });
    return {
      success: true,
      isOfflineQueued: true,
      data: { triggered: true, emergency_id: `offline_emergency_${Date.now()}` },
    };
  }

  try {
    const res = await apiClient<SosResponseData>(
      `/bookings/${payload.bookingId}/sos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!res.success && (!res.error?.code || res.error?.code === 'NETWORK_ERROR')) {
      await enqueueAction({
        bookingId: payload.bookingId,
        type: 'TRIGGER_SOS',
        payload,
      });
      return {
        success: true,
        isOfflineQueued: true,
        data: { triggered: true, emergency_id: `offline_emergency_${Date.now()}` },
      };
    }

    return res;
  } catch {
    await enqueueAction({
      bookingId: payload.bookingId,
      type: 'TRIGGER_SOS',
      payload,
    });
    return {
      success: true,
      isOfflineQueued: true,
      data: { triggered: true, emergency_id: `offline_emergency_${Date.now()}` },
    };
  }
}
