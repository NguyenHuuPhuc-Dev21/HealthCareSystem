/**
 * Core Notifications Dispatcher (BE-3)
 * SRS §4.6 FR-NOTIF-01, TC-NFR-01, test strategy "Push-fallback watcher".
 *  - dispatch(): mỗi kênh 1 dòng trong `notifications`, rồi gửi đi.
 *  - Cảnh báo HIGH đăng ký job trên hàng đợi chung (KHÔNG setTimeout).
 *    Sau 60s chưa ack -> gửi ĐÚNG 1 SMS_FALLBACK, kể cả khi job chạy lại
 *    hoặc 2 worker chạy cùng lúc.
 *  - acknowledge(): ghi acked_at; chỉ chủ thông báo mới ack được.
 */

import {
  DeliveryStatus,
  NotificationChannel,
  NotificationPriority,
} from "@healthcare-system/shared";
import type { SqlExecutor } from "../audit";
import type { PushProvider, RealtimeGateway, SmsProvider } from "./providers";

export * from "./providers";

// MỚI (Bước 6): mốc 60 giây và tên job
export const URGENT_ACK_TIMEOUT_MS = 60_000;
export const URGENT_FALLBACK_JOB = "notifications.urgent-sms-fallback";

// MỚI (Bước 6): pool có thể cấp 1 kết nối riêng cho transaction (pg.Pool)
export interface TransactionalDb extends SqlExecutor {
  connect(): Promise<SqlExecutor & { release(): void }>;
}

// MỚI (Bước 6): phần của hàng đợi chung (core/jobs, Dev B) mà module này dùng
export interface JobScheduler {
  registerHandler<T>(
    jobName: string,
    handler: (payload: T) => Promise<void>,
  ): void;
  schedule<T>(
    jobName: string,
    payload: T,
    options: { idempotencyKey: string; delayMs?: number },
  ): Promise<string>;
}

export type DeliverableChannel =
  | NotificationChannel.PUSH_FCM
  | NotificationChannel.IN_APP;

export interface DispatchInput {
  userId: string;
  bookingId?: string | null;
  title: string;
  body?: string | null;
  priority?: NotificationPriority;
  /** Mặc định gửi cả PUSH_FCM và IN_APP. */
  channels?: DeliverableChannel[];
  /** Dữ liệu điều hướng cho push. KHÔNG chứa thông tin lâm sàng. */
  data?: Record<string, string>;
}

export interface DispatchedNotification {
  id: string;
  channel: DeliverableChannel;
  deliveryStatus: DeliveryStatus;
}

export interface DispatchResult {
  notifications: DispatchedNotification[];
  /** MỚI (Bước 6): khóa của job 60s, hoặc null với NORMAL */
  fallbackJobKey: string | null;
}

// MỚI (Bước 6): các kết quả có thể có của job fallback
export type FallbackOutcome =
  | "NOT_FOUND"
  | "NOT_URGENT"
  | "ACKNOWLEDGED"
  | "ALREADY_SENT"
  | "SENT"
  | "FAILED";

export interface NotificationServiceDeps {
  db: TransactionalDb; // MỚI (Bước 6): cần connect() cho transaction
  push: PushProvider;
  sms: SmsProvider;
  realtime: RealtimeGateway;
  scheduler: JobScheduler; // MỚI (Bước 6)
  /** Chỉ đổi trong test; production dùng URGENT_ACK_TIMEOUT_MS */
  ackTimeoutMs?: number; // MỚI (Bước 6)
}

export class NotificationValidationError extends Error {
  readonly code = "NOTIFICATION_VALIDATION_ERROR";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 200;

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

// MỚI (Bước 6): khóa dòng thông báo gốc + lấy số điện thoại người nhận
const LOCK_SOURCE_SQL = `
  SELECT n.id, n.user_id, n.booking_id, n.title, n.body, n.priority, n.acked_at, u.phone
    FROM notifications n
    JOIN users u ON u.id = n.user_id
   WHERE n.id = $1
     FOR UPDATE OF n`;

// MỚI (Bước 6): đã có SMS cho cảnh báo này chưa?
// Schema chưa có cột "thông báo cha", nên nhận diện SMS bằng
// chủ + booking + tiêu đề, tạo sau dòng gốc. Khóa dòng ở trên đảm bảo
// các lần chạy song song phải xếp hàng.
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
    throw new NotificationValidationError("userId must be a UUID");
  }
  if (input.bookingId != null && !UUID_RE.test(input.bookingId)) {
    throw new NotificationValidationError("bookingId must be a UUID");
  }
  if (!input.title || input.title.length > MAX_TITLE_LENGTH) {
    throw new NotificationValidationError(
      `title is required and at most ${MAX_TITLE_LENGTH} characters`,
    );
  }
  if (input.channels && input.channels.length === 0) {
    throw new NotificationValidationError("channels must not be empty");
  }
}

