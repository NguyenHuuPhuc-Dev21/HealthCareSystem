/**
 * notifications — WebSocket endpoint (BE-3 · Phase 6 · FR-NOTIF-01).
 *
 *   GET /ws/notifications?access_token=<JWT>        (browsers cannot set an Authorization header)
 *   or Sec-WebSocket-Protocol: bearer, <JWT>
 *
 * Server → client only: { "type": "NEW_NOTIFICATION", "notification": NotificationDto } for each new in-app
 * notification of the connected user (nurse-web notifications.api.ts subscribeNotifications). A ping every
 * 30 s drops dead connections. A bad or missing token gets HTTP 401 before the upgrade.
 */
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { AuthenticatedUser, TokenVerifier } from '../../core/middleware';
import type { RealtimeEvent } from '../../core/notifications';
import { realtimeHub, type LocalRealtimeHub } from './notifications.realtime';
import { UNTYPED_NOTIFICATION, WS_PATHS, type InboxItemDto, type SocketMessage } from './notifications.types';

const HEARTBEAT_MS = 30_000;

export function toSocketMessage(e: RealtimeEvent): SocketMessage {
  const data: Record<string, string> = { ...(e.data ?? {}) };
  if (e.bookingId && !data.bookingId) data.bookingId = e.bookingId;
  const notification: InboxItemDto = {
    id: e.notificationId,
    type: e.type ?? UNTYPED_NOTIFICATION,
    priority: e.priority,
    title: e.title,
    body: e.body ?? '',
    data,
    readAt: null,
    createdAt: e.createdAt ?? new Date().toISOString(),
  };
  return { type: 'NEW_NOTIFICATION', notification };
}

/** The JWT from ?access_token= / ?token= or from the "bearer, <token>" subprotocol. */
export function tokenFromUpgrade(req: IncomingMessage): string | null {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const fromQuery = url.searchParams.get('access_token') ?? url.searchParams.get('token');
  if (fromQuery) return fromQuery;
  const protocols = String(req.headers['sec-websocket-protocol'] ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const i = protocols.findIndex((p) => p.toLowerCase() === 'bearer');
  return i >= 0 && protocols[i + 1] ? protocols[i + 1] : null;
}

function reject(socket: Duplex, status: number, text: string): void {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

export interface NotificationSocket {
  close(): Promise<void>;
  /** Open sockets (tests, health). */
  clients(): number;
}

export function attachNotificationSocket(
  server: Server,
  opts: { verify: TokenVerifier; hub?: LocalRealtimeHub; paths?: string[]; heartbeatMs?: number },
): NotificationSocket {
  const hub = opts.hub ?? realtimeHub;
  const paths = opts.paths ?? WS_PATHS;
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols: Set<string>) => (protocols.has('bearer') ? 'bearer' : false),
  });
  const alive = new WeakMap<WebSocket, boolean>();

  const onConnection = (ws: WebSocket, user: AuthenticatedUser) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    const unsubscribe = hub.subscribe(user.id, (event) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(toSocketMessage(event)));
    });
    ws.on('close', unsubscribe);
    ws.on('error', unsubscribe);
    ws.on('message', () => undefined); // server → client only
  };

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (!paths.includes(path)) return; // another upgrade handler may own it
    const token = tokenFromUpgrade(req);
    if (!token) return reject(socket, 401, 'Unauthorized');
    opts
      .verify(token)
      .then((user) => {
        if (!user) return reject(socket, 401, 'Unauthorized');
        wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, user));
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
