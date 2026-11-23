/**
 * Routes for deposits (mounted at /api/v1). Contract: docs/api/deposits.api.md
 * BE-3 · Phase 5 · ADR-0004. NURSE only; paths follow FE-2's apps/nurse-web/src/features/wallet/deposit.api.ts
 * and wallet.api.ts (bank account). Admin actions are mounted by admin-finance (Phase 7).
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import { simulatorEnabled } from '../gateway-webhooks/gateway-webhooks.service';
import type { DepositsService } from './deposits.service';
import { MAX_APPEAL_EVIDENCE } from './deposits.types';

const idParam = z.object({ id: z.string().uuid() });
const txIdParam = z.object({ txId: z.string().uuid() });
const topupBody = z.object({ amount: z.number().int().positive() });
const appealBody = z.object({
  reason: z.string().trim().min(20).max(2000),
  evidenceKeys: z
    .array(z.string().trim().min(1).max(500).refine((k) => !k.includes('..'), 'invalid key'))
    .max(MAX_APPEAL_EVIDENCE)
    .optional(),
});
const bankBody = z.object({
  bankName: z.string().trim().min(2).max(100),
  accountNumber: z.string().trim().regex(/^[0-9]{6,30}$/, 'digits only, 6–30'),
  accountHolder: z.string().trim().min(2).max(150),
});

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid request', r.error.flatten().fieldErrors);
  return r.data;
}

export function createDepositsRouter(service: DepositsService, opts: { simulator?: boolean } = {}): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.get(
    '/wallets/me/deposit',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getStatus(req.user!.id) });
    }),
  );

  router.post(
    '/wallets/deposit/topup-link',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const { amount } = parse(topupBody, req.body);
      res.status(201).json({ success: true, data: await service.createTopupLink(req.user!.id, amount) });
    }),
  );

  router.get(
    '/wallets/deposit/topups/:id',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      res.json({ success: true, data: await service.getTopupStatus(req.user!.id, id) });
    }),
  );

  if (opts.simulator ?? simulatorEnabled()) {
    router.post(
      '/wallets/deposit/topups/:id/dev/simulate',
      ...nurseOnly,
      asyncHandler(async (req, res) => {
        const { id } = parse(idParam, req.params);
        res.json({ success: true, data: await service.simulateTopupPayment(req.user!.id, id) });
      }),
    );
  }

  router.get(
    '/wallets/me/deposit/penalties',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.listPenalties(req.user!.id) });
    }),
  );

  router.post(
    '/wallets/me/deposit/penalties/:txId/appeal',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const { txId } = parse(txIdParam, req.params);
      const body = parse(appealBody, req.body);
      res.status(201).json({ success: true, data: await service.appealPenalty(req.user!.id, txId, body) });
    }),
  );

  router.get(
    '/wallets/me/deposit/refund-request',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getRefundRequest(req.user!.id) });
    }),
  );

  router.post(
    '/wallets/me/deposit/refund-request',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.status(201).json({ success: true, data: await service.requestClosure(req.user!.id) });
    }),
  );

  router.post(
    '/wallets/me/deposit/refund-request/:id/cancel',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      res.json({ success: true, data: await service.cancelRefundRequest(req.user!.id, id) });
    }),
  );

  router.get(
    '/nurse/bank-account',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getBankAccount(req.user!.id) });
    }),
  );

  router.put(
    '/nurse/bank-account',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const b = parse(bankBody, req.body);
      const data = await service.setBankAccount(req.user!.id, {
        bank_name: b.bankName,
        account_no: b.accountNumber,
        account_holder: b.accountHolder,
      });
      res.json({ success: true, data });
    }),
  );

  return router;
}
