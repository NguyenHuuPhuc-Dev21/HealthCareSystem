/**
 * Routes for cash-commission (mounted at /api/v1). Contract: docs/api/cash-commission.api.md
 * BE-3 · Phase 5 · FR-PAY-02. NURSE only; paths follow FE-2's features/commission-payment/commission-payment.api.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import { simulatorEnabled } from '../gateway-webhooks/gateway-webhooks.service';
import type { CashCommissionService } from './cash-commission.service';

const idParam = z.object({ id: z.string().uuid() });

function bookingId(params: unknown): string {
  const p = idParam.safeParse(params);
  if (!p.success) throw badRequest('VALIDATION_ERROR', 'Booking id must be a UUID');
  return p.data.id;
}

export function createCashCommissionRouter(service: CashCommissionService, opts: { simulator?: boolean } = {}): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.get(
    '/nurse/commission-debts',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.listDebts(req.user!.id) });
    }),
  );

  router.post(
    '/bookings/:id/commission-payment-link',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.createPaymentLink(req.user!.id, bookingId(req.params)) });
    }),
  );

  if (opts.simulator ?? simulatorEnabled()) {
    router.post(
      '/bookings/:id/confirm-commission',
      ...nurseOnly,
      asyncHandler(async (req, res) => {
        res.json({ success: true, data: await service.simulatePayment(req.user!.id, bookingId(req.params)) });
      }),
    );
  }

  return router;
}
