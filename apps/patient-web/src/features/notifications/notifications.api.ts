import { apiClient } from '../../lib/api-client';
import { getAccessToken } from '../../lib/session';

/**
 * Trung tâm thông báo (FR-NOTIF-01) — khớp docs/api/notifications.api.md và
 * packages/shared/src/contracts/notification.contracts.ts.
 * Đọc thông báo = xác nhận đã nhận: backend sẽ không gửi SMS dự phòng cho thông báo khẩn cùng sự kiện.
 */

export type NotificationPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface NotificationDto {
  id: string;
  /** Mở rộng theo từng module (DISPUTE_OPENED, DISPUTE_RESOLVED, SOS, NEW_MESSAGE, BOOKING_EXPIRED…) — luôn có nhánh mặc định khi gặp loại lạ */
  type: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  /** Chỉ chứa mã định tuyến, không có dữ liệu y tế */
  data?: { bookingId?: string; bookingCode?: string; disputeId?: string; conversationId?: string; alertId?: string; [k: string]: unknown };
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  items: NotificationDto[];
  nextCursor: string | null;
  totalUnread: number;
}

/** GET /notifications?cursor&limit&unreadOnly — mới nhất trước. */
export function getNotifications(opts: { cursor?: string | null; limit?: number; unreadOnly?: boolean } = {}) {
  const q = new URLSearchParams();
  if (opts.cursor) q.set('cursor', opts.cursor);
  if (opts.limit) q.set('limit', String(opts.limit));
  if (opts.unreadOnly) q.set('unreadOnly', 'true');
  const qs = q.toString();
  return apiClient<NotificationsPage>(`/notifications${qs ? `?${qs}` : ''}`);
}

export function getUnreadCount() {
  return apiClient<{ totalUnread: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return apiClient<{ success: boolean }>(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead() {
  return apiClient<{ success: boolean; updated: number }>('/notifications/read-all', { method: 'POST' });
}

/**
 * WebSocket nhận thông báo mới (server → client): `{ type: 'NEW_NOTIFICATION', notification }`.
 * Trình duyệt không gắn được header Authorization vào WebSocket nên token đi theo query `access_token`.
 * Trả về hàm huỷ. Mất kết nối thì tự thử lại (giãn dần) — lúc đó provider vẫn có polling dự phòng.
 */
export function subscribeNotifications(onNew: (n: NotificationDto) => void, onStatus?: (connected: boolean) => void): () => void {
  let ws: WebSocket | null = null;
  let timer: number | undefined;
  let attempt = 0;
  let closed = false;

  const connect = () => {
    const token = getAccessToken();
    if (!token || closed) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      ws = new WebSocket(`${proto}//${window.location.host}/ws/notifications?access_token=${encodeURIComponent(token)}`);
    } catch {
      schedule();
      return;
    }
    ws.onopen = () => {
      attempt = 0;
      onStatus?.(true);
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg?.type === 'NEW_NOTIFICATION' && msg.notification) onNew(msg.notification as NotificationDto);
      } catch {
        /* bỏ qua gói không đọc được */
      }
    };
    ws.onclose = () => {
      onStatus?.(false);
      schedule();
    };
    ws.onerror = () => ws?.close();
  };

  const schedule = () => {
    if (closed) return;
    attempt += 1;
    timer = window.setTimeout(connect, Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5)));
  };

  connect();
  return () => {
    closed = true;
    window.clearTimeout(timer);
    ws?.close();
  };
}