// MỚI (Bước 6): chạy fn trong 1 transaction trên 1 kết nối riêng
async function withTransaction<T>(
  db: TransactionalDb,
  fn: (tx: SqlExecutor) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export class NotificationService {
  private readonly ackTimeoutMs: number;

  constructor(private readonly deps: NotificationServiceDeps) {
    this.ackTimeoutMs = deps.ackTimeoutMs ?? URGENT_ACK_TIMEOUT_MS;
  }

  /** MỚI (Bước 6): gọi 1 lần lúc khởi động để hàng đợi biết cách chạy job fallback. */
  registerJobs(): void {
    this.deps.scheduler.registerHandler<{ notificationId: string }>(
      URGENT_FALLBACK_JOB,
      async (payload) => {
        await this.runUrgentFallback(payload.notificationId);
      },
    );
  }

  async dispatch(
    input: DispatchInput,
    executor: SqlExecutor = this.deps.db,
  ): Promise<DispatchResult> {
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
          await this.deps.push.send({
            userId: input.userId,
            notificationId: id,
            title: input.title,
            body,
            priority,
            data: input.data,
          });
        } else {
          await this.deps.realtime.emitToUser(input.userId, "notification", {
            notificationId: id,
            title: input.title,
            body,
            priority,
            bookingId,
          });
        }
      } catch (err) {
        status = DeliveryStatus.FAILED;
        console.error(
          `[Core/Notifications] ${channel} delivery failed for notification ${id}: ${(err as Error).message}`,
        );
      }

      await executor.query(SET_STATUS_SQL, [id, status]);
      delivered.push({ id, channel, deliveryStatus: status });
    }

    // MỚI (Bước 6): cảnh báo khẩn -> đăng ký job kiểm tra sau 60s
    let fallbackJobKey: string | null = null;
    if (priority === NotificationPriority.HIGH) {
      // Theo dõi dòng PUSH_FCM (điện thoại là nơi người dùng ack), không có thì dòng đầu tiên
      const watched =
        delivered.find((n) => n.channel === NotificationChannel.PUSH_FCM) ??
        delivered[0];
      fallbackJobKey = `notif-fallback:${watched.id}`;
      await this.deps.scheduler.schedule(
        URGENT_FALLBACK_JOB,
        { notificationId: watched.id },
        { idempotencyKey: fallbackJobKey, delayMs: this.ackTimeoutMs },
      );
    }

    return { notifications: delivered, fallbackJobKey };
  }

  async acknowledge(notificationId: string, userId: string): Promise<boolean> {
    if (!UUID_RE.test(notificationId) || !UUID_RE.test(userId)) return false;
    const { rows } = await this.deps.db.query(ACK_SQL, [
      notificationId,
      userId,
    ]);
    return rows.length === 1;
  }

  /**
   * MỚI (Bước 6) — thân của job: gửi SMS dự phòng nếu cảnh báo khẩn vẫn chưa ack.
   * Chạy bao nhiêu lần cũng an toàn.
   */
  async runUrgentFallback(notificationId: string): Promise<FallbackOutcome> {
    // Phần quyết định nằm TRONG transaction có khóa dòng
    const decision = await withTransaction(this.deps.db, async (tx) => {
      const { rows } = await tx.query(LOCK_SOURCE_SQL, [notificationId]);
      const source = rows[0];
      if (!source) return { outcome: "NOT_FOUND" as const };
      if (source.priority !== NotificationPriority.HIGH)
        return { outcome: "NOT_URGENT" as const };
      if (source.acked_at !== null) return { outcome: "ACKNOWLEDGED" as const };

      const existing = await tx.query(EXISTING_FALLBACK_SQL, [
        source.user_id,
        source.booking_id,
        source.title,
        notificationId,
      ]);
      if (existing.rows.length > 0) return { outcome: "ALREADY_SENT" as const };

      const inserted = await tx.query(INSERT_NOTIFICATION_SQL, [
        source.user_id,
        source.booking_id,
        source.title,
        source.body,
        NotificationChannel.SMS_FALLBACK,
        NotificationPriority.HIGH,
      ]);
      return {
        outcome: "SEND" as const,
        smsId: inserted.rows[0].id as string,
        source,
      };
    });

    if (decision.outcome !== "SEND") return decision.outcome;

    // Gửi SMS SAU khi commit (không giữ khóa DB trong lúc chờ nhà mạng)
    const { smsId, source } = decision;
    const text = source.body ? `${source.title}: ${source.body}` : source.title;
    try {
      await this.deps.sms.send({
        userId: source.user_id,
        notificationId: smsId,
        to: source.phone,
        text,
      });
      await this.deps.db.query(SET_STATUS_SQL, [smsId, DeliveryStatus.SENT]);
      return "SENT";
    } catch (err) {
      await this.deps.db.query(SET_STATUS_SQL, [smsId, DeliveryStatus.FAILED]);
      console.error(
        `[Core/Notifications] SMS fallback failed for notification ${smsId}: ${(err as Error).message}`,
      );
      return "FAILED";
    }
  }
}

export function createNotificationService(
  deps: NotificationServiceDeps,
): NotificationService {
  const service = new NotificationService(deps);
  service.registerJobs(); // MỚI (Bước 6)
  return service;
}
