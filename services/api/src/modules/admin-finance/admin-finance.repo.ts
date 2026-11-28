/**
 * admin-finance — SQL (BE-3 · Phase 7). Read-only reports over the append-only ledger and the finance tables;
 * the Admin actions themselves run in withdrawals / deposits / settlements (one transaction, audited there).
 */
import type { Queryable } from '../../core/database';
import type { LedgerExportRow, Period } from './admin-finance.types';

type N = string | number | null;
const num = (v: N): number => Number(v ?? 0);

/** Balances right now (Σ wallets) and the same balances rebuilt from the ledger. */
export async function snapshot(db: Queryable, nowAt: Date) {
  const { rows } = await db.query<Record<string, N>>(
    `SELECT
       (SELECT COALESCE(sum(escrow_locked_balance), 0) FROM wallets)                         AS escrow_wallets,
       (SELECT COALESCE(sum(available_balance), 0) FROM wallets)                             AS available_wallets,
       (SELECT COALESCE(sum(deposit_balance), 0) FROM wallets)                               AS deposit_wallets,
       (SELECT COALESCE(sum(GREATEST(deposit_balance, 0)), 0) FROM wallets)                  AS deposits_held,
       (SELECT COALESCE(sum(GREATEST(-deposit_balance, 0)), 0) FROM wallets)                 AS deposit_debt,
       l.escrow_ledger, l.available_ledger, l.deposit_ledger,
       (SELECT COALESCE(sum(amount), 0) FROM withdrawal_requests WHERE status = 'WITHDRAW_REQUESTED') AS pending_withdrawals,
       (SELECT count(*) FROM withdrawal_requests WHERE status = 'WITHDRAW_REQUESTED')        AS pending_withdrawals_count,
       (SELECT COALESCE(sum(platform_fee), 0) FROM bookings
         WHERE payment_method = 'CASH' AND commission_due_at IS NOT NULL AND settled_at IS NULL) AS cash_unpaid,
       (SELECT COALESCE(sum(platform_fee), 0) FROM bookings
         WHERE payment_method = 'CASH' AND commission_due_at IS NOT NULL AND settled_at IS NULL
           AND commission_due_at < $1)                                                       AS cash_overdue,
       (SELECT count(*) FROM deposit_refund_requests WHERE status IN ('REQUESTED', 'WAITING_HOLD', 'READY')) AS pending_refunds,
       (SELECT count(*) FROM settlement_holds WHERE resolved_at IS NULL)                     AS open_holds
     FROM (SELECT
             COALESCE(sum(balance_after - balance_before) FILTER (WHERE balance_type = 'ESCROW_LOCKED'), 0) AS escrow_ledger,
             COALESCE(sum(balance_after - balance_before) FILTER (WHERE balance_type = 'AVAILABLE'), 0)     AS available_ledger,
             COALESCE(sum(balance_after - balance_before) FILTER (WHERE balance_type = 'DEPOSIT'), 0)       AS deposit_ledger
             FROM wallet_transactions WHERE status = 'COMPLETED') l`,
    [nowAt],
  );
  const r = rows[0];
  return {
    escrowWallets: num(r.escrow_wallets),
    availableWallets: num(r.available_wallets),
    depositWallets: num(r.deposit_wallets),
    escrowLedger: num(r.escrow_ledger),
    availableLedger: num(r.available_ledger),
    depositLedger: num(r.deposit_ledger),
    depositsHeld: num(r.deposits_held),
    depositDebt: num(r.deposit_debt),
    pendingWithdrawals: num(r.pending_withdrawals),
    pendingWithdrawalsCount: num(r.pending_withdrawals_count),
    cashUnpaid: num(r.cash_unpaid),
    cashOverdue: num(r.cash_overdue),
    pendingRefunds: num(r.pending_refunds),
    openHolds: num(r.open_holds),
  };
}

