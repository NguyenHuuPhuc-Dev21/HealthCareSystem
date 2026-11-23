/**
 * Routes for wallets-ledger (mounted at /api/v1). Contract: docs/api/wallets-ledger.api.md
 * BE-3 · Phase 5. NURSE only; paths follow FE-2's apps/nurse-web/src/features/wallet/wallet.api.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import type { WalletsLedgerService } from './wallets-ledger.service';
import { MAX_TX_PAGE_SIZE } from './wallets-ledger.types';

const transactionsQuery = z.object({
  type: z.string().trim().min(1).max(40).optional(),
  cursor: z.string().trim().min(1).max(300).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_TX_PAGE_SIZE).optional(),
});

const earningsQuery = z.object({ range: z.enum(['week', 'month']).default('week') });

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid query', r.error.flatten().fieldErrors);
  return r.data;
}

export function createWalletsLedgerRouter(service: WalletsLedgerService): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.get(
    '/wallets/me',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getSummary(req.user!.id) });
    }),
  );

  router.get(
    '/wallets/me/transactions',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const q = parse(transactionsQuery, req.query);
      res.json({ success: true, data: await service.listTransactions(req.user!.id, q) });
    }),
  );

  router.get(
    '/wallets/me/earnings',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const q = parse(earningsQuery, req.query);
      res.json({ success: true, data: await service.getEarnings(req.user!.id, q.range) });
    }),
  );

  router.get(
    '/wallets/me/upcoming-settlements',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getUpcomingSettlements(req.user!.id) });
    }),
  );

  return router;
}
