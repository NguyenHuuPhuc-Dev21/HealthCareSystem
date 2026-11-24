/**
 * notifications — realtime fan-out (BE-3 · Phase 6 · FR-NOTIF-01 "real-time WebSocket").
 *
 * The API and the worker are separate processes, and only the API holds the sockets. So:
 *   dispatch (any process) → RealtimeGateway.emitToUser → Redis PUBLISH notifications:realtime
 *   API: one Redis SUBSCRIBE → LocalRealtimeHub → every socket of that user (notifications.socket.ts)
 * Without REDIS_URL (or NOTIFICATIONS_REALTIME=local) the gateway hands the event to the in-process hub
 * directly — enough for a single dev process. Publishing never blocks or fails a dispatch: the in-app row
 * is already stored, and the centre reloads it.
 */
import { Redis } from 'ioredis';
import type { RealtimeEvent, RealtimeGateway } from '../../core/notifications';
import { REALTIME_CHANNEL } from './notifications.types';

type Listener = (event: RealtimeEvent) => void;

/** userId → listeners (one per open socket) in this process. */
export class LocalRealtimeHub {
  private readonly listeners = new Map<string, Set<Listener>>();

  subscribe(userId: string, listener: Listener): () => void {
    const set = this.listeners.get(userId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(userId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(userId);
    };
  }

  deliver(userId: string, event: RealtimeEvent): number {
    const set = this.listeners.get(userId);
    if (!set) return 0;
    for (const listener of set) {
      try {
        listener(event);
      } catch (err) {
        console.warn(`[notifications] realtime listener failed: ${(err as Error).message}`);
      }
    }
    return set.size;
  }

  connectedUsers(): number {
    return this.listeners.size;
  }
}

/** The hub of this process (the API's sockets register here). */
export const realtimeHub = new LocalRealtimeHub();

interface Envelope {
  userId: string;
  event: RealtimeEvent;
}

export function redisRealtimeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.REDIS_URL) && env.NOTIFICATIONS_REALTIME !== 'local';
}

/** Publishes to Redis when enabled, otherwise delivers to the in-process hub. */
export class PubSubRealtimeGateway implements RealtimeGateway {
  private publisher: Redis | null = null;

  constructor(
    private readonly hub: LocalRealtimeHub = realtimeHub,
    private readonly redisUrl: string | null = redisRealtimeEnabled() ? process.env.REDIS_URL! : null,
  ) {}

  emitToUser(userId: string, _event: 'notification', payload: RealtimeEvent): void {
    if (!this.redisUrl) {
      this.hub.deliver(userId, payload);
      return;
    }
    if (!this.publisher) {
      // Fail fast instead of queueing while Redis is down: a dispatch must never hang on the socket push.
      this.publisher = new Redis(this.redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1, lazyConnect: false });
      this.publisher.on('error', (err) => console.warn(`[notifications] realtime publisher: ${err.message}`));
    }
    const envelope: Envelope = { userId, event: payload };
    this.publisher.publish(REALTIME_CHANNEL, JSON.stringify(envelope)).catch((err: Error) => {
      console.warn(`[notifications] realtime publish failed (the in-app row is stored): ${err.message}`);
    });
  }

  async close(): Promise<void> {
    if (this.publisher) await this.publisher.quit().catch(() => undefined);
    this.publisher = null;
  }
}

/** API process only: forwards every published event to this process' sockets. Returns a stop function. */
export function startRealtimeSubscriber(hub: LocalRealtimeHub = realtimeHub, redisUrl: string | null = redisRealtimeEnabled() ? process.env.REDIS_URL! : null): () => Promise<void> {
  if (!redisUrl) return async () => undefined;
  const sub = new Redis(redisUrl, { maxRetriesPerRequest: null });
  sub.on('error', (err) => console.warn(`[notifications] realtime subscriber: ${err.message}`));
  sub.subscribe(REALTIME_CHANNEL).catch((err: Error) => console.warn(`[notifications] subscribe failed: ${err.message}`));
  sub.on('message', (channel: string, message: string) => {
    if (channel !== REALTIME_CHANNEL) return;
    try {
      const { userId, event } = JSON.parse(message) as Envelope;
      hub.deliver(userId, event);
    } catch {
      console.warn('[notifications] dropped a malformed realtime message');
    }
  });
  return async () => {
    await sub.quit().catch(() => undefined);
  };
}
