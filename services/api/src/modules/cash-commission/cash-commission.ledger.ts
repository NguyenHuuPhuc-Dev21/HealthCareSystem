/**
 * The commission payment itself (BE-3 · Phase 5 · FR-PAY-02 cash part), in the escrow webhook's transaction.
 * Imports nothing from gateway-webhooks or any service, so the webhook can call it without a cycle.
 *
 * The nurse transfers from her own bank account to the platform: ONE COMMISSION_PAYMENT ledger row records it
 * (external_ref = gateway reference) WITHOUT moving any wallet balance — the commission is never taken from
 * deposit_balance or available_balance (FR-PAY-02, BR-05). Then the booking is SETTLED and a COMMISSION_OVERDUE
 * suspension is lifted when nothing overdue is left.
 */
import { BalanceType, TxType } from '@healthcare-system/shared';
import type { Queryable } from '../../core/database';
import { lockNurseWallet } from '../wallets-ledger/wallets-ledger.ledger';
import * as repo from './cash-commission.repo';
import type { CommissionPayment, CommissionResult } from './cash-commission.types';

export const commissionLedgerKey = (bookingId: string) => `commission:${bookingId}`;

export async function confirmCommissionPayment(db: Queryable, p: CommissionPayment, nowMs: number): Promise<CommissionResult> {
  const c = await repo.lockPaymentByCode(db, p.paymentCode);
  if (!c) return { outcome: 'UNKNOWN_COMMISSION', bookingId: null };
  if (c.provider_ref === p.providerRef) return { outcome: 'DUPLICATE', bookingId: c.booking_id };
  if (p.amount !== Number(c.amount)) return { outcome: 'AMOUNT_MISMATCH', bookingId: c.booking_id }; // nothing moves; Admin follows up
  if (c.paid_at) return { outcome: 'COMMISSION_RETURNED', bookingId: c.booking_id }; // paid twice: the second transfer goes back

  const wallet = await lockNurseWallet(db, c.nurse_id);
  const balance = Number(wallet.available_balance);
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO wallet_transactions
       (wallet_id, booking_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after, status, external_ref)
     VALUES ($1, $2, $3, $4::tx_type_enum, $5::balance_type_enum, $6, $7, $7, 'COMPLETED', $8)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [wallet.id, c.booking_id, commissionLedgerKey(c.booking_id), TxType.COMMISSION_PAYMENT, BalanceType.AVAILABLE, Number(c.amount), balance, p.providerRef],
  );
  if (rows.length === 0) return { outcome: 'DUPLICATE', bookingId: c.booking_id };
  const at = new Date(nowMs);
  await repo.markPaid(db, c.booking_id, { providerRef: p.providerRef, transactionId: rows[0].id, at });
  await repo.reactivateIfCleared(db, c.nurse_id, at);
  return { outcome: 'COMMISSION_PAID', bookingId: c.booking_id };
}
