/** SQL for prescription-gate (ADR-0002). BE-1 · Phase 3 · FR-BOOK-02. Read-only. */
import type { Queryable } from '../../core/database';
import type { BookingPrescriptionRow, CandidateFacts } from './prescription-gate.types';

export async function findBookingPrescription(db: Queryable, bookingId: string): Promise<BookingPrescriptionRow | null> {
  const { rows } = await db.query<BookingPrescriptionRow>(
    `SELECT customer_id, nurse_id, execution_status, prescription_image_url,
            to_char(prescription_issued_date, 'YYYY-MM-DD') AS prescription_issued_date
       FROM bookings
      WHERE id = $1`,
    [bookingId],
  );
  return rows[0] ?? null;
}

/**
 * Facts about a nurse who is not assigned to the booking:
 *  - a live offer: sent to her for this booking, not answered, not expired at `now`;
 *  - Tier 2 with a GPHN that is still valid on `today` (expiry strictly after today — same
 *    rule as credential-review / tier-lifecycle) and an ACTIVE profile.
 */
export async function findCandidateFacts(
  db: Queryable,
  bookingId: string,
  nurseId: string,
  now: Date,
  today: string,
): Promise<CandidateFacts> {
  const { rows } = await db.query<{ has_open_offer: boolean; tier2_valid: boolean }>(
    `SELECT EXISTS (SELECT 1
                      FROM booking_offers o
                     WHERE o.booking_id = $1
                       AND o.nurse_id = $2
                       AND o.status = 'SENT'
                       AND (o.expires_at IS NULL OR o.expires_at > $3::timestamptz)) AS has_open_offer,
            EXISTS (SELECT 1
                      FROM nurse_profiles np
                     WHERE np.user_id = $2
                       AND np.profile_status = 'ACTIVE'
                       AND np.tier = 'TIER_2_SPECIALIST'
                       AND np.gphn_number IS NOT NULL
                       AND np.gphn_expiry_date > $4::date) AS tier2_valid`,
    [bookingId, nurseId, now, today],
  );
  return { hasOpenOffer: rows[0]?.has_open_offer === true, tier2Valid: rows[0]?.tier2_valid === true };
}
