/**
 * Nurse wallet ledger (BE-3 · Phase 5 · FR-PAY-01/03 · ADR-0004 · SEC-5.4/5.5/5.6).
 *
 * The ONE way money moves on a nurse wallet: settlements, deposit top-up / withhold / penalties / refund,
 * withdrawals and travel support all call postNurseEntry inside their own transaction.
 *
 *   - lock the wallet row (FOR UPDATE; created on first use),
 *   - idempotent: an idempotency key already in the ledger → nothing written, returns null,
 *   - one append-only wallet_transactions row (amount = |delta|, balance_before/after of the moved balance),
 *   - update that one balance.
 *
 * available_balance can never go negative (DB CHECK) → InsufficientBalanceError before touching anything.
 * deposit_balance MAY go negative (booked penalty debt, FR-PAY-03).
 * Customer escrow is gateway-webhooks.ledger's job; this file never touches escrow_locked_balance.
 */
import { BalanceType } from '@healthcare-system/shared';
import type { Queryable } from '../../core/database';
import type { NurseEntry, NurseWalletRow } from './wallets-ledger.types';

export class InsufficientBalanceError extends Error {
  constructor(
    readonly balance: number,
    readonly needed: number,
  ) {
    super(`Available balance ${balance} is less than ${needed}`);
    this.name = 'InsufficientBalanceError';
  }
}

/** Creates the nurse's wallet on first use, then locks it for this transaction. */
export async function lockNurseWallet(db: Queryable, userId: string): Promise<NurseWalletRow> {
  await db.query(`INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  const { rows } = await db.query<NurseWalletRow>(
    `SELECT id, available_balance, escrow_locked_balance, deposit_balance,
            deposit_grace_expires_at, deposit_grace_shifts_used, closure_requested_at
       FROM wallets WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  return rows[0];
}

export interface PostedEntry {
  transactionId: string;
  walletId: string;
  balanceBefore: number;
  balanceAfter: number;
}

/** Returns null (and writes nothing) when this idempotency key was already booked. */
export async function postNurseEntry(db: Queryable, e: NurseEntry): Promise<PostedEntry | null> {
  if (!Number.isSafeInteger(e.delta) || e.delta === 0) throw new Error(`Ledger delta must be a non-zero integer VND, got ${e.delta}`);
  const w = await lockNurseWallet(db, e.userId);
  // Checked after the lock: two concurrent retries of one key serialize on the wallet row.
  const dup = await db.query(`SELECT 1 FROM wallet_transactions WHERE idempotency_key = $1`, [e.idempotencyKey]);
  if (dup.rows.length > 0) return null;

  const column = e.balance === 'AVAILABLE' ? 'available_balance' : 'deposit_balance';
  const before = Number(e.balance === 'AVAILABLE' ? w.available_balance : w.deposit_balance);
  const after = before + e.delta;
  if (e.balance === 'AVAILABLE' && after < 0) throw new InsufficientBalanceError(before, -e.delta);

  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO wallet_transactions
       (wallet_id, booking_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after, status, external_ref)
     VALUES ($1, $2, $3, $4::tx_type_enum, $5::balance_type_enum, $6, $7, $8, 'COMPLETED', $9)
     RETURNING id`,
    [
      w.id,
      e.bookingId,
      e.idempotencyKey,
      e.txType,
      e.balance === 'AVAILABLE' ? BalanceType.AVAILABLE : BalanceType.DEPOSIT,
      Math.abs(e.delta),
      before,
      after,
      e.externalRef,
    ],
  );
  await db.query(`UPDATE wallets SET ${column} = $2, updated_at = now() WHERE id = $1`, [w.id, after]);
  return { transactionId: rows[0].id, walletId: w.id, balanceBefore: before, balanceAfter: after };
}

/** Idempotency keys owned by wallets-ledger — one per business event. */
export const nurseLedgerKeys = {
  travelSupport: (rejectionId: string) => `travel-support:${rejectionId}`,
};
