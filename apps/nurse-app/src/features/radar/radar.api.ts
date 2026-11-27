import type { ClaimJobResult, RadarJob } from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import {
  mockAckNotification,
  mockClaimRadar,
  mockDeclineRadar,
  mockGetOnlineStatus,
  mockGetRadarOffers,
  mockRegisterDeviceToken,
  mockSetOnline,
  mockUnregisterDeviceToken,
} from './radar.mock';

export async function getRadarOffers(): Promise<ApiResponse<RadarJob | null>> {
  if (env.useMockJobBoard) {
    const offer = await mockGetRadarOffers();
    return { success: true, data: offer };
  }

  const res = await apiClient<RadarJob | null>('/nurse/radar');
  return { success: res.success, data: res.data ?? null, error: res.error };
}

export async function claimRadar(
  id: string,
  nurseTier = 'TIER_1_BASIC',
  depositBalance?: number
): Promise<ClaimJobResult> {
  if (env.useMockJobBoard) {
    return mockClaimRadar(id, nurseTier, { depositBalance });
  }

  const res = await apiClient<{ success: boolean; booking_id?: string }>(
    `/bookings/${id}/claim-radar`,
    {
      method: 'POST',
      body: JSON.stringify({ nurseTier, depositBalance }),
    }
  );

  if (!res.success) {
    return {
      success: false,
      errorCode: (res.error?.code as any) || 'ALREADY_CLAIMED',
      message: res.error?.message || 'Ca đã được nhận bởi người khác hoặc hết hạn.',
    };
  }

  return {
    success: true,
    bookingId: res.data?.booking_id || id,
  };
}

export async function declineRadar(id: string): Promise<{ success: boolean }> {
  if (env.useMockJobBoard) {
    return mockDeclineRadar(id);
  }

  const res = await apiClient<{ success: boolean }>(`/bookings/${id}/dismiss-radar`, {
    method: 'POST',
  });
  return { success: res.success };
}

export async function registerDeviceToken(
  fcmToken: string,
  platform: 'android' | 'ios' = 'android'
): Promise<{ success: boolean }> {
  if (env.useMockJobBoard) {
    return mockRegisterDeviceToken(fcmToken, platform);
  }

  try {
    const res = await apiClient<{ success: boolean }>('/devices', {
      method: 'POST',
      body: JSON.stringify({ fcmToken, platform }),
    });
    if (!res.success && res.error?.code === 'HTTP_404') {
      return { success: true };
    }
    return { success: res.success };
  } catch {
    return { success: false };
  }
}

export async function unregisterDeviceToken(token: string): Promise<{ success: boolean }> {
  if (env.useMockJobBoard) {
    return mockUnregisterDeviceToken(token);
  }

  try {
    const res = await apiClient<{ success: boolean }>(`/devices/${encodeURIComponent(token)}`, {
      method: 'DELETE',
    });
    if (!res.success && res.error?.code === 'HTTP_404') {
      return { success: true };
    }
    return { success: res.success };
  } catch {
    return { success: false };
  }
}

export async function ackNotification(id: string): Promise<{ success: boolean }> {
  if (!id) return { success: true };

  if (env.useMockJobBoard) {
    return mockAckNotification(id);
  }

  try {
    const res = await apiClient<{ success: boolean }>(`/notifications/${id}/ack`, {
      method: 'POST',
    });
    if (!res.success && res.error?.code === 'HTTP_404') {
      return { success: true };
    }
    return { success: res.success };
  } catch {
    return { success: false };
  }
}

export async function setOnline(isOnline: boolean): Promise<{ success: boolean }> {
  if (env.useMockJobBoard) {
    return mockSetOnline(isOnline);
  }

  try {
    const res = await apiClient<{ success: boolean }>('/nurse/me', {
      method: 'PATCH',
      body: JSON.stringify({ isOnline }),
    });
    if (!res.success && res.error?.code === 'HTTP_404') {
      return { success: true };
    }
    return { success: res.success };
  } catch {
    return { success: false };
  }
}

export async function getOnlineStatus(): Promise<boolean> {
  return mockGetOnlineStatus();
}
