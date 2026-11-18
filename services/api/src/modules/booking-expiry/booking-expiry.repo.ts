/**
 * SQL for booking-expiry (ADR-0002). Writes expect a TRANSACTION client. BE-3 · Phase 3.
 */
import type { Queryable } from '../../core/database';
import type { ExpiryBookingRow, ExpiryReason } from './booking-expiry.types';

const SELECT = `
  SELECT id, booking_code, customer_id, nurse_id, matching_mode, payment_method, payment_status, execution_status,
         start_time, hold_expires_at, matching_started_at, total_amount
    FROM bookings`;

export async function lockBooking(db: Queryable, bookingId: string): Promise<ExpiryBookingRow | null> {
  const { rows } = await db.query<ExpiryBookingRow>(`${SELECT} WHERE id = $1 FOR UPDATE`, [bookingId]);
  return rows[0] ?? null;
}

/**
 * Coarse scan for the sweep (cheap, uses idx_bookings_expiry_candidates). Each id is re-checked
 * under its own lock by the exact policy before anything changes.
 */
export async function findExpiryCandidates(
  db: Queryable,
  p: { now: Date; unmatchedLeadMinutes: number; urgentUnmatchedMinutes: number; limit: number },
): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT id FROM bookings
      WHERE nurse_id IS NULL
        AND (
              (execution_status = 'DRAFT' AND payment_status = 'UNPAID' AND hold_expires_at <= $1)
           OR (execution_status = 'MATCHING' AND (
                   start_time - make_interval(mins => $2::int) <= $1
                OR (matching_mode = 'RADAR_DISPATCH' AND matching_started_at + make_interval(mins => $3::int) <= $1)))
            )
      ORDER BY start_time, id
      LIMIT $4`,
    [p.now, p.unmatchedLeadMinutes, p.urgentUnmatchedMinutes, p.limit],
  );
  return rows.map((r) => r.id);
}

/** DRAFT / MATCHING → EXPIRED, with the reason. Every still-open offer of the booking is closed as EXPIRED. */
export async function markExpired(db: Queryable, bookingId: string, reason: ExpiryReason, now: Date): Promise<void> {
  await db.query(
    `UPDATE bookings SET execution_status = 'EXPIRED', cancellation_reason = $2, updated_at = now()
      WHERE id = $1 AND execution_status IN ('DRAFT', 'MATCHING') AND nurse_id IS NULL`,
    [bookingId, reason],
  );
  await db.query(
    `UPDATE booking_offers SET status = 'EXPIRED', responded_at = $2 WHERE booking_id = $1 AND status = 'SENT'`,
    [bookingId, now],
  );
}

export async function setRefunded(db: Queryable, bookingId: string): Promise<void> {
  await db.query(`UPDATE bookings SET payment_status = 'REFUNDED', updated_at = now() WHERE id = $1`, [bookingId]);
}
