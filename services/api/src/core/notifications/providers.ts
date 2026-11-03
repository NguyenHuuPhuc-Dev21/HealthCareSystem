/**
 * Delivery provider contracts for core/notifications (BE-3) and the mock
 * implementations used for local development and tests.
 *
 * Real adapters (Firebase Admin SDK for FCM, an SMS/ZNS gateway, the shared
 * WebSocket gateway) implement the same interfaces and are swapped in at
 * bootstrap; nothing else in the codebase changes.
 */

import { NotificationPriority } from '@healthcare-system/shared';

export interface PushMessage {
  userId: string;
  notificationId: string;
  title: string;
  body: string | null;
  priority: NotificationPriority;
  /** Need-to-know routing data only (e.g. bookingId). Never clinical detail. */
  data?: Record<string, string>;
}

export interface SmsMessage {
  userId: string;
  notificationId: string;
  /** E.164 or local phone number taken from users.phone. */
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

/** Shared WebSocket gateway (operated together with BE-2, plan Phase 4). */
export interface RealtimeGateway {
  emitToUser(userId: string, event: 'notification', payload: RealtimeEvent): void | Promise<void>;
}

/** Masks a phone number for log lines: 0903000003 -> ******0003. */
export function maskPhone(phone: string): string {
  return phone.length <= 4 ? '****' : `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
}

export class MockPushProvider implements PushProvider {
  readonly sent: PushMessage[] = [];
  /** Set to true in tests to simulate an FCM outage. */
  failNext = false;

  async send(message: PushMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Mock FCM failure');
    }
    this.sent.push(message);
    console.log(`[Mock FCM] -> user ${message.userId} (priority=${message.priority}, notification=${message.notificationId})`);
  }
}

export class MockSmsProvider implements SmsProvider {
  readonly sent: SmsMessage[] = [];
  failNext = false;

  async send(message: SmsMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('Mock SMS failure');
    }
    this.sent.push(message);
    console.log(`[Mock SMS] -> ${maskPhone(message.to)} (notification=${message.notificationId})`);
  }
}

type RealtimeListener = (event: RealtimeEvent) => void;

/** In-process stand-in for the WebSocket gateway. */
export class InMemoryRealtimeGateway implements RealtimeGateway {
  readonly emitted: Array<{ userId: string; payload: RealtimeEvent }> = [];
  private readonly listeners = new Map<string, Set<RealtimeListener>>();

  subscribe(userId: string, listener: RealtimeListener): () => void {
    const set = this.listeners.get(userId) ?? new Set<RealtimeListener>();
    set.add(listener);
    this.listeners.set(userId, set);
    return () => set.delete(listener);
  }

  emitToUser(userId: string, _event: 'notification', payload: RealtimeEvent): void {
    this.emitted.push({ userId, payload });
    this.listeners.get(userId)?.forEach((listener) => listener(payload));
  }
}
