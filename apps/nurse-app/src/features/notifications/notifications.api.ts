import type {
  GetNotificationsQuery,
  NotificationDto,
  NotificationsListResponse,
} from '@healthcare-system/shared';
import { apiClient, getAuthToken, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import { NOTIFICATION_CONFIG, NOTIFICATION_LABELS } from './notification-labels';
import * as mockNotifs from './notifications.mock';

export async function getNotifications(
  query?: GetNotificationsQuery
): Promise<ApiResponse<NotificationsListResponse>> {
  if (env.useMockNotifications) {
    try {
      const data = await mockNotifs.mockGetNotifications(query);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as NotificationsListResponse,
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || NOTIFICATION_LABELS.errorLoadFallback,
        },
      };
    }
  }

  const params: string[] = [];
  if (query?.cursor) params.push(`cursor=${encodeURIComponent(query.cursor)}`);
  if (query?.limit) params.push(`limit=${encodeURIComponent(String(query.limit))}`);
  if (query?.unreadOnly) params.push('unreadOnly=true');
  const qs = params.length > 0 ? `?${params.join('&')}` : '';

  return apiClient<NotificationsListResponse>(`/notifications${qs}`);
}

export async function markRead(
  id: string
): Promise<ApiResponse<{ success: boolean }>> {
  if (env.useMockNotifications) {
    await mockNotifs.mockMarkRead(id);
    return { success: true, data: { success: true } };
  }

  return apiClient<{ success: boolean }>(`/notifications/${id}/read`, {
    method: 'POST',
  });
}

export async function markAllRead(): Promise<ApiResponse<{ success: boolean }>> {
  if (env.useMockNotifications) {
    await mockNotifs.mockMarkAllRead();
    return { success: true, data: { success: true } };
  }

  return apiClient<{ success: boolean }>('/notifications/read-all', {
    method: 'POST',
  });
}

export async function ackNotification(
  id: string
): Promise<ApiResponse<{ success: boolean }>> {
  if (!id) {
    return { success: true, data: { success: true } };
  }

  if (env.useMockNotifications) {
    const data = await mockNotifs.mockAckNotification(id);
    return { success: true, data };
  }

  const res = await apiClient<{ success: boolean }>(`/notifications/${id}/ack`, {
    method: 'POST',
  });
  if (!res.success && res.error?.code === 'HTTP_404') {
    return { success: true, data: { success: true } };
  }
  return res;
}

export function subscribeNotifications(
  onNew: (notif: NotificationDto) => void
): () => void {
  if (env.useMockNotifications) {
    return mockNotifs.subscribeToMockNotifications(onNew);
  }

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closedIntentionally = false;
  let reconnectAttempts = 0;

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() }));
        } catch {
          // Ignore heartbeat error
        }
      }
    }, NOTIFICATION_CONFIG.WS_HEARTBEAT_INTERVAL_MS);
  };

  const connect = async () => {
    if (closedIntentionally) return;
    try {
      const token = await getAuthToken();
      const baseWsUrl = env.apiBaseUrl.replace(/^http/, 'ws');
      const wsUrl = `${baseWsUrl}/ws/notifications?token=${encodeURIComponent(
        token || ''
      )}`;

      const socket = new WebSocket(wsUrl);
      ws = socket;

      socket.onopen = () => {
        reconnectAttempts = 0;
        startHeartbeat();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          const notif: NotificationDto | undefined =
            data?.type === 'NEW_NOTIFICATION'
              ? data.notification || data.payload
              : data?.id && data?.type
              ? data
              : undefined;
          if (notif) {
            onNew(notif);
          }
        } catch {
          // Ignore malformed message
        }
      };

      socket.onerror = () => {
        // Handled in onclose
      };

      socket.onclose = () => {
        stopHeartbeat();
        if (
          !closedIntentionally &&
          reconnectAttempts < NOTIFICATION_CONFIG.WS_MAX_RECONNECT_ATTEMPTS
        ) {
          const delay = Math.min(
            NOTIFICATION_CONFIG.WS_RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts),
            NOTIFICATION_CONFIG.WS_RECONNECT_MAX_MS
          );
          reconnectAttempts += 1;
          reconnectTimer = setTimeout(() => {
            void connect();
          }, delay);
        }
      };
    } catch {
      // Ignore connection setup error
    }
  };

  void connect();

  return () => {
    closedIntentionally = true;
    stopHeartbeat();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      try {
        ws.close();
      } catch {
        // Ignore close error
      }
      ws = null;
    }
  };
}
