/**
 * Routes for ops-monitoring (mounted at /api/v1). Contract: docs/api/ops-monitoring.api.md · BE-3 · Phase 8.
 * ADMIN only. Liveness without auth stays GET /health (app.ts).
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import type { OpsMonitoringService } from './ops-monitoring.service';

export function createOpsMonitoringRouter(service: OpsMonitoringService): Router {
  const router = Router();
  router.get(
    '/admin/ops/health',
    authGuard,
    roleGuard([UserRole.ADMIN]),
    asyncHandler(async (_req, res) => {
      res.json({ success: true, data: await service.health() });
    }),
  );
  return router;
}