/** Money that moved in [fromAt, toAt). */
export async function periodFlows(db: Queryable, p: Period) {
  const { rows } = await db.query<Record<string, N>>(
    `SELECT
       COALESCE(sum(amount) FILTER (WHERE tx_type = 'ESCROW_HOLD'), 0)                                   AS escrow_received,
       COALESCE(sum(amount) FILTER (WHERE tx_type = 'REFUND' AND balance_type = 'ESCROW_LOCKED'), 0)     AS refunds,
       COALESCE(sum(amount) FILTER (WHERE tx_type = 'PENALTY_DEDUCT'), 0)                                AS penalties,
       COALESCE(sum(amount) FILTER (WHERE tx_type = 'PENALTY_REVERSAL'), 0)                              AS reversals,
       COALESCE(sum(amount) FILTER (WHERE tx_type = 'DEPOSIT_REFUND'), 0)                                AS deposit_refunds,
       (SELECT COALESCE(sum(commission_amount), 0) FROM settlements WHERE settled_at >= $1 AND settled_at < $2) AS commission_transfer,
       (SELECT COALESCE(sum(payout_amount), 0) FROM settlements WHERE settled_at >= $1 AND settled_at < $2)     AS payouts,
       (SELECT COALESCE(sum(deposit_withheld), 0) FROM settlements WHERE settled_at >= $1 AND settled_at < $2)  AS withheld,
       (SELECT COALESCE(sum(amount), 0) FROM commission_payments WHERE paid_at >= $1 AND paid_at < $2)          AS commission_cash,
       (SELECT COALESCE(sum(amount), 0) FROM withdrawal_requests
         WHERE status = 'WITHDRAWN' AND reviewed_at >= $1 AND reviewed_at < $2)                                   AS withdrawals_paid
     FROM wallet_transactions
     WHERE status = 'COMPLETED' AND created_at >= $1 AND created_at < $2`,
    [p.fromAt, p.toAt],
  );
  const r = rows[0];
  return {
    escrowReceived: num(r.escrow_received),
    refunds: num(r.refunds),
    penalties: num(r.penalties),
    reversals: num(r.reversals),
    depositRefunds: num(r.deposit_refunds),
    commissionTransfer: num(r.commission_transfer),
    commissionCash: num(r.commission_cash),
    payouts: num(r.payouts),
    withheld: num(r.withheld),
    withdrawalsPaid: num(r.withdrawals_paid),
  };
}

export async function lastReconciliation(db: Queryable) {
  const { rows } = await db.query<{ run_date: string; status: 'OK' | 'MISMATCH'; resolved: boolean }>(
    `SELECT to_char(run_date, 'YYYY-MM-DD') AS run_date, status, resolved_at IS NOT NULL AS resolved
       FROM deposit_reconciliations ORDER BY run_date DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function countLedgerRows(db: Queryable, p: Period): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM wallet_transactions WHERE created_at >= $1 AND created_at < $2`,
    [p.fromAt, p.toAt],
  );
  return rows[0].n;
}

export async function ledgerRows(db: Queryable, p: Period, limit: number): Promise<LedgerExportRow[]> {
  const { rows } = await db.query<LedgerExportRow>(
    `SELECT t.created_at, t.tx_type::text AS tx_type, t.balance_type::text AS balance_type, t.status::text AS status,
            t.amount, t.balance_before, t.balance_after, w.user_id, u.role::text AS role, b.booking_code,
            t.idempotency_key, t.external_ref
       FROM wallet_transactions t
       JOIN wallets w ON w.id = t.wallet_id
       JOIN users u ON u.id = w.user_id
       LEFT JOIN bookings b ON b.id = t.booking_id
      WHERE t.created_at >= $1 AND t.created_at < $2
      ORDER BY t.created_at, t.id
      LIMIT $3`,
    [p.fromAt, p.toAt, limit],
  );
  return rows;
}

// ---- queues -----------------------------------------------------------------------------------------

