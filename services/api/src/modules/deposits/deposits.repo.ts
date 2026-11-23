/**
 * SQL of deposits (BE-3 · Phase 5 · ADR-0004). Money moves only through wallets-ledger's postNurseEntry.
 */
import type { DepositRefundPendingReason, PenaltyReason } from '@healthcare-system/shared';
import type { Queryable } from '../../core/database';
import type { BankAccountRow, PenaltyRow, RefundFacts, RefundRequestRow, TopupRow, TopupStatus } from './deposits.types';

// ---- bank account ----------------------------------------------------------

export async function findBankAccount(db: Queryable, userId: string): Promise<BankAccountRow | null> {
  const { rows } = await db.query<BankAccountRow>(
    `SELECT bank_name, account_no, account_holder FROM nurse_bank_accounts WHERE user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function upsertBankAccount(db: Queryable, userId: string, a: BankAccountRow): Promise<void> {
  await db.query(
    `INSERT INTO nurse_bank_accounts (user_id, bank_name, account_no, account_holder) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE
        SET bank_name = EXCLUDED.bank_name, account_no = EXCLUDED.account_no,
            account_holder = EXCLUDED.account_holder, updated_at = now()`,
    [userId, a.bank_name, a.account_no, a.account_holder],
  );
}

// ---- top-ups ---------------------------------------------------------------

/** A new link replaces the nurse's earlier unpaid ones (a late payment of an old code is still honoured). */
export async function expirePendingTopups(db: Queryable, nurseId: string): Promise<void> {
  await db.query(`UPDATE deposit_topups SET status = 'EXPIRED' WHERE nurse_id = $1 AND status = 'PENDING'`, [nurseId]);
}

export async function insertTopup(
  db: Queryable,
  t: { walletId: string; nurseId: string; amount: number; paymentCode: string; expiresAt: Date },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO deposit_topups (wallet_id, nurse_id, amount, payment_code, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [t.walletId, t.nurseId, t.amount, t.paymentCode, t.expiresAt],
  );
  return rows[0].id;
}

export async function findTopupForNurse(db: Queryable, nurseId: string, topupId: string): Promise<TopupRow | null> {
  const { rows } = await db.query<TopupRow>(
    `SELECT id, wallet_id, nurse_id, amount, payment_code, status, expires_at, provider_ref
       FROM deposit_topups WHERE id = $1 AND nurse_id = $2`,
    [topupId, nurseId],
  );
  return rows[0] ?? null;
}

export async function topupCodeExists(db: Queryable, paymentCode: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM deposit_topups WHERE payment_code = $1`, [paymentCode]);
  return rows.length > 0;
}

export async function lockTopupByCode(db: Queryable, paymentCode: string): Promise<TopupRow | null> {
  const { rows } = await db.query<TopupRow>(
    `SELECT id, wallet_id, nurse_id, amount, payment_code, status, expires_at, provider_ref
       FROM deposit_topups WHERE payment_code = $1 FOR UPDATE`,
    [paymentCode],
  );
  return rows[0] ?? null;
}

export async function finishTopup(
  db: Queryable,
  id: string,
  f: { status: TopupStatus; providerRef: string; credited: number; returned: number; transactionId: string | null; paidAt: Date },
): Promise<void> {
  await db.query(
    `UPDATE deposit_topups
        SET status = $2, provider_ref = $3, credited_amount = $4, returned_amount = $5, transaction_id = $6, paid_at = $7
      WHERE id = $1`,
    [id, f.status, f.providerRef, f.credited, f.returned, f.transactionId, f.paidAt],
  );
}

// ---- penalties -------------------------------------------------------------

const PENALTY_SELECT = `
  SELECT t.id AS transaction_id, t.amount, d.reason::text AS reason, d.sla_rule_ref, d.booking_id, b.booking_code,
         d.dispute_id, d.note, t.created_at, d.appeal_deadline, a.dispute_id AS appeal_dispute_id,
         EXISTS (SELECT 1 FROM deposit_penalty_details r WHERE r.reverses_transaction_id = t.id) AS reversed
    FROM wallet_transactions t
    JOIN wallets w ON w.id = t.wallet_id
    JOIN deposit_penalty_details d ON d.transaction_id = t.id
    LEFT JOIN bookings b ON b.id = d.booking_id
    LEFT JOIN deposit_penalty_appeals a ON a.transaction_id = t.id
   WHERE t.tx_type = 'PENALTY_DEDUCT' AND w.user_id = $1`;

