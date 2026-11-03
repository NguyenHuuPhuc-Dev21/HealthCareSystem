/**
 * Core Notifications Dispatcher (BE-3)
 * SRS §4.6 FR-NOTIF-01, TC-NFR-01, test-strategy "Push-fallback watcher".
 *
 *  - dispatch(): stores one `notifications` row per channel (IN_APP for the
 *    in-app centre + WebSocket, PUSH_FCM for the phone) and delivers it.
 *  - Urgent alerts (`priority = HIGH`) register a job on the shared job queue
 *    (no setTimeout, Golden Rule 4). If the user has not acknowledged the
 *    alert after 60 seconds, the job sends ONE SMS_FALLBACK, even when the
 *    job runs twice or two workers race.
 *  - acknowledge(): sets `acked_at`; only the notification's owner can ack.
 */

import {
  DeliveryStatus,
  NotificationChannel,
  NotificationPriority,
} from '@healthcare-system/shared';
import type { SqlExecutor } from '../audit';
import type { PushProvider, RealtimeGateway, SmsProvider } from './providers';

export * from './providers';

/** FR-NOTIF-01 / TC-NFR-01: SMS fallback after 60 s without acknowledgement. */
export const URGENT_ACK_TIMEOUT_MS = 60_000;
export const URGENT_FALLBACK_JOB = 'notifications.urgent-sms-fallback';

/** A pool that can hand out a dedicated client for a transaction (pg.Pool). */
export interface TransactionalDb extends SqlExecutor {
  connect(): Promise<SqlExecutor & { release(): void }>;
}

/**
 * Subset of the shared job queue (core/jobs, BE-2) this module relies on.
 * Matches the agreed internal contract: scheduleJob(jobName, payload, runAt, idempotencyKey).
 */
export interface JobScheduler {
  registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void;
  scheduleJob<T>(jobName: string, payload: T, runAt: Date, idempotencyKey: string): Promise<unknown>;
}

export type DeliverableChannel = NotificationChannel.PUSH_FCM | NotificationChannel.IN_APP;

export interface DispatchInput {
  userId: string;
  bookingId?: string | null;
  title: string;
  body?: string | null;
  priority?: NotificationPriority;
  /** Defaults to both PUSH_FCM and IN_APP. */
  channels?: DeliverableChannel[];
  /** Need-to-know routing data for the push payload. No clinical detail. */
  data?: Record<string, string>;
}

export interface DispatchedNotification {
  id: string;
  channel: DeliverableChannel;
  deliveryStatus: DeliveryStatus;
}

export interface DispatchResult {
  notifications: DispatchedNotification[];
  /** Idempotency key of the 60 s fallback job, or null for NORMAL priority. */
  fallbackJobKey: string | null;
}

export type FallbackOutcome =
  | 'NOT_FOUND'
  | 'NOT_URGENT'
  | 'ACKNOWLEDGED'
  | 'ALREADY_SENT'
  | 'SENT'
  | 'FAILED';

export interface NotificationServiceDeps {
  db: TransactionalDb;
  push: PushProvider;
  sms: SmsProvider;
  realtime: RealtimeGateway;
  scheduler: JobScheduler;
  /** Override only in tests; production uses URGENT_ACK_TIMEOUT_MS. */
  ackTimeoutMs?: number;
  /** Clock used to compute runAt. Tests pass the fake clock; default Date.now. */
  now?: () => number;
}

