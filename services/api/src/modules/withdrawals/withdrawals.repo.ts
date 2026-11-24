/**
 * SQL of withdrawals (BE-3 · Phase 5 · FR-PAY-04). Money moves through wallets-ledger's postNurseEntry only.
 */
import type { Queryable } from '../../core/database';
import type { WithdrawalRow } from './withdrawals.types';

const COLUMNS = `r.id, r.wallet_id, w.user_id, r.amount, r.status::text AS status, r.bank_name, r.bank_account_no,
  r.account_holder, r.reject_reason, r.payout_ref, r.created_at, r.reviewed_at`;

export async function findByIdempotencyKey(db: Queryable, key: string): Promise<WithdrawalRow | null> {
  const { rows } = await db.query<WithdrawalRow>(
    `SELECT ${COLUMNS} FROM withdrawal_requests r JOIN wallets w ON w.id = r.wallet_id WHERE r.idempotency_key = $1`,
    [key],
  );
  return rows[0] ?? null;
}

export async function insertWithdrawal(
  db: Queryable,
  w: { walletId: string; transactionId: string; amount: number; bankName: string; accountNo: string; holder: string; idempotencyKey: string; at: Date },
): Promise<WithdrawalRow> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO withdrawal_requests (wallet_id, transaction_id, amount, bank_name, bank_account_no, account_holder, idempotency_key, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [w.walletId, w.transactionId, w.amount, w.bankName, w.accountNo, w.holder, w.idempotencyKey, w.at],
  );
  return (await lockWithdrawal(db, rows[0].id))!;
}

export async function lockWithdrawal(db: Queryable, id: string): Promise<WithdrawalRow | null> {
  const { rows } = await db.query<WithdrawalRow>(
    `SELECT ${COLUMNS} FROM withdrawal_requests r JOIN wallets w ON w.id = r.wallet_id WHERE r.id = $1 FOR UPDATE OF r`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listForNurse(db: Queryable, nurseId: string, limit: number): Promise<WithdrawalRow[]> {
  const { rows } = await db.query<WithdrawalRow>(
    `SELECT ${COLUMNS} FROM withdrawal_requests r JOIN wallets w ON w.id = r.wallet_id
      WHERE w.user_id = $1 ORDER BY r.created_at DESC, r.id DESC LIMIT $2`,
    [nurseId, limit],
  );
  return rows;
}

export async function markWithdrawn(db: Queryable, id: string, adminId: string, payoutRef: string | null, at: Date): Promise<void> {
  await db.query(
    `UPDATE withdrawal_requests SET status = 'WITHDRAWN', reviewed_by = $2, reviewed_at = $4, payout_ref = $3 WHERE id = $1`,
    [id, adminId, payoutRef, at],
  );
}

export async function markRejected(db: Queryable, id: string, adminId: string, reason: string, reversalTxId: string, at: Date): Promise<void> {
  await db.query(
    `UPDATE withdrawal_requests
        SET status = 'REJECTED', reviewed_by = $2, reviewed_at = $5, reject_reason = $3, reversal_transaction_id = $4
      WHERE id = $1`,
    [id, adminId, reason, reversalTxId, at],
  );
}