export async function listPenalties(db: Queryable, nurseId: string): Promise<PenaltyRow[]> {
  const { rows } = await db.query<PenaltyRow>(`${PENALTY_SELECT} ORDER BY t.created_at DESC, t.id DESC`, [nurseId]);
  return rows;
}

export async function findPenalty(db: Queryable, nurseId: string, transactionId: string): Promise<PenaltyRow | null> {
  const { rows } = await db.query<PenaltyRow>(`${PENALTY_SELECT} AND t.id = $2`, [nurseId, transactionId]);
  return rows[0] ?? null;
}

/** The PENALTY_DEDUCT row and its details, whoever owns it (for a reversal decided by an Admin). */
export async function findPenaltyById(
  db: Queryable,
  transactionId: string,
): Promise<{ user_id: string; amount: string | number; reason: PenaltyReason; sla_rule_ref: string; booking_id: string | null; dispute_id: string | null } | null> {
  const { rows } = await db.query(
    `SELECT w.user_id, t.amount, d.reason::text AS reason, d.sla_rule_ref, d.booking_id, d.dispute_id
       FROM wallet_transactions t
       JOIN wallets w ON w.id = t.wallet_id
       JOIN deposit_penalty_details d ON d.transaction_id = t.id
      WHERE t.id = $1 AND t.tx_type = 'PENALTY_DEDUCT'`,
    [transactionId],
  );
  return (rows[0] as never) ?? null;
}

