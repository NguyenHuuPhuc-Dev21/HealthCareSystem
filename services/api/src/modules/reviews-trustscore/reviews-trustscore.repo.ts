/**
 * SQL for reviews-trustscore (ADR-0002). BE-1 · FR-RATE-01, FR-SEARCH-01.
 * No business rules here: the service decides, this file reads and writes.
 */
import type { Queryable } from '../../core/database';
import type {
  NurseScoreRow,
  RevealedReviewRow,
  ReviewBookingRow,
  ReviewerRole,
  TrustScoreReason,
} from './reviews-trustscore.types';

/** When the shift really ended: check-out time, else the scheduled end. */
const COMPLETED_AT = 'COALESCE(sl.checkout_time, b.end_time)';

/**
 * Recomputes `nurse_profiles.rating_avg` for one nurse from scratch and stores it.
 *
 * Counts only customer reviews about this nurse that are visible and belong to a COMPLETED
 * booking; rounds to 2 decimals; stores 0 when none qualifies.
 *
 * Pass the TRANSACTION client that changed the reviews (e.g. the one that set `is_visible`),
 * so the reviews and the cached average commit or roll back together.
 *
 * @returns the stored average, or `null` when `nurseId` has no nurse profile.
 */
export async function recalculateNurseRatingAvg(db: Queryable, nurseId: string): Promise<number | null> {
  const { rows } = await db.query<{ rating_avg: string }>(
    `UPDATE nurse_profiles np
        SET rating_avg = COALESCE(
              (SELECT ROUND(AVG(r.rating), 2)
                 FROM reviews r
                 JOIN bookings b ON b.id = r.booking_id
                WHERE r.reviewee_id = np.user_id
                  AND r.reviewer_role = 'PATIENT'
                  AND r.is_visible
                  AND b.execution_status = 'COMPLETED'),
              0),
            updated_at = now()
      WHERE np.user_id = $1
      RETURNING np.rating_avg`,
    [nurseId],
  );
  // NUMERIC comes back from pg as a string.
  return rows[0] ? Number(rows[0].rating_avg) : null;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/** The booking with its booking row LOCKED (submit and reveal serialize on it). */
export async function lockReviewBooking(db: Queryable, bookingId: string): Promise<ReviewBookingRow | null> {
  const { rows } = await db.query<ReviewBookingRow>(
    `SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.execution_status,
            ${COMPLETED_AT} AS completed_at
       FROM bookings b
       LEFT JOIN shift_logs sl ON sl.booking_id = b.id
      WHERE b.id = $1
        FOR UPDATE OF b`,
    [bookingId],
  );
  return rows[0] ?? null;
}

/** Inserts a hidden review. Throws pg 23505 when this reviewer already reviewed the booking. */
export async function insertReview(
  db: Queryable,
  r: { bookingId: string; reviewerId: string; revieweeId: string; role: ReviewerRole; rating: number; comment: string | null; tags: string[] },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, reviewer_role, rating, comment, tags, is_visible)
     VALUES ($1, $2, $3, $4::reviewer_role_enum, $5, $6, $7::text[], FALSE)
     RETURNING id`,
    [r.bookingId, r.reviewerId, r.revieweeId, r.role, r.rating, r.comment, r.tags],
  );
  return rows[0]!.id;
}

export async function countReviewers(db: Queryable, bookingId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    'SELECT COUNT(DISTINCT reviewer_role)::int AS n FROM reviews WHERE booking_id = $1',
    [bookingId],
  );
  return rows[0]?.n ?? 0;
}

/** Makes every hidden review of the booking visible; returns the ones that changed. */
export async function revealReviews(db: Queryable, bookingId: string): Promise<RevealedReviewRow[]> {
  const { rows } = await db.query<RevealedReviewRow>(
    `UPDATE reviews SET is_visible = TRUE
      WHERE booking_id = $1 AND NOT is_visible
      RETURNING reviewer_role, reviewee_id, rating`,
    [bookingId],
  );
  return rows;
}

/** Bookings that still have a hidden review and whose shift ended at or before `cutoff`. */
export async function findBlindExpired(db: Queryable, cutoff: Date, limit: number): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT DISTINCT b.id
       FROM reviews r
       JOIN bookings b ON b.id = r.booking_id
       LEFT JOIN shift_logs sl ON sl.booking_id = b.id
      WHERE NOT r.is_visible
        AND ${COMPLETED_AT} <= $1::timestamptz
      LIMIT $2`,
    [cutoff, limit],
  );
  return rows.map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Nurse views
// ---------------------------------------------------------------------------

/** COMPLETED shifts of the nurse that ended after `since` and that she has not reviewed yet. */
export async function listPendingForNurse(db: Queryable, nurseId: string, since: Date) {
  const { rows } = await db.query<{ booking_id: string; booking_code: string; customer_name: string; completed_at: Date }>(
    `SELECT b.id AS booking_id, b.booking_code, u.full_name AS customer_name, ${COMPLETED_AT} AS completed_at
       FROM bookings b
       JOIN users u ON u.id = b.customer_id
       LEFT JOIN shift_logs sl ON sl.booking_id = b.id
      WHERE b.nurse_id = $1
        AND b.execution_status = 'COMPLETED'
        AND ${COMPLETED_AT} > $2::timestamptz
        AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id AND r.reviewer_id = $1)
      ORDER BY completed_at DESC`,
    [nurseId, since],
  );
  return rows;
}

