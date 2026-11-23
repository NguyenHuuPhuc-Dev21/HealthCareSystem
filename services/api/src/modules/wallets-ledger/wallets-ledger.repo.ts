/**
 * SQL of wallets-ledger (BE-3 · Phase 5). Reads only — postings go through wallets-ledger.ledger.ts.
 */
import type { TxType } from '@healthcare-system/shared';
import type { Queryable } from '../../core/database';
import type { TxCursor } from './wallets-ledger.policy';
import type {
  EarningRow,
  NurseStatusRow,
  NurseWalletRow,
  PendingTravelSupportRow,
  TxRow,
  UpcomingSettlementRow,
} from './wallets-ledger.types';

/** null = the nurse has never had a wallet (reads do not create one). */
export async function findWallet(db: Queryable, userId: string): Promise<NurseWalletRow | null> {
  const { rows } = await db.query<NurseWalletRow>(
    `SELECT id, available_balance, escrow_locked_balance, deposit_balance,
            deposit_grace_expires_at, deposit_grace_shifts_used, closure_requested_at
       FROM wallets WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function findNurseStatus(db: Queryable, userId: string): Promise<NurseStatusRow> {
  const { rows } = await db.query<NurseStatusRow>(
    `SELECT profile_status::text AS profile_status, suspended_reason FROM nurse_profiles WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? { profile_status: null, suspended_reason: null };
}

/** A completed cash booking whose 15% commission deadline passed without a COMMISSION_PAYMENT (FR-PAY-02). */
export async function hasOverdueCommission(db: Queryable, nurseId: string, now: Date): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1
       FROM bookings b
      WHERE b.nurse_id = $1
        AND b.payment_method = 'CASH'
        AND b.execution_status = 'COMPLETED'
        AND b.commission_due_at IS NOT NULL
        AND b.commission_due_at < $2
        AND NOT EXISTS (SELECT 1 FROM wallet_transactions t
                         WHERE t.booking_id = b.id AND t.tx_type = 'COMMISSION_PAYMENT' AND t.status = 'COMPLETED')
      LIMIT 1`,
    [nurseId, now],
  );
  return rows.length > 0;
}

/** Newest first; keyset on (created_at, id). `limit + 1` rows are read to know whether a next page exists. */
export async function listTransactions(
  db: Queryable,
  walletId: string,
  p: { types: TxType[] | null; cursor: TxCursor | null; limit: number },
): Promise<TxRow[]> {
  const { rows } = await db.query<TxRow>(
    `SELECT t.id, t.tx_type::text AS tx_type, t.status::text AS status, t.balance_type::text AS balance_type,
            t.amount, t.balance_before, t.balance_after, b.booking_code,
            t.created_at, t.created_at::text AS created_at_text
       FROM wallet_transactions t
       LEFT JOIN bookings b ON b.id = t.booking_id
      WHERE t.wallet_id = $1
        AND ($2::text[] IS NULL OR t.tx_type::text = ANY ($2::text[]))
        AND ($3::timestamptz IS NULL OR (t.created_at, t.id) < ($3::timestamptz, $4::uuid))
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT $5`,
    [walletId, p.types, p.cursor?.createdAt ?? null, p.cursor?.id ?? null, p.limit + 1],
  );
  return rows;
}

/** Completed credits that count as earnings, inside [from, to). */
export async function listEarnings(
  db: Queryable,
  walletId: string,
  types: readonly TxType[],
  from: Date,
  to: Date,
): Promise<EarningRow[]> {
  const { rows } = await db.query<EarningRow>(
    `SELECT created_at, (balance_after - balance_before) AS amount
       FROM wallet_transactions
      WHERE wallet_id = $1
        AND tx_type::text = ANY ($2::text[])
        AND status = 'COMPLETED'
        AND balance_after > balance_before
        AND created_at >= $3 AND created_at < $4`,
    [walletId, types, from, to],
  );
  return rows;
}

/**
 * Transfer-paid shifts of this nurse that are checked out, still held in escrow and not settled yet:
 * they settle at checkout + SETTLEMENT_COOLING_HOURS unless a dispute stops the clock.
 */
export async function listUpcomingSettlements(db: Queryable, nurseId: string): Promise<UpcomingSettlementRow[]> {
  const { rows } = await db.query<UpcomingSettlementRow>(
    `SELECT b.booking_code, s.name AS service_name, b.total_amount, b.platform_fee,
            l.checkout_time, b.dispute_status::text AS dispute_status
       FROM bookings b
       JOIN shift_logs l ON l.booking_id = b.id
       JOIN service_categories s ON s.id = b.service_id
      WHERE b.nurse_id = $1
        AND b.payment_method = 'BANK_TRANSFER'
        AND b.payment_status = 'ESCROW_HELD'
        AND b.settled_at IS NULL
        AND l.checkout_time IS NOT NULL
      ORDER BY l.checkout_time, b.booking_code`,
    [nurseId],
  );
  return rows;
}

/** Ids of travel support still owed (prescription-rejection, 0012), oldest first. Each is paid in its own transaction. */
export async function listPendingTravelSupportIds(db: Queryable, limit: number): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM prescription_rejections
      WHERE travel_support_status = 'PENDING'
      ORDER BY created_at
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.id);
}

/** Re-reads one rejection under lock (single payout). null when it does not exist. */
export async function lockTravelSupport(db: Queryable, rejectionId: string): Promise<(PendingTravelSupportRow & { travel_support_status: string }) | null> {
  const { rows } = await db.query<PendingTravelSupportRow & { travel_support_status: string }>(
    `SELECT id, booking_id, nurse_id, travel_support_amount, travel_support_status
       FROM prescription_rejections WHERE id = $1 FOR UPDATE`,
    [rejectionId],
  );
  return rows[0] ?? null;
}

export async function markTravelSupportPaid(db: Queryable, rejectionId: string, at: Date): Promise<void> {
  await db.query(
    `UPDATE prescription_rejections
        SET travel_support_status = 'PAID', travel_support_paid_at = $2
      WHERE id = $1 AND travel_support_status = 'PENDING'`,
    [rejectionId, at],
  );
}
