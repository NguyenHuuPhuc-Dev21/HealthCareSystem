/**
 * shift-logs — real-time shift updates over WebSocket (BE-2 · Phase 4 · FR-SHIFT-02 "synchronized in real time").
 *
 *   GET /ws/shifts?bookingId=<id>&access_token=<JWT>     (or Sec-WebSocket-Protocol: bearer, <JWT>)
 *
 * Server → client only: ShiftRealtimeMessage { type: 'SHIFT_UPDATED', bookingId, change, at, executionStatus }
 * on every write to the shift (check-in, assessment, vitals, checklist, notes, surcharge, cancellation, check-out).
 * The message carries no patient data: the app reloads GET /bookings/:id/tracking (family) or
 * GET /bookings/:id/shift-state (nurse), which apply the access rules.
 * Only the customer of the booking, its assigned nurse, or an Admin can subscribe (otherwise HTTP 403 before the
 * upgrade). Same plumbing as BE-3's /ws/notifications: published to Redis when REDIS_URL is set, so every API
 * instance reaches its own sockets; without Redis the event goes to the in-process hub.
 */
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { Redis } from 'ioredis';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ExecutionStatus, ShiftRealtimeMessage } from '@healthcare-system/shared';
import type { AuthenticatedUser, TokenVerifier } from '../../core/middleware';
import { redisRealtimeEnabled } from '../notifications/notifications.realtime';
import { tokenFromUpgrade } from '../notifications/notifications.socket';
import { SHIFT_REALTIME_CHANNEL, SHIFT_WS_PATHS, type ShiftChange } from './shift-logs.types';

type Listener = (m: ShiftRealtimeMessage) => void;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEARTBEAT_MS = 30_000;

/** bookingId → listeners (one per open socket) in this process. */
export class ShiftHub {
  private readonly listeners = new Map<string, Set<Listener>>();

  subscribe(bookingId: string, listener: Listener): () => void {
    const set = this.listeners.get(bookingId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(bookingId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(bookingId);
    };
  }

  deliver(m: ShiftRealtimeMessage): number {
    const set = this.listeners.get(m.bookingId);
    if (!set) return 0;
    for (const listener of set) {
      try {
        listener(m);
      } catch (err) {
        console.warn(`[shift-logs] realtime listener failed: ${(err as Error).message}`);
      }
    }
    return set.size;
  }
}

export const shiftHub = new ShiftHub();

export function shiftMessage(bookingId: string, change: ShiftChange, executionStatus: ExecutionStatus, nowMs = Date.now()): ShiftRealtimeMessage {
  return { type: 'SHIFT_UPDATED', bookingId, change, at: new Date(nowMs).toISOString(), executionStatus };
}

/** Publishes after COMMIT. Never throws and never blocks the request: the state is already stored. */
export class ShiftPublisher {
  private redis: Redis | null = null;

  constructor(
    private readonly hub: ShiftHub = shiftHub,
    private readonly redisUrl: string | null = redisRealtimeEnabled() ? process.env.REDIS_URL! : null,
  ) {}

  publish = (bookingId: string, change: ShiftChange, executionStatus: ExecutionStatus): void => {
    const m = shiftMessage(bookingId, change, executionStatus);
    if (!this.redisUrl) {
      this.hub.deliver(m);
      return;
    }
    if (!this.redis) {
      this.redis = new Redis(this.redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
      this.redis.on('error', (err) => console.warn(`[shift-logs] realtime publisher: ${err.message}`));
    }
    this.redis.publish(SHIFT_REALTIME_CHANNEL, JSON.stringify(m)).catch((err: Error) => {
      console.warn(`[shift-logs] realtime publish failed (the shift log is stored): ${err.message}`);
    });
  };
}

/** API process only: forwards every published shift event to this process' sockets. Returns a stop function. */
export function startShiftSubscriber(
  hub: ShiftHub = shiftHub,
  redisUrl: string | null = redisRealtimeEnabled() ? process.env.REDIS_URL! : null,
): () => Promise<void> {
  if (!redisUrl) return async () => undefined;
  const sub = new Redis(redisUrl, { maxRetriesPerRequest: null });
  sub.on('error', (err) => console.warn(`[shift-logs] realtime subscriber: ${err.message}`));
  sub.subscribe(SHIFT_REALTIME_CHANNEL).catch((err: Error) => console.warn(`[shift-logs] subscribe failed: ${err.message}`));
  sub.on('message', (channel: string, message: string) => {
    if (channel !== SHIFT_REALTIME_CHANNEL) return;
    try {
      hub.deliver(JSON.parse(message) as ShiftRealtimeMessage);
    } catch {
      console.warn('[shift-logs] dropped a malformed realtime message');
    }
  });
  return async () => {
    await sub.quit().catch(() => undefined);
  };
}

function reject(socket: Duplex, status: number, text: string): void {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

export interface ShiftSocket {
  close(): Promise<void>;
  clients(): number;
}

export function attachShiftSocket(
  server: Server,
  opts: {
    verify: TokenVerifier;
    canWatch: (bookingId: string, user: AuthenticatedUser) => Promise<boolean>;
    hub?: ShiftHub;
    paths?: string[];
    heartbeatMs?: number;
  },
): ShiftSocket {
  const hub = opts.hub ?? shiftHub;
  const paths = opts.paths ?? SHIFT_WS_PATHS;
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols: Set<string>) => (protocols.has('bearer') ? 'bearer' : false),
  });
  const alive = new WeakMap<WebSocket, boolean>();

  const onConnection = (ws: WebSocket, bookingId: string) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    const unsubscribe = hub.subscribe(bookingId, (m) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
    });
    ws.on('close', unsubscribe);
    ws.on('error', unsubscribe);
    ws.on('message', () => undefined); // server → client only
  };

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!paths.includes(url.pathname)) return; // another upgrade handler owns it (e.g. /ws/notifications)
    const bookingId = url.searchParams.get('bookingId') ?? '';
    if (!UUID_RE.test(bookingId)) return reject(socket, 400, 'Bad Request');
    const token = tokenFromUpgrade(req);
    if (!token) return reject(socket, 401, 'Unauthorized');
    opts
      .verify(token)
      .then(async (user) => {
        if (!user) return reject(socket, 401, 'Unauthorized');
        if (!(await opts.canWatch(bookingId, user))) return reject(socket, 403, 'Forbidden');
        wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, bookingId));
      })
      .catch(() => reject(socket, 401, 'Unauthorized'));
  };
  server.on('upgrade', onUpgrade);

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, opts.heartbeatMs ?? HEARTBEAT_MS);
  heartbeat.unref();

  return {
    clients: () => wss.clients.size,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(heartbeat);
        server.off('upgrade', onUpgrade);
        for (const ws of wss.clients) ws.terminate();
        wss.close(() => resolve());
      }),
  };
}
