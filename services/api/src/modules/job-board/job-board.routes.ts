/**
 * Routes for job-board (mounted at /api/v1). Contract: docs/api/job-board.api.md
 * BE-3 · Phase 3 · FR-BOOK-03. NURSE only; paths follow FE-2's apps/nurse-web/src/features/job-board/job-board.api.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import type { JobBoardService } from './job-board.service';

const idParam = z.object({ id: z.string().uuid() });

function bookingId(params: unknown): string {
  const p = idParam.safeParse(params);
  if (!p.success) throw badRequest('VALIDATION_ERROR', 'Booking id must be a UUID');
  return p.data.id;
}

export function createJobBoardRouter(service: JobBoardService): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.get(
    '/nurse/job-board',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.listJobs(req.user!.id) });
    }),
  );

  router.get(
    '/nurse/job-board/:id',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getJob(req.user!.id, bookingId(req.params)) });
    }),
  );

  router.get(
    '/nurse/direct-invitation',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getDirectInvitation(req.user!.id) });
    }),
  );

  router.post(
    '/bookings/:id/accept',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.accept(req.user!.id, bookingId(req.params)) });
    }),
  );

  router.post(
    '/bookings/:id/accept-direct-invite',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.acceptDirectInvite(req.user!.id, bookingId(req.params)) });
    }),
  );

  router.post(
    '/bookings/:id/decline-direct-invite',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.declineDirectInvite(req.user!.id, bookingId(req.params)) });
    }),
  );

  return router;
}
