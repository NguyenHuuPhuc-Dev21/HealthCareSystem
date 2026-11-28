/**
 * notifications — in-app notification centre + the shared notifier (BE-3 · Phase 6 · FR-NOTIF-01, TC-NFR-01).
 * Contract: docs/api/notifications.api.md
 *
 *  GET  /notifications?cursor=&limit=&unreadOnly=   newest first, keyset cursor; totalUnread
 *  GET  /notifications/unread-count
 *  POST /notifications/:id/read                      read + acknowledged (the whole event → no SMS fallback)
 *  POST /notifications/:id/ack                       same, for the mobile app acknowledging a push
 *  POST /notifications/read-all
 *  WS   /ws/notifications                            NEW_NOTIFICATION messages (notifications.socket.ts)
 *
 * notifyUser() is what other modules use: core/notifications stores one row per channel (IN_APP, PUSH_FCM),
 * pushes the in-app row to the user's sockets, and for HIGH priority schedules the 60 s SMS fallback job.
 */
import { NotificationPriority } from '@healthcare-system/shared';
import { getPool, query, type Queryable } from '../../core/database';
import { badRequest, notFound } from '../../core/errors';
import { jobs } from '../../core/jobs';
import { createNotificationService, maskPhone, type NotificationService, type PushMessage, type PushProvider, type SmsMessage, type SmsProvider } from '../../core/notifications';
import { PubSubRealtimeGateway } from './notifications.realtime';
import * as repo from './notifications.repo';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  UNTYPED_NOTIFICATION,
  type InboxItemDto,
  type InboxPage,
  type InboxQuery,
  type InboxRow,
  type LegacyNotice,
  type Notice,
  type Notify,
} from './notifications.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** created_at with microseconds (JS Date only keeps ms, so the cursor carries PostgreSQL's text). */
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

// ---- keyset cursor ------------------------------------------------------------------------------

export function encodeCursor(row: Pick<InboxRow, 'at_text' | 'id'>): string {
  return Buffer.from(`${row.at_text}|${row.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { at: string; id: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const i = raw.lastIndexOf('|');
  const at = raw.slice(0, i);
  const id = raw.slice(i + 1);
  if (i <= 0 || !UUID_RE.test(id) || !TIMESTAMP_RE.test(at)) {
    throw badRequest('INVALID_CURSOR', 'Invalid cursor');
  }
  return { at, id };
}

export function toItem(r: InboxRow): InboxItemDto {
  const data: Record<string, string> = { ...(r.data ?? {}) };
  if (r.booking_id && !data.bookingId) data.bookingId = r.booking_id;
  return {
    id: r.id,
    type: r.type ?? UNTYPED_NOTIFICATION,
    priority: r.priority,
    title: r.title,
    body: r.body ?? '',
    data,
    readAt: r.is_read ? new Date(r.read_at ?? r.created_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

// ---- inbox --------------------------------------------------------------------------------------

export interface NotificationsDeps {
  read: Queryable;
}

export class NotificationsService {
  constructor(private readonly deps: NotificationsDeps) {}

  async list(userId: string, q: InboxQuery = {}): Promise<InboxPage> {
    const limit = Math.min(Math.max(Math.trunc(q.limit ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
    const before = q.cursor ? decodeCursor(q.cursor) : null;
    const rows = await repo.listInbox(this.deps.read, userId, { before, limit: limit + 1, unreadOnly: q.unreadOnly === true });
    const page = rows.slice(0, limit);
    return {
      items: page.map(toItem),
      nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
      totalUnread: await repo.countUnread(this.deps.read, userId),
    };
  }

  async unreadCount(userId: string): Promise<{ totalUnread: number }> {
    return { totalUnread: await repo.countUnread(this.deps.read, userId) };
  }

  /** Read and acknowledged, with the push row of the same event (stops the 60 s SMS fallback). */
  async markRead(userId: string, notificationId: string): Promise<{ success: true }> {
    if ((await repo.markEventRead(this.deps.read, userId, notificationId)) === 0) {
      throw notFound('NOTIFICATION_NOT_FOUND', 'Notification not found'); // someone else's → same answer
    }
    return { success: true };
  }

  async markAllRead(userId: string): Promise<{ success: true; updated: number }> {
    return { success: true, updated: await repo.markAllRead(this.deps.read, userId) };
  }
}

let singleton: NotificationsService | null = null;

export function getNotificationsService(): NotificationsService {
  if (!singleton) singleton = new NotificationsService({ read: { query } });
  return singleton;
}

// ---- delivery providers -----------------------------------------------------------------------

/**
 * FCM and the SMS/ZNS gateway are not contracted for the MVP demo: delivery is logged (masked) and the rows
 * are stored exactly as with the real adapters. A real adapter implements PushProvider / SmsProvider from
 * core/notifications and is selected here (e.g. NOTIFICATIONS_PUSH_PROVIDER=fcm) — nothing else changes.
 */
export class LoggingPushProvider implements PushProvider {
  async send(m: PushMessage): Promise<void> {
    console.log(`[notifications] push (simulated FCM, ${m.priority}) → user ${m.userId}: ${m.title}`);
  }
}

export class LoggingSmsProvider implements SmsProvider {
  async send(m: SmsMessage): Promise<void> {
    console.log(`[notifications] SMS fallback (simulated) → ${maskPhone(m.to)} for notification ${m.notificationId}`);
  }
}

// ---- the shared notifier ------------------------------------------------------------------------

let dispatcher: NotificationService | null = null;

/**
 * One dispatcher per process. Creating it registers the SMS fallback job handler on the shared queue, so the
 * worker must call it at start (registerNotificationsJobs) even before anything is sent.
 */
export function getNotificationDispatcher(): NotificationService {
  if (!dispatcher) {
    dispatcher = createNotificationService({
      db: getPool(),
      push: new LoggingPushProvider(),
      sms: new LoggingSmsProvider(),
      realtime: new PubSubRealtimeGateway(),
      scheduler: jobs,
    });
  }
  return dispatcher;
}

/** Stores and delivers one notice. Throws on invalid input or DB failure; callers use sendNotices(). */
export const notifyUser: Notify = async (n: Notice) => {
  await getNotificationDispatcher().dispatch({
    userId: n.userId,
    bookingId: n.bookingId ?? null,
    title: n.title.length > 200 ? `${n.title.slice(0, 199)}…` : n.title,
    body: n.body,
    priority: n.priority ?? NotificationPriority.NORMAL,
    type: n.type,
    data: n.data,
  });
};

/** Adapter for modules written before this one (booking-expiry, shift-extend…): notice without a type. */
export function legacyNotify(type: string, notify: Notify = notifyUser): (n: LegacyNotice) => Promise<void> {
  return (n) => notify({ userId: n.userId, bookingId: n.bookingId ?? null, type, title: n.title, body: n.body ?? '' });
}

/**
 * Sends after the business transaction committed. A notification failure never undoes or fails the
 * business change: it is logged and the rest are still sent.
 */
export async function sendNotices(notify: Notify | undefined, notices: Notice[]): Promise<void> {
  if (!notify) return;
  for (const n of notices) {
    try {
      await notify(n);
    } catch (err) {
      console.warn(`[notifications] ${n.type} to ${n.userId} not sent: ${(err as Error).message}`);
    }
  }
}
