/**
 * Routes for withdrawals (mounted at /api/v1). Contract: docs/api/withdrawals.api.md
 * BE-3 · Phase 5 · FR-PAY-04. NURSE only; paths follow FE-2's apps/nurse-web/src/features/wallet/wallet.api.ts.
 * Admin actions are mounted by admin-finance (Phase 7).
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import type { WithdrawalsService } from './withdrawals.service';

const body = z.object({ amount: z.number().int().positive() });
const idempotencyKey = z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

export function createWithdrawalsRouter(service: WithdrawalsService): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.post(
    '/wallets/withdraw',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const b = body.safeParse(req.body);
      if (!b.success) throw badRequest('INVALID_AMOUNT', 'The amount must be a positive whole number of VND');
      const header = req.header('Idempotency-Key');
      let key: string | undefined;
      if (header !== undefined) {
        const k = idempotencyKey.safeParse(header);
        if (!k.success) throw badRequest('VALIDATION_ERROR', 'Idempotency-Key must be 8–64 letters, digits, - or _');
        key = k.data;
      }
      res.status(201).json({ success: true, data: await service.requestWithdrawal(req.user!.id, b.data.amount, key) });
    }),
  );

  router.get(
    '/wallets/withdrawals',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.listWithdrawals(req.user!.id) });
    }),
  );

  return router;
}
