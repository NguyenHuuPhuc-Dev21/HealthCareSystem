/**
 * Routes for check-in (mounted at /api/v1). Contract: docs/api/shift-execution.api.md §2.
 * BE-2 · Phase 4 · FR-SHIFT-01. NURSE only, for the caller (req.user.id). No business logic here.
 * Like prescription-rejection, no requireNurseEligibility: a nurse suspended after accepting must still be able
 * to honour (check in to) a confirmed shift; the eligibility gate is applied when a shift is accepted.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { notFound } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { checkInSchema, selfieUploadSchema, type CheckInBody } from './check-in.schema';
import type { CheckInService } from './check-in.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bookingId(params: unknown): string {
  const id = String((params as { id?: string }).id ?? '');
  if (!UUID_RE.test(id)) throw notFound('BOOKING_NOT_FOUND', 'Booking not found');
  return id;
}

export function createCheckInRouter(service: CheckInService): Router {
  const router = Router();
  const nurse = [authGuard, roleGuard([UserRole.NURSE])];

  router.post(
    '/bookings/:id/check-in/selfie-upload-url',
    ...nurse,
    validateBody(selfieUploadSchema),
    asyncHandler(async (req, res) => {
      const { contentType } = req.body as { contentType: string };
      res.status(201).json({ success: true, data: await service.requestSelfieUploadUrl(req.user!.id, bookingId(req.params), contentType) });
    }),
  );

  router.post(
    '/bookings/:id/check-in',
    ...nurse,
    validateBody(checkInSchema),
    asyncHandler(async (req, res) => {
      const b = req.body as CheckInBody;
      const data = await service.checkIn(req.user!.id, bookingId(req.params), {
        latitude: b.latitude,
        longitude: b.longitude,
        isMockLocation: b.isMockLocation,
        selfieKey: b.selfieKey,
        accuracyMeters: b.accuracyMeters,
      });
      res.json({ success: true, data });
    }),
  );

  return router;
}
