/**
 * SQL for job-board (ADR-0002). Writes expect a TRANSACTION client. BE-3 · Phase 3.
 * The claim itself is matching-radar's claimBooking (one claim transaction for every path).
 * Availability is read only through availability-engine.
 */
import type { Queryable } from '../../core/database';
import type { NurseGateRow } from '../matching-radar/matching-radar.types';
import type { BoardBookingRow, DirectOfferRow } from './job-board.types';

/** Same columns as matching-radar's booking select, plus the customer's name and when matching started. */
const BOOKING_SELECT = `
  SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.matching_mode, b.payment_method, b.payment_status,
         b.execution_status, b.start_time, b.end_time, b.base_amount, b.surcharge_amount, b.urgent_bonus_amount,
         b.platform_fee, b.total_amount, b.prescription_image_url, b.matching_started_at,
         to_char(b.prescription_issued_date, 'YYYY-MM-DD') AS prescription_issued_date,
         s.name AS service_name, s.service_type, s.is_invasive, s.required_tier,
         p.lat AS care_lat, p.lng AS care_lng, p.full_name AS patient_name,
         to_char(p.dob, 'YYYY-MM-DD') AS patient_dob, p.gender AS patient_gender,
         p.weight_kg AS patient_weight_kg, p.mobility_status AS patient_mobility,
         c.full_name AS customer_name
    FROM bookings b
    JOIN service_categories s ON s.id = b.service_id
    JOIN patient_profiles p ON p.id = b.patient_profile_id
    JOIN users c ON c.id = b.customer_id`;

/** Open on the board: MATCHING, no nurse, JOB_BOARD route, paid or cash, not started, no exclusive direct request. */
const ON_BOARD = `
  b.execution_status = 'MATCHING' AND b.nurse_id IS NULL AND b.matching_mode = 'JOB_BOARD'
  AND (b.payment_method = 'CASH' OR b.payment_status = 'ESCROW_HELD')
  AND b.start_time > $1
  AND NOT EXISTS (SELECT 1 FROM booking_offers o
                   WHERE o.booking_id = b.id AND o.offer_type = 'DIRECT_REQUEST' AND o.status = 'SENT')`;

export async function listBoardBookings(db: Queryable, now: Date, excludeCustomerId: string, limit: number): Promise<BoardBookingRow[]> {
  const { rows } = await db.query<BoardBookingRow>(
    `${BOOKING_SELECT} WHERE ${ON_BOARD} AND b.customer_id <> $2 ORDER BY b.start_time, b.id LIMIT $3`,
    [now, excludeCustomerId, limit],
  );
  return rows;
}

export async function findBoardBooking(db: Queryable, now: Date, bookingId: string): Promise<BoardBookingRow | null> {
  const { rows } = await db.query<BoardBookingRow>(`${BOOKING_SELECT} WHERE ${ON_BOARD} AND b.id = $2`, [now, bookingId]);
  return rows[0] ?? null;
}

export async function getBooking(db: Queryable, bookingId: string): Promise<BoardBookingRow | null> {
  const { rows } = await db.query<BoardBookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [bookingId]);
  return rows[0] ?? null;
}

/** Same gate columns as matching-radar (incl. held transfer shifts), read without a lock. */
export async function getNurseGate(db: Queryable, nurseId: string): Promise<NurseGateRow | null> {
  const { rows } = await db.query<NurseGateRow>(
    `SELECT np.user_id, u.status AS user_status, np.profile_status, np.tier, np.gphn_number,
            to_char(np.gphn_expiry_date, 'YYYY-MM-DD') AS gphn_expiry_date,
            np.current_lat, np.current_lng, COALESCE(w.deposit_balance, 0) AS deposit_balance,
            w.deposit_grace_expires_at, COALESCE(w.deposit_grace_shifts_used, 0) AS deposit_grace_shifts_used,
            w.closure_requested_at,
            (SELECT count(*) FROM bookings x
              WHERE x.nurse_id = np.user_id AND x.payment_method = 'BANK_TRANSFER'
                AND x.execution_status IN ('CONFIRMED', 'IN_PROGRESS')) AS held_transfer_shifts
       FROM nurse_profiles np
       JOIN users u ON u.id = np.user_id
       LEFT JOIN wallets w ON w.user_id = np.user_id
      WHERE np.user_id = $1`,
    [nurseId],
  );
  return rows[0] ?? null;
}

