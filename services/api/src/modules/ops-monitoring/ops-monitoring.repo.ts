/**
 * ops-monitoring — read-only SQL (BE-3 · Phase 8). Each query answers one check; none locks anything.
 */
import type { Queryable } from '../../core/database';
import { SOS_NOTIFICATION_TYPES, WEBHOOK_PROBLEM_OUTCOMES } from './ops-monitoring.types';

const n = (v: unknown): number => Number(v ?? 0);

export async function webhookProblems(db: Queryable, since: Date) {
  const { rows } = await db.query<{ outcome: string; count: number }>(
    `SELECT outcome, count(*)::int AS count FROM payment_webhook_events
      WHERE received_at >= $1 AND outcome = ANY($2::text[])
      GROUP BY outcome ORDER BY outcome`,
    [since, [...WEBHOOK_PROBLEM_OUTCOMES]],
  );
  return rows;
}

/** SOS alerts (HIGH) nobody acknowledged: the push row is the one the phone acks (core/notifications). */
export async function sosUnacknowledged(db: Queryable, since: Date, olderThan: Date) {
  const { rows } = await db.query<{ count: number; oldest: Date | null }>(
    `SELECT count(*)::int AS count, min(created_at) AS oldest FROM notifications
      WHERE type = ANY($1::text[]) AND priority = 'HIGH' AND channel = 'PUSH_FCM'
        AND acked_at IS NULL AND created_at >= $2 AND created_at < $3`,
    [[...SOS_NOTIFICATION_TYPES], since, olderThan],
  );
  return { count: rows[0].count, oldest: rows[0].oldest };
}

export async function failedUrgentDeliveries(db: Queryable, since: Date) {
  const { rows } = await db.query<{ sms: number; push: number }>(
    `SELECT count(*) FILTER (WHERE channel = 'SMS_FALLBACK')::int AS sms,
            count(*) FILTER (WHERE channel = 'PUSH_FCM')::int AS push
       FROM notifications
      WHERE priority = 'HIGH' AND delivery_status = 'FAILED' AND created_at >= $1`,
    [since],
  );
  return rows[0];
}

/** Overdue cash commissions, and those whose nurse is still ACTIVE well after the deadline (sweep not running). */
export async function cashCommissionOverdue(db: Queryable, now: Date, sweepDeadline: Date) {
  const { rows } = await db.query<{ overdue: number; amount: string; not_suspended: number }>(
    `SELECT count(*)::int AS overdue, COALESCE(sum(b.platform_fee), 0)::text AS amount,
            count(*) FILTER (WHERE np.profile_status = 'ACTIVE' AND b.commission_due_at < $2)::int AS not_suspended
       FROM bookings b JOIN nurse_profiles np ON np.user_id = b.nurse_id
      WHERE b.payment_method = 'CASH' AND b.commission_due_at IS NOT NULL AND b.settled_at IS NULL
        AND b.platform_fee > 0 AND b.commission_due_at < $1`,
    [now, sweepDeadline],
  );
  return { overdue: rows[0].overdue, amount: n(rows[0].amount), notSuspended: rows[0].not_suspended };
}

/** Transfer shifts the settlement sweep should have paid by now (cooling window + lag), not frozen, not on hold. */
export async function settlementLag(db: Queryable, checkoutBefore: Date) {
  const { rows } = await db.query<{ count: number; amount: string; oldest: Date | null }>(
    `SELECT count(*)::int AS count, COALESCE(sum(b.total_amount), 0)::text AS amount, min(s.checkout_time) AS oldest
       FROM bookings b JOIN shift_logs s ON s.booking_id = b.id
      WHERE b.payment_method = 'BANK_TRANSFER' AND b.payment_status = 'ESCROW_HELD' AND b.execution_status = 'COMPLETED'
        AND b.settled_at IS NULL AND b.dispute_status IN ('NONE', 'RESOLVED_NURSE')
        AND s.checkout_time IS NOT NULL AND s.checkout_time < $1
        AND NOT EXISTS (SELECT 1 FROM settlement_holds h WHERE h.booking_id = b.id AND h.resolved_at IS NULL)`,
    [checkoutBefore],
  );
  return { count: rows[0].count, amount: n(rows[0].amount), oldest: rows[0].oldest };
}

export async function financeHolds(db: Queryable) {
  const { rows } = await db.query<{ holds: number; mismatches: number }>(
    `SELECT (SELECT count(*) FROM settlement_holds WHERE resolved_at IS NULL)::int AS holds,
            (SELECT count(*) FROM deposit_reconciliations WHERE status = 'MISMATCH' AND resolved_at IS NULL)::int AS mismatches`,
  );
  return rows[0];
}

/** Σ wallets vs Σ ledger per balance (same rule as admin-finance checks[]). */
export async function ledgerDrift(db: Queryable) {
  const { rows } = await db.query<Record<string, string>>(
    `SELECT
       (SELECT COALESCE(sum(escrow_locked_balance), 0) FROM wallets)::text AS escrow_w,
       (SELECT COALESCE(sum(available_balance), 0) FROM wallets)::text     AS available_w,
       (SELECT COALESCE(sum(deposit_balance), 0) FROM wallets)::text       AS deposit_w,
       COALESCE(sum(balance_after - balance_before) FILTER (WHERE balance_type = 'ESCROW_LOCKED'), 0)::text AS escrow_l,
       COALESCE(sum(balance_after - balance_before) FILTER (WHERE balance_type = 'AVAILABLE'), 0)::text     AS available_l,
       COALESCE(sum(balance_after - balance_before) FILTER (WHERE balance_type = 'DEPOSIT'), 0)::text       AS deposit_l
     FROM wallet_transactions WHERE status = 'COMPLETED'`,
  );
  const r = rows[0];
  return {
    escrow: n(r.escrow_w) - n(r.escrow_l),
    available: n(r.available_w) - n(r.available_l),
    deposit: n(r.deposit_w) - n(r.deposit_l),
  };
}

export async function activeAdminIds(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' ORDER BY created_at`);
  return rows.map((r) => r.id);
}
