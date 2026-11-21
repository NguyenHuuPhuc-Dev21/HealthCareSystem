/**
 * SQL for matching-radar (ADR-0002). Writes expect a TRANSACTION client. BE-2 · Phase 3.
 */
import type { Queryable } from '../../core/database';
import type { MatchingBookingRow, NurseGateRow } from './matching-radar.types';

const BOOKING_SELECT = `
  SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.matching_mode, b.payment_method, b.payment_status,
         b.execution_status, b.start_time, b.end_time, b.base_amount, b.surcharge_amount, b.urgent_bonus_amount,
         b.platform_fee, b.total_amount, b.prescription_image_url,
         to_char(b.prescription_issued_date, 'YYYY-MM-DD') AS prescription_issued_date,
         s.name AS service_name, s.service_type, s.is_invasive, s.required_tier,
         p.lat AS care_lat, p.lng AS care_lng, p.full_name AS patient_name,
         to_char(p.dob, 'YYYY-MM-DD') AS patient_dob, p.gender AS patient_gender,
         p.weight_kg AS patient_weight_kg, p.mobility_status AS patient_mobility
    FROM bookings b
    JOIN service_categories s ON s.id = b.service_id
    JOIN patient_profiles p ON p.id = b.patient_profile_id`;

const NURSE_SELECT = `
  SELECT np.user_id, u.status AS user_status, np.profile_status, np.tier, np.gphn_number,
         to_char(np.gphn_expiry_date, 'YYYY-MM-DD') AS gphn_expiry_date,
         np.current_lat, np.current_lng, COALESCE(w.deposit_balance, 0) AS deposit_balance,
         w.deposit_grace_expires_at, COALESCE(w.deposit_grace_shifts_used, 0) AS deposit_grace_shifts_used,
         w.closure_requested_at,
         (SELECT count(*) FROM bookings x
           WHERE x.nurse_id = np.user_id AND x.payment_method = 'BANK_TRANSFER'
             AND x.execution_status IN ('CONFIRMED', 'IN_PROGRESS')) AS held_transfer_shifts
    FROM nurse_profiles np
    JOIN users u ON u.id = np.user_id
    LEFT JOIN wallets w ON w.user_id = np.user_id`;

export async function getBooking(db: Queryable, bookingId: string): Promise<MatchingBookingRow | null> {
  const { rows } = await db.query<MatchingBookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [bookingId]);
  return rows[0] ?? null;
}

/** Locks the booking row: claims, waves, activation and expiry of one booking run one at a time. */
export async function lockBooking(db: Queryable, bookingId: string): Promise<MatchingBookingRow | null> {
  const { rows } = await db.query<MatchingBookingRow>(`${BOOKING_SELECT} WHERE b.id = $1 FOR UPDATE OF b`, [bookingId]);
  return rows[0] ?? null;
}

/**
 * Locks the nurse's profile row (same row nurse-availabilities and tier-lifecycle lock), so a claim,
 * a schedule edit and a tier demotion for one nurse never interleave.
 */
export async function lockNurse(db: Queryable, nurseId: string): Promise<NurseGateRow | null> {
  const { rows } = await db.query<NurseGateRow>(`${NURSE_SELECT} WHERE np.user_id = $1 FOR UPDATE OF np`, [nurseId]);
  return rows[0] ?? null;
}

/**
 * ACTIVE nurses with a known position inside the bounding box, no closure request, and either the full deposit
 * or a grace period that is still running, who have not been offered this booking yet. The exact deposit / grace
 * rule, distance, tier and availability are checked by the caller (eligibilityBlocker, availability-engine).
 */
export async function findRadarCandidates(
  db: Queryable,
  p: {
    bookingId: string;
    customerId: string;
    box: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    minDeposit: number;
    excludeNurseIds: string[];
    limit: number;
  },
): Promise<NurseGateRow[]> {
  const { rows } = await db.query<NurseGateRow>(
    `${NURSE_SELECT}
      WHERE np.profile_status = 'ACTIVE'
        AND u.status = 'ACTIVE'
        AND np.current_lat BETWEEN $3 AND $4
        AND np.current_lng BETWEEN $5 AND $6
        AND w.closure_requested_at IS NULL
        AND (COALESCE(w.deposit_balance, 0) >= $7 OR w.deposit_grace_expires_at > now())
        AND np.user_id <> $2
        AND np.user_id <> ALL($8::uuid[])
        AND NOT EXISTS (SELECT 1 FROM booking_offers o WHERE o.booking_id = $1 AND o.nurse_id = np.user_id)
      ORDER BY np.user_id
      LIMIT $9`,
    [p.bookingId, p.customerId, p.box.minLat, p.box.maxLat, p.box.minLng, p.box.maxLng, p.minDeposit, p.excludeNurseIds, p.limit],
  );
  return rows;
}

