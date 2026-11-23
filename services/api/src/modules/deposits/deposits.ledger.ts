/**
 * Deposit money movements (BE-3 · Phase 5 · ADR-0004 D1–D3). Each function runs in the CALLER's transaction and
 * books through wallets-ledger's postNurseEntry (wallet row lock, idempotency key, one append-only row).
 *
 *   confirmTopup    gateway-webhooks, for a "KQ…" transfer: TOPUP (≤ shortfall), the rest returned by the custody partner
 *   deductPenalty   cancellation / no-show / dispute flows: PENALTY_DEDUCT + deposit_penalty_details (appeal deadline)
 *   reversePenalty  disputes (Phase 6) when a penalty appeal is upheld: PENALTY_REVERSAL + details (append-only)
 *
 * Imports nothing from gateway-webhooks or any service, so any module can call it without a cycle.
 */
import { PenaltyReason, TxType } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import type { Queryable } from '../../core/database';
import { lockNurseWallet, postNurseEntry } from '../wallets-ledger/wallets-ledger.ledger';
import { splitTopup } from './deposits.policy';
import * as repo from './deposits.repo';
import type { PenaltyInput, TopupPayment, TopupResult } from './deposits.types';

const DAY_MS = 86_400_000;

export const depositLedgerKeys = {
  topup: (providerRef: string) => `deposit-topup:${providerRef}`,
  penalty: (reason: string, bookingId: string) => `deposit-penalty:${reason}:${bookingId}`,
  reversal: (penaltyTxId: string) => `deposit-penalty-reversal:${penaltyTxId}`,
  refund: (requestId: string) => `deposit-refund:${requestId}`,
};

export type ConfigReader = (key: 'MIN_NURSE_DEPOSIT' | 'PENALTY_APPEAL_DAYS') => Promise<number>;

/**
 * A verified, successful gateway payment whose orderCode is a top-up code. Never throws for business cases:
 * the outcome is recorded by the webhook (payment_webhook_events) and money moves at most once per reference.
 */
export async function confirmTopup(
  db: Queryable,
  p: TopupPayment,
  nowMs: number,
  cfg: ConfigReader = getConfigNumber,
): Promise<TopupResult> {
  const t = await repo.lockTopupByCode(db, p.paymentCode);
  if (!t) return { outcome: 'UNKNOWN_TOPUP', topupId: null, credited: 0, returned: 0 };
  const dup = await db.query(`SELECT 1 FROM wallet_transactions WHERE idempotency_key = $1`, [depositLedgerKeys.topup(p.providerRef)]);
  if (dup.rows.length > 0 || t.provider_ref === p.providerRef) return { outcome: 'DUPLICATE', topupId: t.id, credited: 0, returned: 0 };
  if (p.amount !== Number(t.amount)) return { outcome: 'AMOUNT_MISMATCH', topupId: t.id, credited: 0, returned: 0 };

  const paidAt = new Date(nowMs);
  if (t.status === 'COMPLETED' || t.status === 'RETURNED') {
    // The same link paid twice with another reference: the deposit is not topped up again — all of it goes back.
    return { outcome: 'TOPUP_RETURNED', topupId: t.id, credited: 0, returned: p.amount };
  }

  const wallet = await lockNurseWallet(db, t.nurse_id);
  const { credit, returned } = splitTopup(p.amount, Number(wallet.deposit_balance), await cfg('MIN_NURSE_DEPOSIT'));
  let transactionId: string | null = null;
  if (credit > 0) {
    const posted = await postNurseEntry(db, {
      userId: t.nurse_id,
      bookingId: null,
      txType: TxType.TOPUP,
      balance: 'DEPOSIT',
      delta: credit,
      idempotencyKey: depositLedgerKeys.topup(p.providerRef),
      externalRef: p.providerRef, // custody partner reference (ADR-0004 D1)
    });
    transactionId = posted?.transactionId ?? null;
  }
  await repo.finishTopup(db, t.id, {
    status: credit > 0 ? 'COMPLETED' : 'RETURNED',
    providerRef: p.providerRef,
    credited: credit,
    returned,
    transactionId,
    paidAt,
  });
  const outcome = credit === 0 ? 'TOPUP_RETURNED' : returned > 0 ? 'TOPUP_EXCESS_RETURNED' : 'TOPUP_CREDITED';
  return { outcome, topupId: t.id, credited: credit, returned };
}

