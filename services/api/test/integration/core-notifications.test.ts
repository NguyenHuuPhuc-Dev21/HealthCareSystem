import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import type { Pool } from "pg";
import {
  NotificationChannel,
  NotificationPriority,
} from "@healthcare-system/shared";
import {
  InMemoryRealtimeGateway,
  MockPushProvider,
  MockSmsProvider,
  NotificationService,
  NotificationValidationError,
  URGENT_ACK_TIMEOUT_MS,
  URGENT_FALLBACK_JOB,
  createNotificationService,
} from "../../src/core/notifications";
import {
  FakeClockScheduler,
  createTestPool,
  createTestUser,
  deleteTestUser,
} from "./helpers";

describe("core/notifications với PostgreSQL thật (integration)", () => {
  let pool: Pool;
  let userId: string;
  let otherUserId: string;
  let push: MockPushProvider;
  let sms: MockSmsProvider;
  let realtime: InMemoryRealtimeGateway;
  let scheduler: FakeClockScheduler;
  let service: NotificationService;

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    userId = await createTestUser(pool);
    otherUserId = await createTestUser(pool);
    push = new MockPushProvider();
    sms = new MockSmsProvider();
    realtime = new InMemoryRealtimeGateway();
    scheduler = new FakeClockScheduler();
    service = createNotificationService({
      db: pool,
      push,
      sms,
      realtime,
      scheduler,
    });
  });

  afterEach(async () => {
    await deleteTestUser(pool, userId);
    await deleteTestUser(pool, otherUserId);
  });

  async function rowsFor(user: string) {
    const { rows } = await pool.query(
      `SELECT id, channel, priority, delivery_status, acked_at IS NOT NULL AS acked, is_read
         FROM notifications WHERE user_id = $1 ORDER BY created_at, channel`,
      [user],
    );
    return rows;
  }

  // ---------- Bước 5 ----------

  it("lưu và gửi thông báo NORMAL qua in-app + push, không đăng ký job", async () => {
    const result = await service.dispatch({
      userId,
      title: "Ca của bạn đã được xác nhận",
    });

    expect(result.fallbackJobKey).toBeNull();
    expect(scheduler.jobs).toHaveLength(0);
    expect(push.sent).toHaveLength(1);
    expect(realtime.emitted).toHaveLength(1);

    const rows = await rowsFor(userId);
    expect(rows.map((r) => [r.channel, r.priority, r.delivery_status])).toEqual(
      [
        ["IN_APP", "NORMAL", "SENT"],
        ["PUSH_FCM", "NORMAL", "SENT"],
      ],
    );
  });

  it("FCM sập thì đánh FAILED, không ném lỗi", async () => {
    push.failNext = true;
    const result = await service.dispatch({
      userId,
      title: "Test",
      channels: [NotificationChannel.PUSH_FCM],
    });
    expect(result.notifications[0].deliveryStatus).toBe("FAILED");
    expect((await rowsFor(userId))[0].delivery_status).toBe("FAILED");
  });

  it("chỉ chủ thông báo mới ack được, ack 2 lần vẫn ổn", async () => {
    const result = await service.dispatch({
      userId,
      title: "SOS",
      priority: NotificationPriority.HIGH,
    });
    const pushId = result.notifications.find(
      (n) => n.channel === NotificationChannel.PUSH_FCM,
    )!.id;

    expect(await service.acknowledge(pushId, otherUserId)).toBe(false);
    expect(await service.acknowledge(pushId, userId)).toBe(true);
    expect(await service.acknowledge(pushId, userId)).toBe(true);

    const pushRow = (await rowsFor(userId)).find((r) => r.id === pushId)!;
    expect(pushRow.acked).toBe(true);
    expect(pushRow.is_read).toBe(true);
  });

  it("chặn dữ liệu sai trước khi ghi bất cứ thứ gì", async () => {
    await expect(
      service.dispatch({ userId: "not-a-uuid", title: "x" }),
    ).rejects.toThrow(NotificationValidationError);
    await expect(
      service.dispatch({ userId, title: "x".repeat(201) }),
    ).rejects.toThrow(NotificationValidationError);
    expect(await rowsFor(userId)).toHaveLength(0);
  });

  // ---------- Bước 6: watcher 60 giây ----------

  it("cảnh báo khẩn đăng ký job 60s trên hàng đợi chung", async () => {
    const result = await service.dispatch({
      userId,
      title: "SOS",
      priority: NotificationPriority.HIGH,
    });
    const pushRow = result.notifications.find(
      (n) => n.channel === NotificationChannel.PUSH_FCM,
    )!;

    expect(scheduler.jobs).toHaveLength(1);
    expect(scheduler.jobs[0]).toMatchObject({
      jobName: URGENT_FALLBACK_JOB,
      idempotencyKey: `notif-fallback:${pushRow.id}`,
      runAt: URGENT_ACK_TIMEOUT_MS,
      payload: { notificationId: pushRow.id },
    });
  });

  it("chưa tới 60 giây thì chưa gửi SMS (biên 59.999s)", async () => {
    await service.dispatch({
      userId,
      title: "SOS",
      priority: NotificationPriority.HIGH,
    });
    await scheduler.advance(URGENT_ACK_TIMEOUT_MS - 1);
    expect(sms.sent).toHaveLength(0);
  });

  it("đủ 60 giây chưa ack thì gửi ĐÚNG 1 SMS, chạy lại job cũng không gửi thêm", async () => {
    await service.dispatch({
      userId,
      title: "SOS",
      body: "Kiểm tra ứng dụng ngay",
      priority: NotificationPriority.HIGH,
    });

    await scheduler.advance(URGENT_ACK_TIMEOUT_MS);
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0].text).toBe("SOS: Kiểm tra ứng dụng ngay");

    await scheduler.rerun(scheduler.jobs[0].idempotencyKey); // job bị chạy lần 2
    expect(sms.sent).toHaveLength(1);

    const smsRows = (await rowsFor(userId)).filter(
      (r) => r.channel === "SMS_FALLBACK",
    );
    expect(smsRows).toHaveLength(1);
    expect(smsRows[0].delivery_status).toBe("SENT");
  });

  it("2 worker chạy fallback cùng lúc vẫn chỉ gửi 1 SMS", async () => {
    const result = await service.dispatch({
      userId,
      title: "SOS",
      priority: NotificationPriority.HIGH,
    });
    const pushId = result.notifications.find(
      (n) => n.channel === NotificationChannel.PUSH_FCM,
    )!.id;

    const outcomes = await Promise.all([
      service.runUrgentFallback(pushId),
      service.runUrgentFallback(pushId),
    ]);

    expect(outcomes.sort()).toEqual(["ALREADY_SENT", "SENT"]);
    expect(sms.sent).toHaveLength(1);
  });

  it("người dùng ack trong 60 giây thì KHÔNG gửi SMS", async () => {
    const result = await service.dispatch({
      userId,
      title: "SOS",
      priority: NotificationPriority.HIGH,
    });
    const pushId = result.notifications.find(
      (n) => n.channel === NotificationChannel.PUSH_FCM,
    )!.id;

    await scheduler.advance(30_000); // 30 giây sau...
    expect(await service.acknowledge(pushId, userId)).toBe(true); // ...người dùng mở app
    await scheduler.advance(30_000); // tới mốc 60 giây

    expect(sms.sent).toHaveLength(0);
    expect(await service.runUrgentFallback(pushId)).toBe("ACKNOWLEDGED");
  });
});
