/**
 * Routes for matching-radar (mounted at /api/v1). Contract: docs/api/bookings.api.md §4
 * BE-2 · Phase 3 · FR-BOOK-03. NURSE only, always for the caller (req.user.id).
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { badRequest } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import type { MatchingRadarService } from './matching-radar.service';

const idParam = z.object({ id: z.string().uuid() }).strict();

function bookingId(params: unknown): string {
  const r = idParam.safeParse(params);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid booking id');
  return r.data.id;
}

export function createMatchingRadarRouter(service: MatchingRadarService): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.get(
    '/nurse/radar',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getRadarJob(req.user!.id) });
    }),
  );

  router.post(
    '/bookings/:id/claim-radar',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const r = await service.claimBooking(req.user!.id, bookingId(req.params), 'RADAR');
      res.json({ success: true, data: { success: true, booking_id: r.bookingId, bookingCode: r.bookingCode } });
    }),
  );

  router.post(
    '/bookings/:id/dismiss-radar',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.dismissRadar(req.user!.id, bookingId(req.params)) });
    }),
  );

  return router;
}
