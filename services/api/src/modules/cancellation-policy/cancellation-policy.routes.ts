/**
 * Routes for cancellation-policy (mounted at /api/v1). Contract: docs/api/cancellation-policy.api.md
 * Customer only. Paths follow what patient-web already calls (features/refunds).
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import type { CancellationPolicyService } from './cancellation-policy.service';

export function createCancellationPolicyRouter(service: CancellationPolicyService): Router {
  const router = Router();
  const customer = [authGuard, roleGuard([UserRole.PATIENT])];

  router.get(
    '/bookings/:id/cancel-preview',
    ...customer,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.preview(req.user!.id, String(req.params.id)) });
    }),
  );

  router.post(
    '/bookings/:id/cancel',
    ...customer,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.cancel(req.user!.id, String(req.params.id)) });
    }),
  );

  router.get(
    '/refunds',
    ...customer,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: { items: await service.listRefunds(req.user!.id) } });
    }),
  );

  return router;
}
