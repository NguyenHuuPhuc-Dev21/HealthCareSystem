/**
 * Routes for admin-finance (mounted at /api/v1). Contract: docs/api/admin-finance.api.md
 * BE-3 · Phase 7 · FR-ADMIN-01 · CT-15. ADMIN only (ADMIN sessions exist only after TOTP 2FA, accounts-otp).
 * GET /admin/finance/reconciliation follows admin-web features/finance/finance.api.ts.
 */
import { Router, type Request } from 'express';
import { z } from 'zod';
import { DepositRefundStatus, UserRole, WithdrawalStatus } from '@healthcare-system/shared';
import { badRequest } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import type { AdminFinanceService } from './admin-finance.service';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const periodQuery = z.object({ from: date.optional(), to: date.optional() });
const idParam = z.object({ id: z.string().uuid() });
const bookingParam = z.object({ bookingId: z.string().uuid() });
const runDateParam = z.object({ runDate: date });
const reason = z.string().trim().min(10).max(1000);
const ref = z.string().trim().min(1).max(100);

const withdrawalQuery = z.object({ status: z.nativeEnum(WithdrawalStatus).optional() });
const refundQuery = z.object({ status: z.nativeEnum(DepositRefundStatus).optional() });
const holdQuery = z.object({ open: z.enum(['true', 'false']).optional() });

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid request', r.error.flatten());
  return r.data;
}

const ipOf = (req: Request): string | undefined => req.ip ?? undefined;

export function createAdminFinanceRouter(service: AdminFinanceService): Router {
  const router = Router();
  const admin = [authGuard, roleGuard([UserRole.ADMIN])];

  router.get(
    '/admin/finance/reconciliation',
    ...admin,
    asyncHandler(async (req, res) => {
      const q = parse(periodQuery, req.query);
      res.json({ success: true, data: await service.reconciliation(q.from, q.to) });
    }),
  );

  router.get(
    '/admin/finance/ledger-export',
    ...admin,
    asyncHandler(async (req, res) => {
      const q = parse(periodQuery, req.query);
      const out = await service.exportLedger(req.user!.id, q.from, q.to, ipOf(req));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(out.csv);
    }),
  );

  // ---- withdrawals ----
  router.get(
    '/admin/finance/withdrawals',
    ...admin,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.listWithdrawals(parse(withdrawalQuery, req.query).status) });
    }),
  );
  router.post(
    '/admin/finance/withdrawals/:id/approve',
    ...admin,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      const b = parse(z.object({ payoutRef: ref.optional() }), req.body ?? {});
      res.json({ success: true, data: await service.approveWithdrawal(req.user!.id, id, b.payoutRef ?? null, ipOf(req)) });
    }),
  );
  router.post(
    '/admin/finance/withdrawals/:id/reject',
    ...admin,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      const b = parse(z.object({ reason }), req.body);
      res.json({ success: true, data: await service.rejectWithdrawal(req.user!.id, id, b.reason, ipOf(req)) });
    }),
  );

  // ---- deposit closure refunds ----
  router.get(
    '/admin/finance/deposit-refunds',
    ...admin,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.listDepositRefunds(parse(refundQuery, req.query).status) });
    }),
  );
  router.post(
    '/admin/finance/deposit-refunds/:id/payout',
    ...admin,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      const b = parse(z.object({ externalRef: ref.optional() }), req.body ?? {});
      res.json({ success: true, data: await service.payoutDepositRefund(req.user!.id, id, b.externalRef ?? null, ipOf(req)) });
    }),
  );
  router.post(
    '/admin/finance/deposit-refunds/:id/reject',
    ...admin,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      const b = parse(z.object({ reason }), req.body);
      res.json({ success: true, data: await service.rejectDepositRefund(req.user!.id, id, b.reason, ipOf(req)) });
    }),
  );

  // ---- holds ----
  router.get(
    '/admin/finance/deposit-reconciliations',
    ...admin,
    asyncHandler(async (_req, res) => {
      res.json({ success: true, data: await service.listReconciliations() });
    }),
  );
  router.post(
    '/admin/finance/deposit-reconciliations/:runDate/resolve',
    ...admin,
    asyncHandler(async (req, res) => {
      const { runDate } = parse(runDateParam, req.params);
      const b = parse(z.object({ note: reason }), req.body);
      res.json({ success: true, data: await service.resolveReconciliation(req.user!.id, runDate, b.note, ipOf(req)) });
    }),
  );
  router.get(
    '/admin/finance/settlement-holds',
    ...admin,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.listSettlementHolds(parse(holdQuery, req.query).open !== 'false') });
    }),
  );
  router.post(
    '/admin/finance/settlement-holds/:bookingId/resolve',
    ...admin,
    asyncHandler(async (req, res) => {
      const { bookingId } = parse(bookingParam, req.params);
      const b = parse(z.object({ note: reason }), req.body);
      res.json({ success: true, data: await service.resolveSettlementHold(req.user!.id, bookingId, b.note, ipOf(req)) });
    }),
  );

  // ---- debts ----
  router.get(
    '/admin/finance/nurse-debts',
    ...admin,
    asyncHandler(async (_req, res) => {
      res.json({ success: true, data: await service.listNurseDebts() });
    }),
  );

  return router;
}
