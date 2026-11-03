/**
 * Hợp đồng (interface) cho từng kênh gửi của core/notifications (BE-3)
 * và bản mock dùng khi chạy ở máy mình + khi test.
 *
 * Adapter thật (Firebase Admin SDK cho FCM, cổng SMS/ZNS, WebSocket gateway)
 * chỉ cần implement đúng các interface này rồi thay vào lúc khởi động.
 */

import { NotificationPriority } from "@healthcare-system/shared";

export interface PushMessage {
  userId: string;
  notificationId: string;
  title: string;
  body: string | null;
  priority: NotificationPriority;
  /** Chỉ dữ liệu điều hướng cần thiết (vd bookingId). KHÔNG chứa thông tin lâm sàng. */
  data?: Record<string, string>;
}

export interface SmsMessage {
  userId: string;
  notificationId: string;
  /** Số điện thoại lấy từ users.phone */
  to: string;
  text: string;
}

export interface RealtimeEvent {
  notificationId: string;
  title: string;
  body: string | null;
  priority: NotificationPriority;
  bookingId: string | null;
}

export interface PushProvider {
  send(message: PushMessage): Promise<void>;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

/** WebSocket gateway dùng chung (vận hành cùng BE-2 ở Phase 4). */
export interface RealtimeGateway {
  emitToUser(
    userId: string,
    event: "notification",
    payload: RealtimeEvent,
  ): void | Promise<void>;
}

/** Che số điện thoại khi ghi log: 0903000003 -> ******0003 */
export function maskPhone(phone: string): string {
  return phone.length <= 4
    ? "****"
    : `${"*".repeat(phone.length - 4)}${phone.slice(-4)}`;
}

/** FCM giả: không gửi thật, chỉ lưu vào mảng `sent`. */
export class MockPushProvider implements PushProvider {
  readonly sent: PushMessage[] = [];
  /** Đặt true trong test để giả lập FCM bị sập ở lần gửi kế tiếp. */
  failNext = false;

  async send(message: PushMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Mock FCM failure");
    }
    this.sent.push(message);
    console.log(
      `[Mock FCM] -> user ${message.userId} (priority=${message.priority}, notification=${message.notificationId})`,
    );
  }
}

/** SMS giả. */
export class MockSmsProvider implements SmsProvider {
  readonly sent: SmsMessage[] = [];
  failNext = false;

  async send(message: SmsMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Mock SMS failure");
    }
    this.sent.push(message);
    console.log(
      `[Mock SMS] -> ${maskPhone(message.to)} (notification=${message.notificationId})`,
    );
  }
}

type RealtimeListener = (event: RealtimeEvent) => void;

/** WebSocket giả chạy trong cùng tiến trình: ai subscribe user nào sẽ nhận sự kiện của user đó. */
export class InMemoryRealtimeGateway implements RealtimeGateway {
  readonly emitted: Array<{ userId: string; payload: RealtimeEvent }> = [];
  private readonly listeners = new Map<string, Set<RealtimeListener>>();

  subscribe(userId: string, listener: RealtimeListener): () => void {
    const set = this.listeners.get(userId) ?? new Set<RealtimeListener>();
    set.add(listener);
    this.listeners.set(userId, set);
    return () => set.delete(listener); // gọi hàm trả về để hủy đăng ký
  }

  emitToUser(
    userId: string,
    _event: "notification",
    payload: RealtimeEvent,
  ): void {
    this.emitted.push({ userId, payload });
    this.listeners.get(userId)?.forEach((listener) => listener(payload));
  }
}
