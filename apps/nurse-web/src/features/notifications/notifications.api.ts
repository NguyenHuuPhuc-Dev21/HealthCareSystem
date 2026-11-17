import type {
  GetNotificationsQuery,
  NotificationDto,
  NotificationsListResponse,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { USE_MOCK_NOTIFICATIONS } from '../../lib/mock-flags';
import * as mockNotifs from './notifications.mock';

/**
 * Lấy danh sách thông báo của điều dưỡng (FR-NOTIF-01, W09)
 */
export async function getNotifications(
  query?: GetNotificationsQuery
): Promise<ApiResponse<NotificationsListResponse>> {
  if (USE_MOCK_NOTIFICATIONS) {
    try {
      const data = await mockNotifs.mockGetNotifications(query);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải danh sách thông báo',
        },
      };
    }
  }

  const searchParams = new URLSearchParams();
  if (query?.cursor) searchParams.set('cursor', query.cursor);
  if (query?.limit) searchParams.set('limit', String(query.limit));
  if (query?.unreadOnly) searchParams.set('unreadOnly', 'true');

  const queryString = searchParams.toString();
  const url = `/notifications${queryString ? `?${queryString}` : ''}`;

  return apiClient<NotificationsListResponse>(url);
}

/**
 * Đánh dấu một thông báo là đã đọc
 */
export async function markRead(id: string): Promise<ApiResponse<{ success: boolean }>> {
  if (USE_MOCK_NOTIFICATIONS) {
    await mockNotifs.mockMarkRead(id);
    return { success: true, data: { success: true } };
  }

  return apiClient<{ success: boolean }>(`/notifications/${id}/read`, {
    method: 'POST',
  });
}

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export async function markAllRead(): Promise<ApiResponse<{ success: boolean }>> {
  if (USE_MOCK_NOTIFICATIONS) {
    await mockNotifs.mockMarkAllRead();
    return { success: true, data: { success: true } };
  }

  return apiClient<{ success: boolean }>('/notifications/read-all', {
    method: 'POST',
  });
}

/**
 * Đăng ký nhận thông báo thời gian thực qua WebSocket (hoặc Mock subscriber)
 */
export function subscribeNotifications(
  onNew: (notif: NotificationDto) => void
): () => void {
  if (USE_MOCK_NOTIFICATIONS) {
    return mockNotifs.subscribeToMockNotifications(onNew);
  }

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${
    window.location.host
  }/ws/notifications`;

  let ws: WebSocket | null = null;
  try {
    ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === 'NEW_NOTIFICATION' && data.notification) {
          onNew(data.notification);
        }
      } catch {
        // ignore JSON parse error
      }
    };
  } catch {
    // ws connection error
  }

  return () => {
    if (ws) {
      ws.close();
    }
  };
}

/**
 * Kích hoạt đẩy thông báo mẫu (tiện ích cho kiểm thử thủ công và debug)
 */
export function pushTestNotification(notif: NotificationDto): void {
  if (USE_MOCK_NOTIFICATIONS) {
    mockNotifs.mockPushNotification(notif);
  }
}
