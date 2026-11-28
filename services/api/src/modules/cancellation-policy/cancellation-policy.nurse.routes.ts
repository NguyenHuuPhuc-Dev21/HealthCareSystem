/**
 * Routes for the nurse side of cancellation-policy (mounted at /api/v1). Contract: docs/api/cancellation-policy.api.md
 * NURSE only, and deliberately NOT requireNurseEligibility: a suspended nurse must still be able to give back a shift.
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import type { NurseCancelService } from './cancellation-policy.nurse';

export const nurseCancelSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export function createNurseCancelRouter(service: NurseCancelService): Router {
  const router = Router();
  const nurse = [authGuard, roleGuard([UserRole.NURSE])];

  router.get(
    '/bookings/:id/nurse-cancel-preview',
    ...nurse,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.preview(req.user!.id, String(req.params.id)) });
    }),
  );

  router.post(
    '/bookings/:id/nurse-cancel',
    ...nurse,
    validateBody(nurseCancelSchema),
    asyncHandler(async (req, res) => {
      const { reason } = req.body as z.infer<typeof nurseCancelSchema>;
      res.json({ success: true, data: await service.cancel(req.user!.id, String(req.params.id), reason) });
    }),
  );

  return router;
}
