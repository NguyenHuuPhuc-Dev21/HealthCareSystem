/**
 * HealthCareSystem Backend API Server — On-Demand Nursing (SRS v2.0)
 * Boot order: env → database reachable → every system_configs key present → listen.
 * Fails fast: an API that cannot read its business configuration must not serve traffic.
 */

import 'dotenv/config';
import { createApp } from './app';
import { checkConnection, closePool } from './core/database';
import { assertAllConfigKeysPresent } from './core/config';
import { closeKeyValueStore } from './core/redis';
import { describeError } from './core/errors';
import { getAccountsOtpService } from './modules/accounts-otp/accounts-otp.service';
import { startRealtimeSubscriber } from './modules/notifications/notifications.realtime';
import { attachNotificationSocket } from './modules/notifications/notifications.socket';
import { attachShiftSocket, startShiftSubscriber } from './modules/shift-logs/shift-logs.realtime';
import { canWatch } from './modules/shift-logs/shift-logs.repo';
import { getPool } from './core/database';

export async function bootstrap(): Promise<void> {
  await checkConnection();
  await assertAllConfigKeysPresent();

  const port = Number(process.env.PORT ?? 3000);
  const server = createApp().listen(port, () => {
    console.log(`[Bootstrap] API listening on :${port}${process.env.API_PREFIX ?? '/api/v1'}`);
  });
  // BE-3 · Phase 6 · notifications: /ws/notifications + events published by the worker (Redis pub/sub).
  const auth = getAccountsOtpService();
  const notificationSocket = attachNotificationSocket(server, { verify: (token) => auth.sessions.verifyAccessToken(token) });
  const stopRealtime = startRealtimeSubscriber();
  // BE-2 · Phase 4 · shift-logs: /ws/shifts?bookingId= (customer, assigned nurse, Admin) + events from other instances.
  const shiftSocket = attachShiftSocket(server, {
    verify: (token) => auth.sessions.verifyAccessToken(token),
    canWatch: (bookingId, user) => canWatch(getPool(), bookingId, user),
  });
  const stopShiftRealtime = startShiftSubscriber();

  const shutdown = (signal: string) => {
    console.log(`[Bootstrap] ${signal} received, shutting down…`);
    void notificationSocket.close();
    void shiftSocket.close();
    server.close(() => {
      Promise.all([closePool(), closeKeyValueStore(), stopRealtime(), stopShiftRealtime()])
        .catch((err: Error) => console.error('[Bootstrap] Pool close error:', err.message))
        .finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err: unknown) => {
  console.error('[Bootstrap Error]', describeError(err));
  process.exit(1);
});
