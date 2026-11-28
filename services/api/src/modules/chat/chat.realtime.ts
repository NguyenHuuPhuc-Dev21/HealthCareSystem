/**
 * chat — real-time delivery over WebSocket (BE-2 · Phase 6 · FR-CHAT-01).
 *
 *   GET /ws/chat?conversationId=<bookingId>&access_token=<JWT>   (or Sec-WebSocket-Protocol: bearer, <JWT>)
 *
 * Server → client: ChatRealtimeMessage — NEW_MESSAGE | READ | CALL_SIGNAL | CALL_ERROR.
 * Client → server: CALL_SIGNAL only (in-app WebRTC call set-up, relayed to the other participant's sockets — never
 * to Admin watchers). Text and photos are NOT sent over the socket: POST /bookings/:id/messages scans and stores first.
 * Customer of the booking, its assigned nurse or an Admin (read-only) only (403 otherwise). Same plumbing as /ws/shifts and
 * /ws/notifications: Redis pub/sub when REDIS_URL is set (several API instances), in-process hub otherwise.
 */
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { Redis } from 'ioredis';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ChatRealtimeMessage } from '@healthcare-system/shared';
import type { AuthenticatedUser, TokenVerifier } from '../../core/middleware';
import { redisRealtimeEnabled } from '../notifications/notifications.realtime';
import { tokenFromUpgrade } from '../notifications/notifications.socket';
import { CHAT_REALTIME_CHANNEL, CHAT_WS_PATHS } from './chat.types';

type Listener = { userId: string; fn: (m: ChatRealtimeMessage) => void };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEARTBEAT_MS = 30_000;

/** bookingId → open sockets of this process. */
export class ChatHub {
  private readonly listeners = new Map<string, Set<Listener>>();

  subscribe(bookingId: string, userId: string, fn: (m: ChatRealtimeMessage) => void): () => void {
    const set = this.listeners.get(bookingId) ?? new Set<Listener>();
    const l = { userId, fn };
    set.add(l);
    this.listeners.set(bookingId, set);
    return () => {
      set.delete(l);
      if (set.size === 0) this.listeners.delete(bookingId);
    };
  }

  /** toUserId: only that user's sockets (call signalling). Returns how many sockets got it. */
  deliver(bookingId: string, m: ChatRealtimeMessage, toUserId?: string): number {
    const set = this.listeners.get(bookingId);
    if (!set) return 0;
    let n = 0;
    for (const l of set) {
      if (toUserId && l.userId !== toUserId) continue;
      n += 1;
      try {
        l.fn(m);
      } catch (err) {
        console.warn(`[chat] realtime listener failed: ${(err as Error).message}`);
      }
    }
    return n;
  }

  /** Is this user looking at this conversation right now (in this process)? Used to skip the push notification. */
  isWatching(bookingId: string, userId: string): boolean {
    for (const l of this.listeners.get(bookingId) ?? []) if (l.userId === userId) return true;
    return false;
  }
}

export const chatHub = new ChatHub();

interface Envelope {
  bookingId: string;
  message: ChatRealtimeMessage;
  toUserId?: string;
}

/** Publishes after COMMIT; never throws. */
export class ChatPublisher {
  private redis: Redis | null = null;

  constructor(
    private readonly hub: ChatHub = chatHub,
    private readonly redisUrl: string | null = redisRealtimeEnabled() ? process.env.REDIS_URL! : null,
  ) {}

