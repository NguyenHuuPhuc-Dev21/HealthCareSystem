/**
 * Routes for bookings (mounted at /api/v1). Contract: docs/api/bookings.api.md
 * BE-2 · Phase 3 · FR-BOOK-01/02/03. PATIENT only, always for the caller (req.user.id).
 * There is deliberately NO Admin route that creates bookings: prohibited services stay unbookable.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { badRequest } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import {
  bookingIdParamSchema,
  createBookingSchema,
  prescriptionUploadSchema,
  quoteSchema,
  type CreateBookingBody,
  type PrescriptionUploadBody,
  type QuoteBody,
} from './bookings.schema';
import type { BookingsService } from './bookings.service';

export function createBookingsRouter(service: BookingsService): Router {
  const router = Router();
  const patientOnly = [authGuard, roleGuard([UserRole.PATIENT])];

  router.post(
    '/bookings/quote',
    ...patientOnly,
    validateBody(quoteSchema),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.quote(req.user!.id, req.body as QuoteBody) });
    }),
  );

  router.post(
    '/bookings/prescription/upload-url',
    ...patientOnly,
    validateBody(prescriptionUploadSchema),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.prescriptionUploadUrl(req.user!.id, req.body as PrescriptionUploadBody) });
    }),
  );

  router.post(
    '/bookings',
    ...patientOnly,
    validateBody(createBookingSchema),
    asyncHandler(async (req, res) => {
      res.status(201).json({ success: true, data: await service.create(req.user!.id, req.body as CreateBookingBody) });
    }),
  );

  router.get(
    '/bookings',
    ...patientOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: { items: await service.list(req.user!.id) } });
    }),
  );

  router.get(
    '/bookings/:id',
    ...patientOnly,
    asyncHandler(async (req, res) => {
      const p = bookingIdParamSchema.safeParse(req.params);
      if (!p.success) throw badRequest('VALIDATION_ERROR', 'Invalid booking id');
      res.json({ success: true, data: await service.get(req.user!.id, p.data.id) });
    }),
  );

  return router;
}