export class NotificationValidationError extends Error {
  readonly code = 'NOTIFICATION_VALIDATION_ERROR';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 200; // notifications.title VARCHAR(200)

const INSERT_NOTIFICATION_SQL = `
  INSERT INTO notifications (user_id, booking_id, title, body, channel, priority)
  VALUES ($1, $2, $3, $4, $5::notification_channel_enum, $6::notification_priority_enum)
  RETURNING id`;

const SET_STATUS_SQL = `
  UPDATE notifications SET delivery_status = $2::delivery_status_enum WHERE id = $1`;

const ACK_SQL = `
  UPDATE notifications
     SET acked_at = COALESCE(acked_at, now()), is_read = TRUE
   WHERE id = $1 AND user_id = $2
  RETURNING id`;

const LOCK_SOURCE_SQL = `
  SELECT n.id, n.user_id, n.booking_id, n.title, n.body, n.priority, n.acked_at, u.phone
    FROM notifications n
    JOIN users u ON u.id = n.user_id
   WHERE n.id = $1
     FOR UPDATE OF n`;

// The schema has no parent-notification column, so the SMS created for a
// source alert is identified by owner + booking + title, created after the
// source row. The source row lock above serialises concurrent runs.
const EXISTING_FALLBACK_SQL = `
  SELECT 1
    FROM notifications
   WHERE user_id = $1
     AND channel = 'SMS_FALLBACK'
     AND booking_id IS NOT DISTINCT FROM $2
     AND title = $3
     AND created_at >= (SELECT created_at FROM notifications WHERE id = $4)
   LIMIT 1`;

function validateDispatch(input: DispatchInput): void {
  if (!UUID_RE.test(input.userId)) {
    throw new NotificationValidationError('userId must be a UUID');
  }
  if (input.bookingId != null && !UUID_RE.test(input.bookingId)) {
    throw new NotificationValidationError('bookingId must be a UUID');
  }
  if (!input.title || input.title.length > MAX_TITLE_LENGTH) {
    throw new NotificationValidationError(`title is required and at most ${MAX_TITLE_LENGTH} characters`);
  }
  if (input.channels && input.channels.length === 0) {
    throw new NotificationValidationError('channels must not be empty');
  }
}

async function withTransaction<T>(db: TransactionalDb, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export class NotificationService {
  private readonly ackTimeoutMs: number;
  private readonly now: () => number;

  constructor(private readonly deps: NotificationServiceDeps) {
    this.ackTimeoutMs = deps.ackTimeoutMs ?? URGENT_ACK_TIMEOUT_MS;
    this.now = deps.now ?? (() => Date.now());
  }

  /** Call once at bootstrap so the job queue knows how to run the fallback. */
  registerJobs(): void {
    this.deps.scheduler.registerHandler<{ notificationId: string }>(URGENT_FALLBACK_JOB, async (payload) => {
      await this.runUrgentFallback(payload.notificationId);
    });
  }

  /**
   * Stores and delivers a notification.
   *
   * Delivery (push / WebSocket) happens immediately. If you pass a transaction
   * client as `executor`, call dispatch after the business change is final, so
   * users are never alerted about a change that later rolls back.
   */
  async dispatch(input: DispatchInput, executor: SqlExecutor = this.deps.db): Promise<DispatchResult> {
    validateDispatch(input);

    const priority = input.priority ?? NotificationPriority.NORMAL;
    const channels: DeliverableChannel[] = input.channels ?? [
      NotificationChannel.IN_APP,
      NotificationChannel.PUSH_FCM,
    ];
    const bookingId = input.bookingId ?? null;
    const body = input.body ?? null;
    const delivered: DispatchedNotification[] = [];

    for (const channel of new Set(channels)) {
      const { rows } = await executor.query(INSERT_NOTIFICATION_SQL, [
        input.userId,
        bookingId,
        input.title,
        body,
        channel,
        priority,
      ]);
      const id: string = rows[0].id;

      let status = DeliveryStatus.SENT;
      try {
        if (channel === NotificationChannel.PUSH_FCM) {
          await this.deps.push.send({ userId: input.userId, notificationId: id, title: input.title, body, priority, data: input.data });
        } else {
          await this.deps.realtime.emitToUser(input.userId, 'notification', { notificationId: id, title: input.title, body, priority, bookingId });
        }
      } catch (err) {
        status = DeliveryStatus.FAILED;
        console.error(`[Core/Notifications] ${channel} delivery failed for notification ${id}: ${(err as Error).message}`);
      }

      await executor.query(SET_STATUS_SQL, [id, status]);
      delivered.push({ id, channel, deliveryStatus: status });
    }

    let fallbackJobKey: string | null = null;
    if (priority === NotificationPriority.HIGH) {
      // Watch the push row when there is one (that is what the phone acks),
      // otherwise the in-app row.
      const watched = delivered.find((n) => n.channel === NotificationChannel.PUSH_FCM) ?? delivered[0];
      fallbackJobKey = `notif-fallback:${watched.id}`;
      await this.deps.scheduler.scheduleJob(
        URGENT_FALLBACK_JOB,
        { notificationId: watched.id },
        new Date(this.now() + this.ackTimeoutMs),
        fallbackJobKey,
      );
    }

    return { notifications: delivered, fallbackJobKey };
  }

  /**
   * Marks a notification acknowledged (and read) by its owner.
   * Idempotent: acknowledging twice keeps the first acked_at.
   * Returns false when the notification does not exist or belongs to someone else.
   */
  async acknowledge(notificationId: string, userId: string): Promise<boolean> {
    if (!UUID_RE.test(notificationId) || !UUID_RE.test(userId)) return false;
    const { rows } = await this.deps.db.query(ACK_SQL, [notificationId, userId]);
    return rows.length === 1;
  }

  /**
   * Job body: sends the SMS fallback for an urgent alert that is still
   * unacknowledged. Safe to run any number of times.
   */
  async runUrgentFallback(notificationId: string): Promise<FallbackOutcome> {
    const decision = await withTransaction(this.deps.db, async (tx) => {
      const { rows } = await tx.query(LOCK_SOURCE_SQL, [notificationId]);
      const source = rows[0];
      if (!source) return { outcome: 'NOT_FOUND' as const };
      if (source.priority !== NotificationPriority.HIGH) return { outcome: 'NOT_URGENT' as const };
      if (source.acked_at !== null) return { outcome: 'ACKNOWLEDGED' as const };

      const existing = await tx.query(EXISTING_FALLBACK_SQL, [source.user_id, source.booking_id, source.title, notificationId]);
      if (existing.rows.length > 0) return { outcome: 'ALREADY_SENT' as const };

      const inserted = await tx.query(INSERT_NOTIFICATION_SQL, [
        source.user_id,
        source.booking_id,
        source.title,
        source.body,
        NotificationChannel.SMS_FALLBACK,
        NotificationPriority.HIGH,
      ]);
      return { outcome: 'SEND' as const, smsId: inserted.rows[0].id as string, source };
    });

    if (decision.outcome !== 'SEND') return decision.outcome;

    const { smsId, source } = decision;
    const text = source.body ? `${source.title}: ${source.body}` : source.title;
    try {
      await this.deps.sms.send({ userId: source.user_id, notificationId: smsId, to: source.phone, text });
      await this.deps.db.query(SET_STATUS_SQL, [smsId, DeliveryStatus.SENT]);
      return 'SENT';
    } catch (err) {
      await this.deps.db.query(SET_STATUS_SQL, [smsId, DeliveryStatus.FAILED]);
      console.error(`[Core/Notifications] SMS fallback failed for notification ${smsId}: ${(err as Error).message}`);
      return 'FAILED';
    }
  }
}

export function createNotificationService(deps: NotificationServiceDeps): NotificationService {
  const service = new NotificationService(deps);
  service.registerJobs();
  return service;
}
