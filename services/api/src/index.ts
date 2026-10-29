/**
 * HealthCareSystem Backend API Server
 * Version: 2.0 (SRS v2.0 Marketplace Baseline)
 */

import { db } from './core/database';
import { config } from './core/config';

export async function bootstrap() {
  console.log('====================================================');
  console.log('HealthCareSystem API Server — On-Demand Nursing v2.0');
  console.log('Base URL: /api/v1');
  console.log('====================================================');

  await db.connect();
  console.log('[Bootstrap] Core services initialized.');
}

bootstrap().catch((err) => {
  console.error('[Bootstrap Error]', err);
  process.exit(1);
});