export async function listSentByReviewer(db: Queryable, reviewerId: string, limit: number) {
  const { rows } = await db.query<{
    id: string; booking_code: string; customer_name: string; rating: number; comment: string | null;
    tags: string[] | null; is_visible: boolean; created_at: Date;
  }>(
    `SELECT r.id, b.booking_code, u.full_name AS customer_name, r.rating, r.comment, r.tags, r.is_visible, r.created_at
       FROM reviews r
       JOIN bookings b ON b.id = r.booking_id
       JOIN users u ON u.id = b.customer_id
      WHERE r.reviewer_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2`,
    [reviewerId, limit],
  );
  return rows;
}

/** Visible reviews ABOUT the user (blind ones are never returned). */
export async function listReceivedVisible(db: Queryable, revieweeId: string, limit: number) {
  const { rows } = await db.query<{
    id: string; booking_code: string; customer_name: string; rating: number; comment: string | null; created_at: Date;
  }>(
    `SELECT r.id, b.booking_code, u.full_name AS customer_name, r.rating, r.comment, r.created_at
       FROM reviews r
       JOIN bookings b ON b.id = r.booking_id
       JOIN users u ON u.id = r.reviewer_id
      WHERE r.reviewee_id = $1 AND r.is_visible
      ORDER BY r.created_at DESC
      LIMIT $2`,
    [revieweeId, limit],
  );
  return rows;
}

/** Count of visible customer reviews per star, on COMPLETED bookings (same set as rating_avg). */
export async function ratingDistribution(db: Queryable, nurseId: string): Promise<Record<number, number>> {
  const { rows } = await db.query<{ rating: number; n: number }>(
    `SELECT r.rating, COUNT(*)::int AS n
       FROM reviews r
       JOIN bookings b ON b.id = r.booking_id
      WHERE r.reviewee_id = $1 AND r.reviewer_role = 'PATIENT' AND r.is_visible AND b.execution_status = 'COMPLETED'
      GROUP BY r.rating`,
    [nurseId],
  );
  const out: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) out[r.rating] = r.n;
  return out;
}

// ---------------------------------------------------------------------------
// TrustScore
// ---------------------------------------------------------------------------

export async function getNurseScore(db: Queryable, nurseId: string): Promise<(NurseScoreRow & { rating_avg: string }) | null> {
  const { rows } = await db.query<NurseScoreRow & { rating_avg: string }>(
    'SELECT trust_score, profile_status, rating_avg FROM nurse_profiles WHERE user_id = $1',
    [nurseId],
  );
  return rows[0] ?? null;
}

export async function lockNurseScore(db: Queryable, nurseId: string): Promise<NurseScoreRow | null> {
  const { rows } = await db.query<NurseScoreRow>(
    'SELECT trust_score, profile_status FROM nurse_profiles WHERE user_id = $1 FOR UPDATE',
    [nurseId],
  );
  return rows[0] ?? null;
}

export async function trustEventExists(db: Queryable, nurseId: string, reason: TrustScoreReason, bookingId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'SELECT 1 FROM trust_score_events WHERE nurse_id = $1 AND reason = $2 AND booking_id = $3',
    [nurseId, reason, bookingId],
  );
  return (rowCount ?? 0) > 0;
}

export async function insertTrustEvent(
  db: Queryable,
  e: {
    nurseId: string; reason: TrustScoreReason; requested: number; applied: number; before: number; after: number;
    bookingId: string | null; note: string | null; actorId: string | null;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO trust_score_events
       (nurse_id, reason, requested_delta, applied_delta, score_before, score_after, booking_id, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [e.nurseId, e.reason, e.requested, e.applied, e.before, e.after, e.bookingId, e.note, e.actorId],
  );
}

/** Stores the new score; with `suspend`, also SUSPENDS the profile (only if still ACTIVE). */
export async function updateNurseScore(db: Queryable, nurseId: string, score: number, suspend: boolean): Promise<void> {
  await db.query(
    `UPDATE nurse_profiles
        SET trust_score = $2,
            profile_status = CASE WHEN $3::boolean AND profile_status = 'ACTIVE' THEN 'SUSPENDED'::profile_status_enum ELSE profile_status END,
            suspended_reason = CASE WHEN $3::boolean AND profile_status = 'ACTIVE' THEN 'TRUST_SCORE_BELOW_THRESHOLD' ELSE suspended_reason END,
            updated_at = now()
      WHERE user_id = $1`,
    [nurseId, score, suspend],
  );
}

export async function listTrustHistory(db: Queryable, nurseId: string, limit: number) {
  const { rows } = await db.query<{
    id: string; applied_delta: number; reason: TrustScoreReason; booking_code: string | null; note: string | null; created_at: Date;
  }>(
    `SELECT e.id, e.applied_delta, e.reason, b.booking_code, e.note, e.created_at
       FROM trust_score_events e
       LEFT JOIN bookings b ON b.id = e.booking_id
      WHERE e.nurse_id = $1
      ORDER BY e.created_at DESC
      LIMIT $2`,
    [nurseId, limit],
  );
  return rows;
}
