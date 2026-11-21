/**
 * Routes for shift-extend (mounted at /api/v1). Contract: docs/api/shift-extend.api.md
 * No business logic here. Paths follow what patient-web and nurse-app already call.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { notFound } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { bookingIdParamSchema, extendSchema, respondSchema, type ExtendBody, type RespondBody } from './shift-extend.schema';
import { simulatorEnabled } from '../gateway-webhooks/gateway-webhooks.service';
import type { ShiftExtendService } from './shift-extend.service';

function bookingId(params: unknown): string {
  const parsed = bookingIdParamSchema.safeParse({ id: (params as { id?: string }).id });
  if (!parsed.success) throw notFound('BOOKING_NOT_FOUND', 'Booking not found');
  return parsed.data.id;
}

export function createShiftExtendRouter(service: ShiftExtendService, opts: { simulator?: boolean } = {}): Router {
  const router = Router();
  const customer = [authGuard, roleGuard([UserRole.PATIENT])];
  const nurse = [authGuard, roleGuard([UserRole.NURSE])];

  router.post(
    '/bookings/:id/extend/quote',
    ...customer,
    validateBody(extendSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as ExtendBody;
      res.json({ success: true, data: await service.quote(req.user!.id, bookingId(req.params), body.hours) });
    }),
  );

  router.post(
    '/bookings/:id/extend',
    ...customer,
    validateBody(extendSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as ExtendBody;
      res.status(201).json({ success: true, data: await service.request(req.user!.id, bookingId(req.params), body.hours) });
    }),
  );

  router.post(
    '/bookings/:id/extend/respond',
    ...nurse,
    validateBody(respondSchema),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.respond(req.user!.id, bookingId(req.params), req.body as RespondBody) });
    }),
  );

  router.get(
    '/bookings/:id/extensions',
    authGuard,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: { extensions: await service.list(req.user!, bookingId(req.params)) } });
    }),
  );

  // Dev / demo only — mounted when PAYMENT_SIMULATOR_ENABLED=true outside production (same switch as gateway-webhooks).
  if (opts.simulator ?? simulatorEnabled()) {
    router.post(
      '/bookings/:id/extensions/:extensionId/dev/simulate-payment',
      ...customer,
      asyncHandler(async (req, res) => {
        const extensionId = String(req.params.extensionId);
        res.json({ success: true, data: await service.simulatePayment(req.user!.id, bookingId(req.params), extensionId) });
      }),
    );
  }

  return router;
}