/** The nurse's open direct request still inside its window, newest first. */
export async function findOpenDirectOffer(db: Queryable, nurseId: string, now: Date, bookingId?: string): Promise<DirectOfferRow | null> {
  const { rows } = await db.query<DirectOfferRow>(
    `SELECT o.id AS offer_id, o.booking_id, o.nurse_id, o.expires_at
       FROM booking_offers o
       JOIN bookings b ON b.id = o.booking_id
      WHERE o.nurse_id = $1 AND o.offer_type = 'DIRECT_REQUEST' AND o.status = 'SENT'
        AND o.expires_at > $2
        AND b.execution_status = 'MATCHING' AND b.nurse_id IS NULL
        AND (b.payment_method = 'CASH' OR b.payment_status = 'ESCROW_HELD')
        AND ($3::uuid IS NULL OR o.booking_id = $3::uuid)
      ORDER BY o.sent_at DESC
      LIMIT 1`,
    [nurseId, now, bookingId ?? null],
  );
  return rows[0] ?? null;
}

/** The nurse's direct request still SENT (window open or not) — what a decline acts on. */
export async function findSentDirectOffer(db: Queryable, nurseId: string, bookingId: string): Promise<DirectOfferRow | null> {
  const { rows } = await db.query<DirectOfferRow>(
    `SELECT id AS offer_id, booking_id, nurse_id, expires_at FROM booking_offers
      WHERE nurse_id = $1 AND booking_id = $2 AND offer_type = 'DIRECT_REQUEST' AND status = 'SENT'
      ORDER BY sent_at DESC LIMIT 1`,
    [nurseId, bookingId],
  );
  return rows[0] ?? null;
}

export async function hasOpenDirectRequest(db: Queryable, bookingId: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM booking_offers WHERE booking_id = $1 AND offer_type = 'DIRECT_REQUEST' AND status = 'SENT' LIMIT 1`,
    [bookingId],
  );
  return rows.length > 0;
}

/** Direct requests whose window has ended (still SENT). The sweep closes them. */
export async function findEndedDirectOffers(db: Queryable, now: Date, limit: number): Promise<DirectOfferRow[]> {
  const { rows } = await db.query<DirectOfferRow>(
    `SELECT id AS offer_id, booking_id, nurse_id, expires_at FROM booking_offers
      WHERE offer_type = 'DIRECT_REQUEST' AND status = 'SENT' AND expires_at <= $1
      ORDER BY expires_at, id LIMIT $2`,
    [now, limit],
  );
  return rows;
}

export type RoutingRow = { id: string; execution_status: string; nurse_id: string | null; matching_mode: string; start_time: Date };

/** Locks the booking row (same lock as claims, waves and expiry). */
export async function lockBookingForRouting(db: Queryable, bookingId: string): Promise<RoutingRow | null> {
  const { rows } = await db.query<RoutingRow>(
    `SELECT id, execution_status, nurse_id, matching_mode, start_time FROM bookings WHERE id = $1 FOR UPDATE`,
    [bookingId],
  );
  return rows[0] ?? null;
}

/** Closes one direct offer if it is still SENT; returns whether it did. */
export async function closeDirectOffer(db: Queryable, offerId: string, status: 'DECLINED' | 'EXPIRED', now: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE booking_offers SET status = $2::offer_status_enum, responded_at = $3 WHERE id = $1 AND status = 'SENT'`,
    [offerId, status, now],
  );
  return (rowCount ?? 0) > 0;
}

export async function setMatchingMode(db: Queryable, bookingId: string, mode: string): Promise<void> {
  await db.query(`UPDATE bookings SET matching_mode = $2::matching_mode_enum, updated_at = now() WHERE id = $1`, [bookingId, mode]);
}
