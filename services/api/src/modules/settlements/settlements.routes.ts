/**
 * Routes for settlements (mounted at /api/v1). Contract: docs/api/settlements.api.md
 * BE-3 · Phase 5 · FR-PAY-02. The payouts themselves run in the settlements.sweep job.
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import type { SettlementsService } from './settlements.service';

const idParam = z.object({ id: z.string().uuid() });

export function createSettlementsRouter(service: SettlementsService): Router {
  const router = Router();

  router.post(
    '/bookings/:id/confirm-completion',
    authGuard,
    roleGuard([UserRole.PATIENT]),
    asyncHandler(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) throw badRequest('VALIDATION_ERROR', 'Booking id must be a UUID');
      res.json({ success: true, data: await service.confirmCompletion(req.user!.id, p.data.id) });
    }),
  );

  return router;
}
