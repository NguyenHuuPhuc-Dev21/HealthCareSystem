/**
 * Routes for check-out (mounted at /api/v1). Contract: docs/api/shift-execution.api.md §6.
 * BE-2 · Phase 4 · FR-SHIFT-04. NURSE only, for the caller. No business logic here.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { notFound } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { checkOutSchema, type CheckOutBody } from './check-out.schema';
import type { CheckOutService } from './check-out.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createCheckOutRouter(service: CheckOutService): Router {
  const router = Router();

  router.post(
    '/bookings/:id/check-out',
    authGuard,
    roleGuard([UserRole.NURSE]),
    validateBody(checkOutSchema),
    asyncHandler(async (req, res) => {
      const id = String(req.params.id ?? '');
      if (!UUID_RE.test(id)) throw notFound('BOOKING_NOT_FOUND', 'Booking not found');
      const b = req.body as CheckOutBody;
      const data = await service.checkOut(req.user!.id, id, {
        finalVitals: b.finalVitals,
        completedActivityIds: b.completedActivityIds,
        handoverNote: b.handoverNote,
      });
      res.json({ success: true, data });
    }),
  );

  return router;
}
