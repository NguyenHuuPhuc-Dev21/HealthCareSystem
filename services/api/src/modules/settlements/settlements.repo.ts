/**
 * SQL of settlements (BE-3 · Phase 5 · FR-PAY-02). Money moves through gateway-webhooks.ledger (customer escrow)
 * and wallets-ledger (nurse wallet) only.
 */
import type { Queryable } from '../../core/database';
import type { CancellationShareRow, SettleBookingRow, SettlementKind, SettlementSplit, SettlementTrigger } from './settlements.types';

export async function lockBooking(db: Queryable, bookingId: string): Promise<SettleBookingRow | null> {
  const { rows } = await db.query<SettleBookingRow>(
    `SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.payment_method::text AS payment_method,
            b.payment_status::text AS payment_status, b.execution_status::text AS execution_status,
            b.dispute_status::text AS dispute_status, b.total_amount, b.platform_fee, b.settled_at, l.checkout_time
       FROM bookings b
       LEFT JOIN shift_logs l ON l.booking_id = b.id
      WHERE b.id = $1
      FOR UPDATE OF b`,
    [bookingId],
  );
  return rows[0] ?? null;
}

export async function isOwnedBy(db: Queryable, bookingId: string, customerId: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM bookings WHERE id = $1 AND customer_id = $2`, [bookingId, customerId]);
  return rows.length > 0;
}

/** What the customer's escrow still holds for this booking (holds − refunds − releases). */
export async function escrowHeld(db: Queryable, bookingId: string, customerId: string): Promise<number> {
  const { rows } = await db.query<{ held: string }>(
    `SELECT COALESCE(sum(t.balance_after - t.balance_before), 0)::text AS held
       FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id
      WHERE t.booking_id = $1 AND w.user_id = $2 AND t.balance_type = 'ESCROW_LOCKED' AND t.status = 'COMPLETED'`,
    [bookingId, customerId],
  );
  return Number(rows[0].held);
}

export async function hasCancellationOutcome(db: Queryable, bookingId: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM cancellation_outcomes WHERE booking_id = $1`, [bookingId]);
  return rows.length > 0;
}

export async function lockCancellationShare(db: Queryable, bookingId: string): Promise<CancellationShareRow | null> {
  const { rows } = await db.query<CancellationShareRow>(
    `SELECT scenario, nurse_compensation, platform_share, settlement_status
       FROM cancellation_outcomes WHERE booking_id = $1 FOR UPDATE`,
    [bookingId],
  );
  return rows[0] ?? null;
}

export async function markCancellationDone(db: Queryable, bookingId: string): Promise<void> {
  await db.query(`UPDATE cancellation_outcomes SET settlement_status = 'DONE' WHERE booking_id = $1 AND settlement_status = 'PENDING'`, [bookingId]);
}

export async function insertSettlement(
  db: Queryable,
  s: { bookingId: string; nurseId: string; kind: SettlementKind; trigger: SettlementTrigger; split: SettlementSplit; at: Date },
): Promise<void> {
  await db.query(
    `INSERT INTO settlements
       (booking_id, nurse_id, kind, trigger, gross_amount, commission_amount, net_amount, deposit_withheld, payout_amount, grace_shift, settled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [s.bookingId, s.nurseId, s.kind, s.trigger, s.split.gross, s.split.commission, s.split.net, s.split.withheld, s.split.payout, s.split.graceShift, s.at],
  );
}

export async function markBookingSettled(db: Queryable, bookingId: string, at: Date): Promise<void> {
  await db.query(
    `UPDATE bookings SET payment_status = 'SETTLED', settled_at = $2, updated_at = now() WHERE id = $1`,
    [bookingId, at],
  );
}

/** ADR-0004 D2: one more grace shift used (same transaction as the payout). */
export async function countGraceShift(db: Queryable, walletId: string): Promise<void> {
  await db.query(
    `UPDATE wallets SET deposit_grace_shifts_used = deposit_grace_shifts_used + 1, updated_at = now() WHERE id = $1`,
    [walletId],
  );
}

/** Checked-out transfer shifts, no dispute, cooling window over, not a cancellation. Oldest check-out first. */
export async function listDueShiftIds(db: Queryable, checkoutBefore: Date, limit: number): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT b.id
       FROM bookings b JOIN shift_logs l ON l.booking_id = b.id
      WHERE b.payment_method = 'BANK_TRANSFER' AND b.payment_status = 'ESCROW_HELD' AND b.settled_at IS NULL
        AND b.nurse_id IS NOT NULL AND b.execution_status = 'COMPLETED' AND b.dispute_status = 'NONE'
        AND l.checkout_time IS NOT NULL AND l.checkout_time <= $1
        AND NOT EXISTS (SELECT 1 FROM cancellation_outcomes c WHERE c.booking_id = b.id)
        AND NOT EXISTS (SELECT 1 FROM settlement_holds h WHERE h.booking_id = b.id AND h.resolved_at IS NULL)
      ORDER BY l.checkout_time
      LIMIT $2`,
    [checkoutBefore, limit],
  );
  return rows.map((r) => r.id);
}

export async function listPendingCancellationIds(db: Queryable, limit: number): Promise<string[]> {
  const { rows } = await db.query<{ booking_id: string }>(
    `SELECT c.booking_id FROM cancellation_outcomes c
      WHERE c.settlement_status = 'PENDING'
        AND NOT EXISTS (SELECT 1 FROM settlement_holds h WHERE h.booking_id = c.booking_id AND h.resolved_at IS NULL)
      ORDER BY c.created_at LIMIT $1`,
    [limit],
  );
  return rows.map((r) => r.booking_id);
}

/** The escrow of this booking does not match: the sweep skips it until an Admin resolves the hold. */
export async function holdBooking(db: Queryable, bookingId: string, reason: string): Promise<void> {
  await db.query(
    `INSERT INTO settlement_holds (booking_id, reason) VALUES ($1, $2)
     ON CONFLICT (booking_id) DO UPDATE SET reason = EXCLUDED.reason, detected_at = now(),
            resolved_by = NULL, resolved_at = NULL, resolution_note = NULL
      WHERE settlement_holds.resolved_at IS NOT NULL`,
    [bookingId, reason],
  );
}

export async function resolveHold(db: Queryable, bookingId: string, adminId: string, note: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE settlement_holds SET resolved_by = $2, resolved_at = now(), resolution_note = $3
      WHERE booking_id = $1 AND resolved_at IS NULL`,
    [bookingId, adminId, note],
  );
  return (rowCount ?? 0) > 0;
}