export async function insertRadarOffers(
  db: Queryable,
  bookingId: string,
  nurseIds: string[],
  radiusKm: number,
  round: number,
  expiresAt: Date,
): Promise<void> {
  if (nurseIds.length === 0) return;
  await db.query(
    `INSERT INTO booking_offers (booking_id, nurse_id, offer_type, radius_km, round_no, status, expires_at)
     SELECT $1, n, 'RADAR', $3, $4, 'SENT', $5 FROM unnest($2::uuid[]) AS n`,
    [bookingId, nurseIds, radiusKm, round, expiresAt],
  );
}

export type OfferRow = { id: string; offer_type: string; status: string; round_no: number; radius_km: number | null; expires_at: Date | null };

/** The nurse's offer for this booking that is still open (SENT and not past its deadline). */
export async function findLiveOffer(db: Queryable, bookingId: string, nurseId: string, offerType: string, now: Date): Promise<OfferRow | null> {
  const { rows } = await db.query<OfferRow>(
    `SELECT id, offer_type, status, round_no, radius_km, expires_at
       FROM booking_offers
      WHERE booking_id = $1 AND nurse_id = $2 AND offer_type = $3::offer_type_enum
        AND status = 'SENT' AND (expires_at IS NULL OR expires_at > $4)
      ORDER BY sent_at DESC
      LIMIT 1`,
    [bookingId, nurseId, offerType, now],
  );
  return rows[0] ?? null;
}

/** The newest open Radar offer of a nurse on a booking that still needs a nurse. */
export async function findCurrentRadarOffer(
  db: Queryable,
  nurseId: string,
  now: Date,
): Promise<{ booking_id: string; round_no: number; expires_at: Date } | null> {
  const { rows } = await db.query<{ booking_id: string; round_no: number; expires_at: Date }>(
    `SELECT o.booking_id, o.round_no, o.expires_at
       FROM booking_offers o
       JOIN bookings b ON b.id = o.booking_id
      WHERE o.nurse_id = $1 AND o.offer_type = 'RADAR' AND o.status = 'SENT' AND o.expires_at > $2
        AND b.execution_status = 'MATCHING' AND b.nurse_id IS NULL
      ORDER BY o.sent_at DESC
      LIMIT 1`,
    [nurseId, now],
  );
  return rows[0] ?? null;
}

export async function setMatching(db: Queryable, bookingId: string, matchingMode: string): Promise<void> {
  await db.query(
    `UPDATE bookings SET execution_status = 'MATCHING', matching_mode = $2::matching_mode_enum, updated_at = now() WHERE id = $1`,
    [bookingId, matchingMode],
  );
}

export async function setMatchingMode(db: Queryable, bookingId: string, matchingMode: string): Promise<void> {
  await db.query(`UPDATE bookings SET matching_mode = $2::matching_mode_enum, updated_at = now() WHERE id = $1`, [bookingId, matchingMode]);
}

/** Assigns the nurse. The DB exclusion constraint ex_bookings_nurse_no_overlap is the last line of defence. */
export async function confirmBooking(db: Queryable, bookingId: string, nurseId: string): Promise<void> {
  await db.query(
    `UPDATE bookings SET nurse_id = $2, execution_status = 'CONFIRMED', updated_at = now()
      WHERE id = $1 AND execution_status = 'MATCHING' AND nurse_id IS NULL`,
    [bookingId, nurseId],
  );
}

/** Winner's offer → ACCEPTED (created when there was none, e.g. Job Board); every other open offer → LOST_RACE. */
export async function settleOffers(db: Queryable, bookingId: string, nurseId: string, offerType: string, now: Date): Promise<void> {
  const { rowCount } = await db.query(
    `UPDATE booking_offers SET status = 'ACCEPTED', responded_at = $4
      WHERE booking_id = $1 AND nurse_id = $2 AND offer_type = $3::offer_type_enum AND status = 'SENT'`,
    [bookingId, nurseId, offerType, now],
  );
  if ((rowCount ?? 0) === 0) {
    await db.query(
      `INSERT INTO booking_offers (booking_id, nurse_id, offer_type, status, sent_at, responded_at)
       VALUES ($1, $2, $3::offer_type_enum, 'ACCEPTED', $4, $4)`,
      [bookingId, nurseId, offerType, now],
    );
  }
  await db.query(
    `UPDATE booking_offers SET status = 'LOST_RACE', responded_at = $3
      WHERE booking_id = $1 AND nurse_id <> $2 AND status = 'SENT'`,
    [bookingId, nurseId, now],
  );
}

export async function declineOffer(db: Queryable, bookingId: string, nurseId: string, now: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE booking_offers SET status = 'DECLINED', responded_at = $3
      WHERE booking_id = $1 AND nurse_id = $2 AND offer_type = 'RADAR' AND status = 'SENT'`,
    [bookingId, nurseId, now],
  );
  return (rowCount ?? 0) > 0;
}

/** True while the customer's direct request to a chosen nurse is still open (BE-3 job-board owns its 15-minute window). */
export async function hasOpenDirectRequest(db: Queryable, bookingId: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM booking_offers WHERE booking_id = $1 AND offer_type = 'DIRECT_REQUEST' AND status = 'SENT' LIMIT 1`,
    [bookingId],
  );
  return rows.length > 0;
}
