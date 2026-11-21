/**
 * Routes for prescription-rejection (mounted at /api/v1). Contract: docs/api/prescription-rejection.api.md
 * NURSE only, and deliberately NOT requireNurseEligibility: a nurse who was demoted or suspended after
 * accepting must still be able to refuse an invalid order on site. The service checks she is the assigned nurse.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { notFound } from '../../core/errors';
import {
  bookingIdParamSchema,
  evidenceUploadUrlSchema,
  rejectPrescriptionSchema,
  type EvidenceUploadUrlBody,
  type RejectPrescriptionBody,
} from './prescription-rejection.schema';
import type { PrescriptionRejectionService } from './prescription-rejection.service';

function bookingId(params: unknown): string {
  const parsed = bookingIdParamSchema.safeParse(params);
  if (!parsed.success) throw notFound('BOOKING_NOT_FOUND', 'Booking not found');
  return parsed.data.id;
}

export function createPrescriptionRejectionRouter(service: PrescriptionRejectionService): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.post(
    '/bookings/:id/reject-invalid-prescription/evidence-upload-url',
    ...nurseOnly,
    validateBody(evidenceUploadUrlSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as EvidenceUploadUrlBody;
      res.json({ success: true, data: await service.requestEvidenceUploadUrl(req.user!.id, bookingId(req.params), body.contentType) });
    }),
  );

  router.post(
    '/bookings/:id/reject-invalid-prescription',
    ...nurseOnly,
    validateBody(rejectPrescriptionSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as RejectPrescriptionBody;
      res.json({ success: true, data: await service.reject(req.user!.id, bookingId(req.params), body) });
    }),
  );

  return router;
}
