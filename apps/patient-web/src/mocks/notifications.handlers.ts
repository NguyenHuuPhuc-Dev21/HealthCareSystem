/**
 * Mock thông báo — khớp docs/api/notifications.api.md.
 *   GET  /notifications?cursor&limit&unreadOnly → { items, nextCursor, totalUnread }
 *   GET  /notifications/unread-count
 *   POST /notifications/:id/read · POST /notifications/read-all
 * Các mock khác (khiếu nại, chat…) thêm thông báo bằng `pushMockNotification`.
 * Mock không có WebSocket nên giao diện dùng polling dự phòng.
 */

import type { NotificationDto } from '../features/notifications/notifications.api';
import { unauthorized } from './booking.handlers';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function seed(): NotificationDto[] {
  return [
    {
      id: 'n-seed-5', type: 'DISPUTE_UPDATED', priority: 'NORMAL', title: 'Điều dưỡng đã phản hồi khiếu nại',
      body: 'Điều dưỡng gửi giải trình cho khiếu nại ca HC-2026-1042. Admin sẽ xem xét.',
      data: { disputeId: 'disp-seed-1', bookingId: 'b-1042', bookingCode: 'HC-2026-1042' }, readAt: null, createdAt: ago(25),
    },
    {
      id: 'n-seed-4', type: 'NEW_MESSAGE', priority: 'NORMAL', title: 'Tin nhắn mới từ điều dưỡng',
      body: 'Bạn có tin nhắn mới trong ca HC-2026-1060.',
      data: { conversationId: 'b-live', bookingId: 'b-live', bookingCode: 'HC-2026-1060' }, readAt: null, createdAt: ago(90),
    },
    {
      id: 'n-seed-3', type: 'BOOKING_EXPIRED', priority: 'NORMAL', title: 'Ca đặt đã hết hạn',
      body: 'Ca HC-2026-1020 không được thanh toán/nhận kịp nên đã hết hạn. Chưa có khoản tiền nào bị trừ.',
      data: { bookingCode: 'HC-2026-1020' }, readAt: null, createdAt: ago(60 * 26),
    },
    {
      id: 'n-seed-2', type: 'DISPUTE_RESOLVED', priority: 'NORMAL', title: 'Khiếu nại đã được xử lý',
      body: 'Khiếu nại ca HC-2026-0990 được chấp nhận. Khoản tiền đang tạm giữ được hoàn 100% cho bạn.',
      data: { disputeId: 'disp-seed-2', bookingCode: 'HC-2026-0990' }, readAt: ago(60 * 70), createdAt: ago(60 * 72),
    },
    {
      id: 'n-seed-1', type: 'SOS_CLOSED', priority: 'HIGH', title: 'Cảnh báo khẩn cấp đã được đóng',
      body: 'Admin đã đóng cảnh báo SOS của ca HC-2026-0975 (xử lý tại chỗ).',
      data: { bookingCode: 'HC-2026-0975' }, readAt: ago(60 * 120), createdAt: ago(60 * 121),
    },
  ];
}

export const loadMockNotifications = (userId: string) =>
  getUserData<NotificationDto[]>(userId, 'notifications', userId === 'u-patient-verified' ? seed() : []);

/** Thêm thông báo mới (mới nhất đứng đầu). */
export function pushMockNotification(userId: string, n: Pick<NotificationDto, 'type' | 'title' | 'body' | 'data'> & { priority?: NotificationDto['priority'] }) {
  const list = loadMockNotifications(userId);
  const item: NotificationDto = { id: `n-${Date.now()}-${list.length}`, priority: 'NORMAL', readAt: null, createdAt: new Date().toISOString(), ...n };
  setUserData(userId, 'notifications', [item, ...list]);
}

const unread = (list: NotificationDto[]) => list.filter((n) => !n.readAt).length;

/** Các mock có tiến trình theo thời gian (khiếu nại được điều dưỡng phản hồi…) đăng ký ở đây để thông báo của chúng xuất hiện đúng lúc, giống việc server đẩy thông báo. */
const ticks: Array<(userId: string) => void> = [];
export const registerMockTick = (fn: (userId: string) => void) => {
  ticks.push(fn);
};
const tick = (userId: string) => ticks.forEach((t) => t(userId));

export const notificationHandlers: Record<string, MockHandler> = {
  'GET /api/v1/notifications/unread-count': (_b, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    tick(userId);
    return ok({ totalUnread: unread(loadMockNotifications(userId)) });
  },

  'GET /api/v1/notifications': (_b, { headers, query }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    tick(userId);
    const all = loadMockNotifications(userId);
    const limit = Math.min(Math.max(Number(query.get('limit')) || 20, 1), 50);
    const cursor = query.get('cursor');
    const start = cursor ? Number(cursor) : 0;
    if (cursor && (!Number.isInteger(start) || start < 0)) return fail(400, 'INVALID_CURSOR', 'Con trỏ phân trang không hợp lệ.');
    const pool = query.get('unreadOnly') === 'true' ? all.filter((n) => !n.readAt) : all;
    const items = pool.slice(start, start + limit);
    return ok({ items, nextCursor: start + limit < pool.length ? String(start + limit) : null, totalUnread: unread(all) });
  },

  'POST /api/v1/notifications/read-all': (_b, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const list = loadMockNotifications(userId);
    const updated = unread(list);
    setUserData(userId, 'notifications', list.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })));
    return ok({ success: true, updated });
  },

  'POST /api/v1/notifications/:id/read': (_b, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const list = loadMockNotifications(userId);
    if (!list.some((n) => n.id === params.id)) return fail(404, 'NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo.');
    setUserData(userId, 'notifications', list.map((n) => (n.id === params.id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)));
    return ok({ success: true });
  },
};
