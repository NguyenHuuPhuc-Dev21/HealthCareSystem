/**
 * Escrow ledger for bank-transfer bookings (BE-3 · FR-PAY-01 · BR-04 §2.1 · SEC-5.4/5.5/5.6).
 *
 * The customer's prepayment is held per booking in the customer's wallet `escrow_locked_balance`
 * (simulated escrow, SRS §1.3). Every movement is ONE append-only wallet_transactions row whose
 * idempotency_key is UNIQUE, written in the caller's transaction after locking the wallet row.
 *
 *   holdEscrow    ESCROW_HOLD  escrow_locked += amount   (verified gateway webhook)
 *   refundEscrow  REFUND       escrow_locked -= amount   (unmatched expiry, late / extra payment)
 *   releaseEscrow ESCROW_RELEASE escrow_locked -= amount (settlements: paid out to the nurse + platform commission)
 *
 * Nurse deposit money (ADR-0004) is never touched here: escrow and deposit stay strictly separate.
 * Shared by gateway-webhooks and booking-expiry; it imports nothing from either service.
 */
import { BalanceType, TxType } from '@healthcare-system/shared';
import type { Queryable } from '../../core/database';

export type WalletRow = { id: string; escrow_locked_balance: string | number };

/** Creates the customer's wallet on first use, then locks it (FOR UPDATE) for this transaction. */
export async function lockCustomerWallet(db: Queryable, userId: string): Promise<WalletRow> {
  await db.query(`INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  const { rows } = await db.query<WalletRow>(
    `SELECT id, escrow_locked_balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  return rows[0];
}

export async function ledgerEntryExists(db: Queryable, idempotencyKey: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM wallet_transactions WHERE idempotency_key = $1`, [idempotencyKey]);
  return rows.length > 0;
}

interface Movement {
  customerId: string;
  bookingId: string;
  amount: number;
  idempotencyKey: string;
  externalRef: string | null;
}

/** Returns false (and writes nothing) when this idempotency key was already booked. */
export async function holdEscrow(db: Queryable, m: Movement): Promise<boolean> {
  if (await ledgerEntryExists(db, m.idempotencyKey)) return false;
  const w = await lockCustomerWallet(db, m.customerId);
  const before = Number(w.escrow_locked_balance);
  const after = before + m.amount;
  await db.query(
    `INSERT INTO wallet_transactions
       (wallet_id, booking_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after, status, external_ref)
     VALUES ($1, $2, $3, $4::tx_type_enum, $5::balance_type_enum, $6, $7, $8, 'COMPLETED', $9)`,
    [w.id, m.bookingId, m.idempotencyKey, TxType.ESCROW_HOLD, BalanceType.ESCROW_LOCKED, m.amount, before, after, m.externalRef],
  );
  await db.query(`UPDATE wallets SET escrow_locked_balance = $2, updated_at = now() WHERE id = $1`, [w.id, after]);
  return true;
}

export class EscrowInconsistencyError extends Error {
  constructor(bookingId: string, held: number, amount: number) {
    super(`Escrow of booking ${bookingId}: wallet holds ${held}, refund needs ${amount}`);
    this.name = 'EscrowInconsistencyError';
  }
}

/**
 * Returns false when already refunded under this key. Throws EscrowInconsistencyError when the wallet
 * does not hold enough (never silently refunds money that was not held) — the job retries, then DLQ alerts.
 */
export async function refundEscrow(db: Queryable, m: Movement): Promise<boolean> {
  if (await ledgerEntryExists(db, m.idempotencyKey)) return false;
  const w = await lockCustomerWallet(db, m.customerId);
  const before = Number(w.escrow_locked_balance);
  if (before < m.amount) throw new EscrowInconsistencyError(m.bookingId, before, m.amount);
  const after = before - m.amount;
  await db.query(
    `INSERT INTO wallet_transactions
       (wallet_id, booking_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after, status, external_ref)
     VALUES ($1, $2, $3, $4::tx_type_enum, $5::balance_type_enum, $6, $7, $8, 'COMPLETED', $9)`,
    [w.id, m.bookingId, m.idempotencyKey, TxType.REFUND, BalanceType.ESCROW_LOCKED, m.amount, before, after, m.externalRef],
  );
  await db.query(`UPDATE wallets SET escrow_locked_balance = $2, updated_at = now() WHERE id = $1`, [w.id, after]);
  return true;
}

/**
 * Settlement (FR-PAY-02): the held money leaves the customer's escrow towards the nurse and the platform.
 * Same guarantees as refundEscrow: false when already booked, EscrowInconsistencyError when not enough is held.
 */
export async function releaseEscrow(db: Queryable, m: Movement): Promise<boolean> {
  if (await ledgerEntryExists(db, m.idempotencyKey)) return false;
  const w = await lockCustomerWallet(db, m.customerId);
  const before = Number(w.escrow_locked_balance);
  if (before < m.amount) throw new EscrowInconsistencyError(m.bookingId, before, m.amount);
  const after = before - m.amount;
  await db.query(
    `INSERT INTO wallet_transactions
       (wallet_id, booking_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after, status, external_ref)
     VALUES ($1, $2, $3, $4::tx_type_enum, $5::balance_type_enum, $6, $7, $8, 'COMPLETED', $9)`,
    [w.id, m.bookingId, m.idempotencyKey, TxType.ESCROW_RELEASE, BalanceType.ESCROW_LOCKED, m.amount, before, after, m.externalRef],
  );
  await db.query(`UPDATE wallets SET escrow_locked_balance = $2, updated_at = now() WHERE id = $1`, [w.id, after]);
  return true;
}

/** Idempotency keys — one per business event, so retries and re-deliveries book money exactly once. */
export const ledgerKeys = {
  hold: (providerRef: string) => `escrow-hold:${providerRef}`,
  refundPayment: (providerRef: string) => `escrow-refund:${providerRef}`,
  refundUnmatched: (bookingId: string) => `escrow-refund:unmatched:${bookingId}`,
  release: (bookingId: string) => `escrow-release:${bookingId}`,
};
