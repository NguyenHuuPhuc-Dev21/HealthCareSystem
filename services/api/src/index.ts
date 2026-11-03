/**
 * HealthCareSystem Backend API Server — On-Demand Nursing (SRS v2.0)
 * Boot order: env → database reachable → every system_configs key present → listen.
 * Fails fast: an API that cannot read its business configuration must not serve traffic.
 */

import 'dotenv/config';
import { createApp } from './app';
import { checkConnection, closePool } from './core/database';
import { assertAllConfigKeysPresent } from './core/config';

export async function bootstrap(): Promise<void> {
  await checkConnection();
  await assertAllConfigKeysPresent();

  const port = Number(process.env.PORT ?? 3000);
  const server = createApp().listen(port, () => {
    console.log(`[Bootstrap] API listening on :${port}${process.env.API_PREFIX ?? '/api/v1'}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[Bootstrap] ${signal} received, shutting down…`);
    server.close(() => {
      closePool()
        .catch((err: Error) => console.error('[Bootstrap] Pool close error:', err.message))
        .finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err: Error) => {
  console.error('[Bootstrap Error]', err.message);
  process.exit(1);
});
