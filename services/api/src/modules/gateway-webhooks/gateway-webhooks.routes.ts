/**
 * Routes for gateway-webhooks (mounted at /api/v1). Contract: docs/api/gateway-webhooks.api.md
 * BE-3 · Phase 3 · FR-PAY-01.
 *   POST /payments/escrow-webhook          GATEWAY (no bearer token — authenticated by HMAC signature)
 *   GET  /bookings/:id/payment-link        PATIENT (owner)
 *   POST /payments/dev/simulate-escrow     PATIENT (owner) — only when PAYMENT_SIMULATOR_ENABLED=true, never in production
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import { bookingIdParamSchema } from './gateway-webhooks.schema';
import { simulatorEnabled, type GatewayWebhooksService } from './gateway-webhooks.service';

export function createGatewayWebhooksRouter(service: GatewayWebhooksService, opts: { simulator?: boolean } = {}): Router {
  const router = Router();
  const patientOnly = [authGuard, roleGuard([UserRole.PATIENT])];

  router.post(
    '/payments/escrow-webhook',
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.handleEscrowWebhook(req.body) });
    }),
  );

  router.get(
    '/bookings/:id/payment-link',
    ...patientOnly,
    asyncHandler(async (req, res) => {
      const p = bookingIdParamSchema.safeParse(req.params);
      if (!p.success) throw badRequest('VALIDATION_ERROR', 'Booking id must be a UUID');
      res.json({ success: true, data: await service.getPaymentLink(req.user!.id, p.data.id) });
    }),
  );

  if (opts.simulator ?? simulatorEnabled()) {
    router.post(
      '/payments/dev/simulate-escrow',
      ...patientOnly,
      asyncHandler(async (req, res) => {
        const p = bookingIdParamSchema.safeParse({ id: req.body?.bookingId });
        if (!p.success) throw badRequest('VALIDATION_ERROR', 'bookingId must be a UUID');
        res.json({ success: true, data: await service.simulateEscrowPayment(req.user!.id, p.data.id) });
      }),
    );
  }

  return router;
}