export async function insertPenaltyDetails(
  db: Queryable,
  d: {
    transactionId: string;
    reason: PenaltyReason | string;
    slaRuleRef: string;
    bookingId: string | null;
    disputeId: string | null;
    note: string | null;
    appealDeadline: Date | null;
    reversesTransactionId: string | null;
    decidedBy: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO deposit_penalty_details
       (transaction_id, reason, sla_rule_ref, booking_id, dispute_id, note, appeal_deadline, reverses_transaction_id, decided_by)
     VALUES ($1, $2::penalty_reason_enum, $3, $4, $5, $6, $7, $8, $9)`,
    [d.transactionId, d.reason, d.slaRuleRef, d.bookingId, d.disputeId, d.note, d.appealDeadline, d.reversesTransactionId, d.decidedBy],
  );
}

export async function insertAppeal(
  db: Queryable,
  a: { transactionId: string; nurseId: string; bookingId: string; reasonCode: string; description: string; evidence: string[] },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO disputes (booking_id, raised_by_id, reason_code, description, evidence_urls)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
    [a.bookingId, a.nurseId, a.reasonCode, a.description, JSON.stringify(a.evidence)],
  );
  const disputeId = rows[0].id;
  await db.query(
    `INSERT INTO deposit_penalty_appeals (transaction_id, dispute_id, nurse_id) VALUES ($1, $2, $3)`,
    [a.transactionId, disputeId, a.nurseId],
  );
  return disputeId;
}

// ---- refund requests ---------------------------------------------------------

const REFUND_COLUMNS = `id, wallet_id, status::text AS status, pending_reasons, eligible_at, refund_amount, bank_name,
  bank_account_no, account_holder, transaction_id, due_by, reject_reason, requested_at, updated_at`;

/** Latest request that was not cancelled (what the closure screen shows). */
export async function findLatestRefundRequest(db: Queryable, walletId: string): Promise<RefundRequestRow | null> {
  const { rows } = await db.query<RefundRequestRow>(
    `SELECT ${REFUND_COLUMNS} FROM deposit_refund_requests
      WHERE wallet_id = $1 AND status <> 'CANCELLED'
      ORDER BY requested_at DESC LIMIT 1`,
    [walletId],
  );
  return rows[0] ?? null;
}

export async function findOpenRefundRequest(db: Queryable, walletId: string): Promise<RefundRequestRow | null> {
  const { rows } = await db.query<RefundRequestRow>(
    `SELECT ${REFUND_COLUMNS} FROM deposit_refund_requests
      WHERE wallet_id = $1 AND status IN ('REQUESTED', 'WAITING_HOLD', 'READY')`,
    [walletId],
  );
  return rows[0] ?? null;
}

export async function lockRefundRequest(db: Queryable, id: string): Promise<(RefundRequestRow & { user_id: string }) | null> {
  const { rows } = await db.query<RefundRequestRow & { user_id: string }>(
    `SELECT r.id, r.wallet_id, r.status::text AS status, r.pending_reasons, r.eligible_at, r.refund_amount, r.bank_name,
            r.bank_account_no, r.account_holder, r.transaction_id, r.due_by, r.reject_reason, r.requested_at, r.updated_at,
            w.user_id
       FROM deposit_refund_requests r JOIN wallets w ON w.id = r.wallet_id
      WHERE r.id = $1 FOR UPDATE OF r`,
    [id],
  );
  return rows[0] ?? null;
}

export async function insertRefundRequest(db: Queryable, walletId: string, bank: BankAccountRow, at: Date): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO deposit_refund_requests (wallet_id, bank_name, bank_account_no, account_holder, requested_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
    [walletId, bank.bank_name, bank.account_no, bank.account_holder, at],
  );
  return rows[0].id;
}

export async function saveRefundEvaluation(
  db: Queryable,
  id: string,
  e: { status: 'WAITING_HOLD' | 'READY'; pending: DepositRefundPendingReason[]; eligibleAt: Date | null; refundAmount: number | null; dueBy: Date | null; at: Date },
): Promise<void> {
  await db.query(
    `UPDATE deposit_refund_requests
        SET status = $2::deposit_refund_status_enum, pending_reasons = $3::jsonb, eligible_at = $4,
            refund_amount = $5, due_by = $6, updated_at = $7
      WHERE id = $1`,
    [id, e.status, JSON.stringify(e.pending), e.eligibleAt, e.refundAmount, e.dueBy, e.at],
  );
}

export async function setRefundStatus(
  db: Queryable,
  id: string,
  s: { status: 'CANCELLED' | 'REFUNDED' | 'REJECTED'; at: Date; reviewedBy?: string | null; rejectReason?: string | null; transactionId?: string | null; refundAmount?: number | null },
): Promise<void> {
  await db.query(
    `UPDATE deposit_refund_requests
        SET status = $2::deposit_refund_status_enum, updated_at = $3,
            reviewed_by = COALESCE($4, reviewed_by), reject_reason = COALESCE($5, reject_reason),
            transaction_id = COALESCE($6, transaction_id), refund_amount = COALESCE($7, refund_amount)
      WHERE id = $1`,
    [id, s.status, s.at, s.reviewedBy ?? null, s.rejectReason ?? null, s.transactionId ?? null, s.refundAmount ?? null],
  );
}

export async function listOpenRefundRequestIds(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM deposit_refund_requests WHERE status IN ('REQUESTED', 'WAITING_HOLD') ORDER BY requested_at`,
  );
  return rows.map((r) => r.id);
}

export async function setClosureRequested(db: Queryable, walletId: string, at: Date | null): Promise<void> {
  await db.query(`UPDATE wallets SET closure_requested_at = $2, updated_at = now() WHERE id = $1`, [walletId, at]);
}

/** The four facts of ADR-0004 D3 for one nurse. */
export async function refundFacts(db: Queryable, nurseId: string): Promise<RefundFacts> {
  const { rows } = await db.query<{ active: number; last_checkout: Date | null; disputes: number; commissions: number }>(
    `SELECT
       (SELECT count(*)::int FROM bookings WHERE nurse_id = $1 AND execution_status IN ('CONFIRMED', 'IN_PROGRESS')) AS active,
       (SELECT max(l.checkout_time) FROM shift_logs l JOIN bookings b ON b.id = l.booking_id WHERE b.nurse_id = $1) AS last_checkout,
       (SELECT count(*)::int FROM disputes d JOIN bookings b ON b.id = d.booking_id
         WHERE (b.nurse_id = $1 OR d.raised_by_id = $1) AND d.status IN ('OPEN', 'UNDER_REVIEW')) AS disputes,
       (SELECT count(*)::int FROM bookings b
         WHERE b.nurse_id = $1 AND b.payment_method = 'CASH' AND b.execution_status = 'COMPLETED'
           AND b.commission_due_at IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM wallet_transactions t
                            WHERE t.booking_id = b.id AND t.tx_type = 'COMMISSION_PAYMENT' AND t.status = 'COMPLETED')) AS commissions`,
    [nurseId],
  );
  const r = rows[0];
  return { activeBookings: r.active, lastCheckoutAt: r.last_checkout, openDisputes: r.disputes, unpaidCommissions: r.commissions };
}