  publish = (bookingId: string, message: ChatRealtimeMessage, toUserId?: string): void => {
    if (!this.redisUrl) {
      this.hub.deliver(bookingId, message, toUserId);
      return;
    }
    if (!this.redis) {
      this.redis = new Redis(this.redisUrl, { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
      this.redis.on('error', (err) => console.warn(`[chat] realtime publisher: ${err.message}`));
    }
    const envelope: Envelope = toUserId ? { bookingId, message, toUserId } : { bookingId, message };
    this.redis.publish(CHAT_REALTIME_CHANNEL, JSON.stringify(envelope)).catch((err: Error) => {
      console.warn(`[chat] realtime publish failed (the message is stored): ${err.message}`);
    });
  };
}

export function startChatSubscriber(
  hub: ChatHub = chatHub,
  redisUrl: string | null = redisRealtimeEnabled() ? process.env.REDIS_URL! : null,
): () => Promise<void> {
  if (!redisUrl) return async () => undefined;
  const sub = new Redis(redisUrl, { maxRetriesPerRequest: null });
  sub.on('error', (err) => console.warn(`[chat] realtime subscriber: ${err.message}`));
  sub.subscribe(CHAT_REALTIME_CHANNEL).catch((err: Error) => console.warn(`[chat] subscribe failed: ${err.message}`));
  sub.on('message', (channel: string, raw: string) => {
    if (channel !== CHAT_REALTIME_CHANNEL) return;
    try {
      const { bookingId, message, toUserId } = JSON.parse(raw) as Envelope;
      hub.deliver(bookingId, message, toUserId);
    } catch {
      console.warn('[chat] dropped a malformed realtime message');
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

export interface ChatSocket {
  close(): Promise<void>;
  clients(): number;
}

export function attachChatSocket(
  server: Server,
  opts: {
    verify: TokenVerifier;
    canWatch: (bookingId: string, user: AuthenticatedUser) => Promise<boolean>;
    /** CALL_SIGNAL from a client (ChatService.relaySignal). Throws AppError-like { code, message } to refuse. */
    onSignal?: (bookingId: string, user: AuthenticatedUser, raw: unknown) => Promise<void>;
    hub?: ChatHub;
    paths?: string[];
    heartbeatMs?: number;
  },
): ChatSocket {
  const hub = opts.hub ?? chatHub;
  const paths = opts.paths ?? CHAT_WS_PATHS;
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols: Set<string>) => (protocols.has('bearer') ? 'bearer' : false),
    maxPayload: 64 * 1024, // a CALL_SIGNAL is a few KB; anything bigger closes the socket (1009)
  });
  const alive = new WeakMap<WebSocket, boolean>();

  const sendError = (ws: WebSocket, callId: string | null, code: string, message: string) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'CALL_ERROR', callId, code, message } satisfies ChatRealtimeMessage));
  };

  const onClientMessage = (ws: WebSocket, bookingId: string, user: AuthenticatedUser, data: unknown) => {
    let msg: unknown;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return sendError(ws, null, 'BAD_MESSAGE', 'Expected JSON');
    }
    const callId = typeof (msg as { callId?: unknown })?.callId === 'string' ? (msg as { callId: string }).callId : null;
    if ((msg as { type?: unknown })?.type !== 'CALL_SIGNAL' || !opts.onSignal) {
      return sendError(ws, callId, 'NOT_SUPPORTED', 'Only CALL_SIGNAL is accepted here; send messages with POST /bookings/:id/messages');
    }
    opts.onSignal(bookingId, user, msg).catch((err: { code?: string; message?: string }) => {
      sendError(ws, callId, err?.code ?? 'SIGNAL_FAILED', err?.message ?? 'Call signal refused');
    });
  };

  const onConnection = (ws: WebSocket, bookingId: string, user: AuthenticatedUser) => {
    const userId = user.id;
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    const unsubscribe = hub.subscribe(bookingId, userId, (m) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m));
    });
    ws.on('close', unsubscribe);
    ws.on('error', unsubscribe);
    ws.on('message', (data) => onClientMessage(ws, bookingId, user, data));
  };

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!paths.includes(url.pathname)) return; // another upgrade handler owns it
    const bookingId = url.searchParams.get('conversationId') ?? url.searchParams.get('bookingId') ?? '';
    if (!UUID_RE.test(bookingId)) return reject(socket, 400, 'Bad Request');
    const token = tokenFromUpgrade(req);
    if (!token) return reject(socket, 401, 'Unauthorized');
    opts
      .verify(token)
      .then(async (user) => {
        if (!user) return reject(socket, 401, 'Unauthorized');
        if (!(await opts.canWatch(bookingId, user))) return reject(socket, 403, 'Forbidden');
        wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, bookingId, user));
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