export async function listWithdrawals(db: Queryable, status: string, limit: number) {
  const { rows } = await db.query(
    `SELECT r.id, w.user_id AS nurse_id, u.full_name, u.phone, r.amount, r.bank_name, r.bank_account_no, r.account_holder,
            r.status::text AS status, r.reject_reason, r.payout_ref, r.created_at, r.reviewed_at
       FROM withdrawal_requests r
       JOIN wallets w ON w.id = r.wallet_id
       JOIN users u ON u.id = w.user_id
      WHERE r.status = $1::withdrawal_status_enum
      ORDER BY r.created_at ${status === 'WITHDRAW_REQUESTED' ? 'ASC' : 'DESC'}
      LIMIT $2`,
    [status, limit],
  );
  return rows;
}

export async function listDepositRefunds(db: Queryable, statuses: string[], limit: number) {
  const { rows } = await db.query(
    `SELECT r.id, w.user_id AS nurse_id, u.full_name, r.status::text AS status, r.pending_reasons, r.eligible_at,
            w.deposit_balance, r.refund_amount, r.bank_name, r.bank_account_no, r.account_holder, r.due_by,
            r.reject_reason, r.requested_at, r.updated_at
       FROM deposit_refund_requests r
       JOIN wallets w ON w.id = r.wallet_id
       JOIN users u ON u.id = w.user_id
      WHERE r.status::text = ANY($1::text[])
      ORDER BY r.due_by NULLS LAST, r.requested_at
      LIMIT $2`,
    [statuses, limit],
  );
  return rows;
}

export async function listReconciliations(db: Queryable, limit: number) {
  const { rows } = await db.query(
    `SELECT id, to_char(run_date, 'YYYY-MM-DD') AS run_date, status, wallets_total, ledger_total, custody_total,
            mismatched_wallets, details, resolved_at, resolution_note
       FROM deposit_reconciliations ORDER BY run_date DESC LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function listSettlementHolds(db: Queryable, openOnly: boolean, limit: number) {
  const { rows } = await db.query(
    `SELECT h.booking_id, b.booking_code, b.nurse_id, b.total_amount, h.reason, h.detected_at, h.resolved_at, h.resolution_note
       FROM settlement_holds h JOIN bookings b ON b.id = h.booking_id
      WHERE NOT $1::boolean OR h.resolved_at IS NULL
      ORDER BY h.detected_at DESC
      LIMIT $2`,
    [openOnly, limit],
  );
  return rows;
}

/** Nurses who owe money: a deposit below zero or a cash commission not yet paid. */
export async function listNurseDebts(db: Queryable, nowAt: Date, limit: number) {
  const { rows } = await db.query(
    `WITH cash AS (
       SELECT nurse_id,
              sum(platform_fee) AS unpaid,
              sum(platform_fee) FILTER (WHERE commission_due_at < $1) AS overdue,
              count(*) AS bookings
         FROM bookings
        WHERE payment_method = 'CASH' AND commission_due_at IS NOT NULL AND settled_at IS NULL AND platform_fee > 0
        GROUP BY nurse_id)
     SELECT u.id AS nurse_id, u.full_name, u.phone, np.profile_status::text AS profile_status, np.suspended_reason,
            COALESCE(w.deposit_balance, 0) AS deposit_balance,
            COALESCE(c.unpaid, 0) AS unpaid, COALESCE(c.overdue, 0) AS overdue, COALESCE(c.bookings, 0) AS bookings
       FROM users u
       JOIN nurse_profiles np ON np.user_id = u.id
       LEFT JOIN wallets w ON w.user_id = u.id
       LEFT JOIN cash c ON c.nurse_id = u.id
      WHERE COALESCE(w.deposit_balance, 0) < 0 OR c.unpaid IS NOT NULL
      ORDER BY GREATEST(-COALESCE(w.deposit_balance, 0), 0) + COALESCE(c.overdue, 0) DESC, u.full_name
      LIMIT $2`,
    [nowAt, limit],
  );
  return rows;
}