/** Public holidays (Vietnam dates) in [from, to] — for the working-day payout deadline. */
export async function holidaysBetween(db: Queryable, from: string, to: string): Promise<Set<string>> {
  const { rows } = await db.query<{ d: string }>(
    `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS d FROM public_holidays WHERE holiday_date BETWEEN $1::date AND $2::date`,
    [from, to],
  );
  return new Set(rows.map((r) => r.d));
}

// ---- reconciliation ----------------------------------------------------------

export async function depositTotals(db: Queryable): Promise<{ wallets_total: string; ledger_total: string }> {
  const { rows } = await db.query<{ wallets_total: string; ledger_total: string }>(
    `SELECT (SELECT COALESCE(sum(deposit_balance), 0) FROM wallets)::text AS wallets_total,
            (SELECT COALESCE(sum(balance_after - balance_before), 0) FROM wallet_transactions
              WHERE balance_type = 'DEPOSIT' AND status = 'COMPLETED')::text AS ledger_total`,
  );
  return rows[0];
}

/** Wallets whose deposit_balance differs from their own DEPOSIT ledger movements. */
export async function mismatchedDepositWallets(
  db: Queryable,
  limit: number,
): Promise<{ count: number; sample: { walletId: string; balance: number; ledger: number }[] }> {
  const { rows } = await db.query<{ wallet_id: string; balance: string; ledger: string; total: number }>(
    `WITH m AS (
       SELECT w.id AS wallet_id, w.deposit_balance AS balance,
              COALESCE(sum(t.balance_after - t.balance_before)
                         FILTER (WHERE t.balance_type = 'DEPOSIT' AND t.status = 'COMPLETED'), 0) AS ledger
         FROM wallets w LEFT JOIN wallet_transactions t ON t.wallet_id = w.id
        GROUP BY w.id
       HAVING w.deposit_balance <> COALESCE(sum(t.balance_after - t.balance_before)
                                              FILTER (WHERE t.balance_type = 'DEPOSIT' AND t.status = 'COMPLETED'), 0))
     SELECT wallet_id, balance::text, ledger::text, (SELECT count(*)::int FROM m) AS total FROM m ORDER BY wallet_id LIMIT $1`,
    [limit],
  );
  return {
    count: rows[0]?.total ?? 0,
    sample: rows.map((r) => ({ walletId: r.wallet_id, balance: Number(r.balance), ledger: Number(r.ledger) })),
  };
}

export async function upsertReconciliation(
  db: Queryable,
  r: { runDate: string; walletsTotal: number; ledgerTotal: number; custodyTotal: number; mismatched: number; status: 'OK' | 'MISMATCH'; details: unknown },
): Promise<void> {
  await db.query(
    `INSERT INTO deposit_reconciliations (run_date, wallets_total, ledger_total, custody_total, mismatched_wallets, status, details)
     VALUES ($1::date, $2, $3, $4, $5, $6, $7::jsonb)
     ON CONFLICT (run_date) DO UPDATE
        SET wallets_total = EXCLUDED.wallets_total, ledger_total = EXCLUDED.ledger_total,
            custody_total = EXCLUDED.custody_total, mismatched_wallets = EXCLUDED.mismatched_wallets,
            status = EXCLUDED.status, details = EXCLUDED.details, created_at = now(),
            resolved_by = NULL, resolved_at = NULL, resolution_note = NULL`,
    [r.runDate, r.walletsTotal, r.ledgerTotal, r.custodyTotal, r.mismatched, r.status, JSON.stringify(r.details)],
  );
}

export async function hasUnresolvedMismatch(db: Queryable): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM deposit_reconciliations WHERE status = 'MISMATCH' AND resolved_at IS NULL LIMIT 1`);
  return rows.length > 0;
}

export async function resolveReconciliation(db: Queryable, runDate: string, adminId: string, note: string, at: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE deposit_reconciliations SET resolved_by = $2, resolution_note = $3, resolved_at = $4
      WHERE run_date = $1::date AND status = 'MISMATCH' AND resolved_at IS NULL`,
    [runDate, adminId, note, at],
  );
  return (rowCount ?? 0) > 0;
}
