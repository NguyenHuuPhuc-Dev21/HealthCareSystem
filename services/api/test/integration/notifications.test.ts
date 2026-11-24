import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { WebSocket } from 'ws';
import { NotificationPriority, UserRole } from '@healthcare-system/shared';
import { MockPushProvider, MockSmsProvider, URGENT_ACK_TIMEOUT_MS, createNotificationService, type NotificationService } from '../../src/core/notifications';
import { LocalRealtimeHub, PubSubRealtimeGateway } from '../../src/modules/notifications/notifications.realtime';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { attachNotificationSocket, type NotificationSocket } from '../../src/modules/notifications/notifications.socket';
import { FakeClockScheduler, createTestPool, createTestUser } from './helpers';

/**
 * notifications (BE-3 · Phase 6 · FR-NOTIF-01, TC-NFR-01) trên PostgreSQL 16 thật (migration 0001 → 0023):
 *  - mỗi lần gửi: 1 dòng IN_APP + 1 dòng PUSH_FCM cùng event_id, có type + data; hộp thư chỉ hiện IN_APP;
 *  - danh sách mới nhất trước, phân trang bằng cursor, lọc chưa đọc, totalUnread;
 *  - đọc dòng IN_APP = xác nhận cả sự kiện → job SMS 60 giây không gửi; không đọc → gửi đúng 1 SMS;
 *  - WebSocket /ws/notifications: đúng người nhận, đúng DTO; token sai → 401.
 */
