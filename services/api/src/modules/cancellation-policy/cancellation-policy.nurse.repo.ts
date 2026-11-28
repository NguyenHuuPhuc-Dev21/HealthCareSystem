/** SQL for the nurse side of cancellation-policy (SRS §5.2 rows 6–7). Writes expect a TRANSACTION client. */
import type { MatchingMode } from '@healthcare-system/shared';
import type { Queryable } from '../../core/database';
import type { NurseCancelBookingRow } from './cancellation-policy.nurse';

const SELECT = `
  SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.execution_status, b.payment_method, b.payment_status,
         b.start_time, b.end_time, b.total_amount, b.matching_mode, s.name AS service_name
    FROM bookings b JOIN service_categories s ON s.id = b.service_id`;

export async function findBookingForNurse(db: Queryable, bookingId: string): Promise<NurseCancelBookingRow | null> {
  const { rows } = await db.query<NurseCancelBookingRow>(`${SELECT} WHERE b.id = $1`, [bookingId]);
  return rows[0] ?? null;
}

/** Locks the booking row (same order as claims and customer cancel: booking first). */
export async function lockBookingForNurse(db: Queryable, bookingId: string): Promise<NurseCancelBookingRow | null> {
  const { rows } = await db.query<NurseCancelBookingRow>(`${SELECT} WHERE b.id = $1 FOR UPDATE OF b`, [bookingId]);
  return rows[0] ?? null;
}

/**
 * Takes the nurse off a CONFIRMED booking: back to MATCHING, prescription re-check needed by the next nurse,
 * `urgentBonus` added on top of any earlier bonus. Same shape as tier-lifecycle's release (BE-2).
 * Returns the booking's matching mode, or null when it was no longer CONFIRMED with this nurse.
 */
export async function releaseNurse(
  db: Queryable,
  bookingId: string,
  nurseId: string,
  urgentBonus: number,
): Promise<MatchingMode | null> {
  const { rows } = await db.query<{ matching_mode: MatchingMode }>(
    `UPDATE bookings
        SET nurse_id = NULL,
            execution_status = 'MATCHING',
            prescription_verified_by_nurse = FALSE,
            urgent_bonus_amount = urgent_bonus_amount + $3,
            updated_at = now()
      WHERE id = $1 AND nurse_id = $2 AND execution_status = 'CONFIRMED'
      RETURNING matching_mode`,
    [bookingId, nurseId, urgentBonus],
  );
  return rows[0]?.matching_mode ?? null;
}

export async function insertNurseCancellation(
  db: Queryable,
  r: {
    bookingId: string;
    nurseId: string;
    scenario: 'NURSE_CANCEL_EARLY' | 'NURSE_CANCEL_URGENT';
    reason: string;
    hoursBeforeStart: number;
    totalAmount: number;
    fine: number;
    trustScoreDelta: number;
    penaltyTransactionId: string | null;
  },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO nurse_cancellations
       (booking_id, nurse_id, scenario, reason, hours_before_start, total_amount, fine_amount, trust_score_delta, penalty_transaction_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [r.bookingId, r.nurseId, r.scenario, r.reason, r.hoursBeforeStart, r.totalAmount, r.fine, r.trustScoreDelta, r.penaltyTransactionId],
  );
  return rows[0]!.id;
}