/**
 * Takes an SLA penalty from the deposit (ADR-0004 D3; deposit may go negative = booked debt, FR-PAY-03) and explains it.
 * Appealable for PENALTY_APPEAL_DAYS unless decided by a dispute (DISPUTE_UPHELD). Returns null when already booked.
 */
export async function deductPenalty(
  db: Queryable,
  p: PenaltyInput,
  nowMs: number,
  cfg: ConfigReader = getConfigNumber,
): Promise<{ transactionId: string } | null> {
  if (!Number.isSafeInteger(p.amount) || p.amount <= 0) throw new Error(`Penalty amount must be a positive integer VND, got ${p.amount}`);
  if (p.reason === PenaltyReason.DISPUTE_UPHELD && !p.disputeId) throw new Error('A DISPUTE_UPHELD penalty needs its dispute');
  const key = p.idempotencyKey ?? (p.bookingId ? depositLedgerKeys.penalty(p.reason, p.bookingId) : null);
  if (!key) throw new Error('A penalty without a booking needs an explicit idempotencyKey');

  const posted = await postNurseEntry(db, {
    userId: p.nurseId,
    bookingId: p.bookingId,
    txType: TxType.PENALTY_DEDUCT,
    balance: 'DEPOSIT',
    delta: -p.amount,
    idempotencyKey: key,
    externalRef: null,
  });
  if (!posted) return null;
  const appealable = p.reason !== PenaltyReason.DISPUTE_UPHELD;
  await repo.insertPenaltyDetails(db, {
    transactionId: posted.transactionId,
    reason: p.reason,
    slaRuleRef: p.slaRuleRef,
    bookingId: p.bookingId,
    disputeId: p.disputeId ?? null,
    note: p.note ?? null,
    appealDeadline: appealable ? new Date(nowMs + (await cfg('PENALTY_APPEAL_DAYS')) * DAY_MS) : null,
    reversesTransactionId: null,
    decidedBy: p.decidedBy ?? null,
  });
  return { transactionId: posted.transactionId };
}

export class PenaltyNotFoundError extends Error {
  constructor(id: string) {
    super(`No deposit penalty ${id}`);
    this.name = 'PenaltyNotFoundError';
  }
}

/**
 * An upheld appeal credits the penalty back (the original row is never edited). Idempotent: returns null when the
 * penalty was already reversed.
 */
export async function reversePenalty(
  db: Queryable,
  r: { penaltyTransactionId: string; decidedBy: string; note: string },
): Promise<{ transactionId: string } | null> {
  const p = await repo.findPenaltyById(db, r.penaltyTransactionId);
  if (!p) throw new PenaltyNotFoundError(r.penaltyTransactionId);
  const posted = await postNurseEntry(db, {
    userId: p.user_id,
    bookingId: p.booking_id,
    txType: TxType.PENALTY_REVERSAL,
    balance: 'DEPOSIT',
    delta: Number(p.amount),
    idempotencyKey: depositLedgerKeys.reversal(r.penaltyTransactionId),
    externalRef: null,
  });
  if (!posted) return null;
  await repo.insertPenaltyDetails(db, {
    transactionId: posted.transactionId,
    reason: p.reason,
    slaRuleRef: p.sla_rule_ref,
    bookingId: p.booking_id,
    disputeId: p.dispute_id,
    note: r.note,
    appealDeadline: null,
    reversesTransactionId: r.penaltyTransactionId,
    decidedBy: r.decidedBy,
  });
  return { transactionId: posted.transactionId };
}