describe('notifications (integration)', () => {
  let pool: Pool;
  let inbox: NotificationsService;
  let hub: LocalRealtimeHub;
  let scheduler: FakeClockScheduler;
  let sms: MockSmsProvider;
  let dispatcher: NotificationService;

  beforeAll(() => {
    pool = createTestPool();
    inbox = new NotificationsService({ read: pool });
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(() => {
    hub = new LocalRealtimeHub();
    scheduler = new FakeClockScheduler();
    sms = new MockSmsProvider();
    dispatcher = createNotificationService({
      db: pool,
      push: new MockPushProvider(),
      sms,
      realtime: new PubSubRealtimeGateway(hub, null),
      scheduler,
      now: () => scheduler.now,
    });
  });

  const send = (userId: string, i: number, priority = NotificationPriority.NORMAL) =>
    dispatcher.dispatch({ userId, title: `Thông báo ${i}`, body: `Nội dung ${i}`, type: 'SETTLEMENT_DONE', priority, data: { withdrawalId: `w${i}` } });

  it('stores one event per channel; the centre lists the in-app rows, newest first, with cursor paging and unread filter', async () => {
    const user = await createTestUser(pool);
    for (let i = 1; i <= 5; i += 1) await send(user, i);

    const events = await pool.query(`SELECT count(DISTINCT event_id)::int AS e, count(*)::int AS n FROM notifications WHERE user_id = $1`, [user]);
    expect(events.rows[0]).toEqual({ e: 5, n: 10 });

    const p1 = await inbox.list(user, { limit: 2 });
    expect(p1.items.map((n) => n.title)).toEqual(['Thông báo 5', 'Thông báo 4']);
    expect(p1.items[0]).toMatchObject({ type: 'SETTLEMENT_DONE', priority: 'NORMAL', body: 'Nội dung 5', data: { withdrawalId: 'w5' }, readAt: null });
    expect(p1.totalUnread).toBe(5);
    const p2 = await inbox.list(user, { limit: 2, cursor: p1.nextCursor! });
    const p3 = await inbox.list(user, { limit: 2, cursor: p2.nextCursor! });
    expect([...p2.items, ...p3.items].map((n) => n.title)).toEqual(['Thông báo 3', 'Thông báo 2', 'Thông báo 1']);
    expect(p3.nextCursor).toBeNull();

    await inbox.markRead(user, p1.items[0].id);
    const unread = await inbox.list(user, { unreadOnly: true });
    expect(unread.items.map((n) => n.title)).toEqual(['Thông báo 4', 'Thông báo 3', 'Thông báo 2', 'Thông báo 1']);
    expect(unread.totalUnread).toBe(4);
    expect((await inbox.list(user, { limit: 1 })).items[0].readAt).not.toBeNull();

    expect(await inbox.markAllRead(user)).toMatchObject({ success: true });
    expect(await inbox.unreadCount(user)).toEqual({ totalUnread: 0 });
    await expect(inbox.list(user, { cursor: 'rác' })).rejects.toMatchObject({ status: 400 });
  });

  it('reading the in-app row acknowledges the event: no SMS after 60 s; an unread urgent alert gets exactly one SMS', async () => {
    const user = await createTestUser(pool);
    const other = await createTestUser(pool);
    await send(user, 1, NotificationPriority.HIGH);
    const [read] = (await inbox.list(user)).items;
    await expect(inbox.markRead(other, read.id)).rejects.toMatchObject({ status: 404 });
    await inbox.markRead(user, read.id);

    await send(user, 2, NotificationPriority.HIGH);
    await scheduler.advance(URGENT_ACK_TIMEOUT_MS);
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0].text).toContain('Thông báo 2');

    const rows = await pool.query(
      `SELECT title, channel::text AS c, type, (acked_at IS NOT NULL) AS acked FROM notifications WHERE user_id = $1 ORDER BY created_at, channel`,
      [user],
    );
    expect(rows.rows.filter((r) => r.title === 'Thông báo 1').every((r) => r.acked)).toBe(true);
    expect(rows.rows.find((r) => r.c === 'SMS_FALLBACK')).toMatchObject({ title: 'Thông báo 2', type: 'SETTLEMENT_DONE' });
    expect((await inbox.list(user)).items).toHaveLength(2); // the SMS row is a delivery record, not a new inbox item
  });

  describe('WebSocket /ws/notifications', () => {
    let server: Server;
    let socket: NotificationSocket;
    let base: string;
    let user: string;

    beforeEach(async () => {
      user = await createTestUser(pool);
      server = createServer((_req, res) => res.end());
      socket = attachNotificationSocket(server, { hub, verify: async (t) => (t === `good-${user}` ? { id: user, role: UserRole.PATIENT } : null) });
      await new Promise<void>((r) => server.listen(0, r));
      base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    const close = async () => {
      await socket.close();
      await new Promise<void>((r) => server.close(() => r()));
    };

    function open(url: string, protocols?: string[]): Promise<WebSocket> {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(url, protocols);
        ws.once('open', () => resolve(ws));
        ws.once('error', reject);
        ws.once('unexpected-response', (_req: unknown, res: { statusCode?: number }) => reject(new Error(`HTTP ${res.statusCode}`)));
      });
    }

    it('pushes NEW_NOTIFICATION to the owner only, with the stored id; query token or bearer subprotocol', async () => {
      try {
        const a = await open(`${base}/ws/notifications?access_token=good-${user}`);
        const b = await open(`${base}/api/v1/ws/notifications`, ['bearer', `good-${user}`]);
        expect(b.protocol).toBe('bearer');
        const got = (ws: WebSocket) => new Promise<any>((r) => ws.once('message', (m: unknown) => r(JSON.parse(String(m)))));
        const [ma, mb] = [got(a), got(b)];
        await dispatcher.dispatch({ userId: await createTestUser(pool), title: 'Người khác', type: 'SYSTEM' });
        const r = await dispatcher.dispatch({ userId: user, title: 'Có khiếu nại mới', body: 'Trả lời trong 24 giờ', type: 'DISPUTE_OPENED', priority: NotificationPriority.HIGH, data: { disputeId: 'd1' } });
        const [msgA, msgB] = await Promise.all([ma, mb]);
        const inApp = r.notifications.find((n) => n.channel === 'IN_APP')!;
        expect(msgA).toEqual(msgB);
        expect(msgA).toMatchObject({ type: 'NEW_NOTIFICATION', notification: { id: inApp.id, type: 'DISPUTE_OPENED', priority: 'HIGH', title: 'Có khiếu nại mới', data: { disputeId: 'd1' }, readAt: null } });
        a.close();
        b.close();
      } finally {
        await close();
      }
    });

    it('refuses a missing or wrong token with 401 before the upgrade', async () => {
      try {
        await expect(open(`${base}/ws/notifications`)).rejects.toThrow('HTTP 401');
        await expect(open(`${base}/ws/notifications?access_token=bad`)).rejects.toThrow('HTTP 401');
        expect(socket.clients()).toBe(0);
      } finally {
        await close();
      }
    });
  });
});
