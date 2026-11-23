/** SQL for cancellation-policy (ADR-0002). Writes expect a TRANSACTION client. BE-1 · Phase 5 · SRS §5.2. */
import type { Queryable } from '../../core/database';
import type { CancelBookingRow, SlaOutcome } from './cancellation-policy.types';

const SELECT = `
  SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.execution_status, b.payment_method, b.payment_status,
         b.start_time, b.end_time, b.total_amount, s.name AS service_name
    FROM bookings b JOIN service_categories s ON s.id = b.service_id`;

export async function findBooking(db: Queryable, bookingId: string): Promise<CancelBookingRow | null> {
  const { rows } = await db.query<CancelBookingRow>(`${SELECT} WHERE b.id = $1`, [bookingId]);
  return rows[0] ?? null;
}

export async function lockBooking(db: Queryable, bookingId: string): Promise<CancelBookingRow | null> {
  const { rows } = await db.query<CancelBookingRow>(`${SELECT} WHERE b.id = $1 FOR UPDATE OF b`, [bookingId]);
  return rows[0] ?? null;
}

/** → CANCELLED by the customer. Open offers are closed so nobody can still accept it. */
export async function markCancelled(db: Queryable, bookingId: string, by: string, reason: string, now: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE bookings
        SET execution_status = 'CANCELLED', cancelled_by = $2, cancelled_at = $3, cancellation_reason = $4, updated_at = now()
      WHERE id = $1 AND execution_status IN ('DRAFT', 'MATCHING', 'CONFIRMED')`,
    [bookingId, by, now, reason],
  );
  await db.query(
    `UPDATE booking_offers SET status = 'EXPIRED', responded_at = $2 WHERE booking_id = $1 AND status = 'SENT'`,
    [bookingId, now],
  );
  return (rowCount ?? 0) > 0;
}

export async function setPaymentStatus(db: Queryable, bookingId: string, status: string): Promise<void> {
  await db.query(`UPDATE bookings SET payment_status = $2::payment_status_enum, updated_at = now() WHERE id = $1`, [bookingId, status]);
}

export async function insertOutcome(db: Queryable, bookingId: string, by: string | null, o: SlaOutcome): Promise<void> {
  await db.query(
    `INSERT INTO cancellation_outcomes
       (booking_id, scenario, actor, cancelled_by, hours_before_start, payment_method, amount_paid, fee_amount, fee_collected,
        refund_amount, nurse_compensation, platform_share, nurse_fine, urgent_bonus, voucher_amount, travel_support,
        trust_score_delta, settlement_status)
     VALUES ($1, $2, $3, $4, $5, $6::payment_method_enum, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      bookingId,
      o.scenario,
      o.actor,
      by,
      o.hoursBeforeStart,
      o.paymentMethod,
      o.amountPaid,
      o.feeAmount,
      o.feeCollected,
      o.refundAmount,
      o.nurseCompensation,
      o.platformShare,
      o.nurseFine,
      o.urgentBonus,
      o.voucherAmount,
      o.travelSupport,
      o.trustScoreDelta,
      o.nurseCompensation + o.platformShare > 0 ? 'PENDING' : 'NOT_APPLICABLE',
    ],
  );
}

export type RefundRow = {
  booking_id: string;
  booking_code: string;
  service_name: string;
  execution_status: string;
  cancellation_reason: string | null;
  scenario: string | null;
  held: string | number;
  refunded: string | number;
  nurse_compensation: string | number | null;
  platform_share: string | number | null;
  voucher_amount: string | number | null;
  outcome_at: Date | null;
  refunded_at: Date | null;
};

/** Every booking of the customer that was refunded, or has a §5.2 outcome with money held. Newest first. */
export async function listRefunds(db: Queryable, customerId: string, limit: number): Promise<RefundRow[]> {
  const { rows } = await db.query<RefundRow>(
    `SELECT b.id AS booking_id, b.booking_code, s.name AS service_name, b.execution_status::text AS execution_status,
            b.cancellation_reason, co.scenario,
            COALESCE(m.held, 0) AS held, COALESCE(m.refunded, 0) AS refunded,
            co.nurse_compensation, co.platform_share, co.voucher_amount,
            co.created_at AS outcome_at, m.refunded_at
       FROM bookings b
       JOIN service_categories s ON s.id = b.service_id
       LEFT JOIN cancellation_outcomes co ON co.booking_id = b.id
       LEFT JOIN LATERAL (
            SELECT sum(amount) FILTER (WHERE tx_type = 'ESCROW_HOLD') AS held,
                   sum(amount) FILTER (WHERE tx_type = 'REFUND') AS refunded,
                   max(created_at) FILTER (WHERE tx_type = 'REFUND') AS refunded_at
              FROM wallet_transactions WHERE booking_id = b.id) m ON TRUE
      WHERE b.customer_id = $1
        AND (COALESCE(m.refunded, 0) > 0 OR co.amount_paid > 0)
      ORDER BY COALESCE(m.refunded_at, co.created_at) DESC, b.id
      LIMIT $2`,
    [customerId, limit],
  );
  return rows;
}
