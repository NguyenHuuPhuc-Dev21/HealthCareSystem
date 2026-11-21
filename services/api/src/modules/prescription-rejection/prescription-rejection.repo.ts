/** SQL for prescription-rejection (ADR-0002). Writes expect a TRANSACTION client. BE-1 · Phase 4. */
import type { Queryable } from '../../core/database';
import type { RejectionBookingRow } from './prescription-rejection.types';

const SELECT = `
  SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.execution_status, b.payment_method, b.payment_status,
         b.start_time, b.end_time, b.total_amount, s.is_invasive
    FROM bookings b
    JOIN service_categories s ON s.id = b.service_id`;

export async function findBooking(db: Queryable, bookingId: string): Promise<RejectionBookingRow | null> {
  const { rows } = await db.query<RejectionBookingRow>(`${SELECT} WHERE b.id = $1`, [bookingId]);
  return rows[0] ?? null;
}

/** Locks the booking row, so a concurrent check-in, check-out or second rejection waits for us. */
export async function lockBooking(db: Queryable, bookingId: string): Promise<RejectionBookingRow | null> {
  const { rows } = await db.query<RejectionBookingRow>(`${SELECT} WHERE b.id = $1 FOR UPDATE OF b`, [bookingId]);
  return rows[0] ?? null;
}

/** CONFIRMED / IN_PROGRESS → CANCELLED by the nurse. The guard makes a racing second call a no-op. */
export async function cancelForInvalidPrescription(
  db: Queryable,
  bookingId: string,
  nurseId: string,
  now: Date,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE bookings
        SET execution_status = 'CANCELLED', cancelled_by = $2, cancelled_at = $3,
            cancellation_reason = 'INVALID_PRESCRIPTION', updated_at = now()
      WHERE id = $1 AND nurse_id = $2 AND execution_status IN ('CONFIRMED', 'IN_PROGRESS')`,
    [bookingId, nurseId, now],
  );
  return (rowCount ?? 0) > 0;
}

export async function setRefunded(db: Queryable, bookingId: string): Promise<void> {
  await db.query(`UPDATE bookings SET payment_status = 'REFUNDED', updated_at = now() WHERE id = $1`, [bookingId]);
}

export async function insertRejection(
  db: Queryable,
  r: { bookingId: string; nurseId: string; reason: string; evidenceKey: string; refundedAmount: number; travelSupportAmount: number },
): Promise<void> {
  await db.query(
    `INSERT INTO prescription_rejections
       (booking_id, nurse_id, reason, evidence_file_url, refunded_amount, travel_support_amount)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [r.bookingId, r.nurseId, r.reason, r.evidenceKey, r.refundedAmount, r.travelSupportAmount],
  );
}
