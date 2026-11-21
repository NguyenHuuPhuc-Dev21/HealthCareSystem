/**
 * SQL for nurse-search (ADR-0002, read-only). BE-3 · Phase 2 · FR-SEARCH-01.
 *
 * The gate columns are the SAME as matching-radar's NURSE_SELECT (incl. held_transfer_shifts), so
 * eligibilityBlocker sees identical data in search and at claim time. Availability is NOT read here
 * (availability-engine owns nurse_availabilities).
 */
import type { Queryable } from '../../core/database';
import type { NurseSearchRow, ReviewRow, SearchServiceRow } from './nurse-search.types';

const SEARCH_SELECT = `
  SELECT np.user_id, u.status AS user_status, np.profile_status, np.tier, np.gphn_number,
         to_char(np.gphn_expiry_date, 'YYYY-MM-DD') AS gphn_expiry_date,
         np.current_lat, np.current_lng, COALESCE(w.deposit_balance, 0) AS deposit_balance,
         w.deposit_grace_expires_at, COALESCE(w.deposit_grace_shifts_used, 0) AS deposit_grace_shifts_used,
         w.closure_requested_at,
         (SELECT count(*) FROM bookings x
           WHERE x.nurse_id = np.user_id AND x.payment_method = 'BANK_TRANSFER'
             AND x.execution_status IN ('CONFIRMED', 'IN_PROGRESS')) AS held_transfer_shifts,
         u.full_name, u.avatar_url, u.gender, np.years_of_exp, np.is_retired_medical_staff, np.rating_avg,
         (SELECT count(*) FROM reviews r
           WHERE r.reviewee_id = np.user_id AND r.is_visible AND r.reviewer_role = 'PATIENT') AS review_count
    FROM nurse_profiles np
    JOIN users u ON u.id = np.user_id
    LEFT JOIN wallets w ON w.user_id = np.user_id`;

export async function getServiceByCode(db: Queryable, code: string): Promise<SearchServiceRow | null> {
  const { rows } = await db.query<SearchServiceRow>(
    `SELECT id, code, is_invasive, is_prohibited, is_active, required_tier FROM service_categories WHERE code = $1`,
    [code],
  );
  return rows[0] ?? null;
}

/**
 * Coarse pre-filter (cheap, index-friendly): ACTIVE, position inside the bounding box, no closure request,
 * full deposit or a grace period still running, optional gender. Nearest first, at most `limit` rows.
 * The exact rules (distance, tier on the shift date, deposit per payment method) run in the policy.
 */
export async function findSearchCandidates(
  db: Queryable,
  p: {
    box: { minLat: number; maxLat: number; minLng: number; maxLng: number };
    care: { lat: number; lng: number };
    minDeposit: number;
    gender?: string;
    limit: number;
  },
): Promise<NurseSearchRow[]> {
  const { rows } = await db.query<NurseSearchRow>(
    `${SEARCH_SELECT}
      WHERE np.profile_status = 'ACTIVE'
        AND u.status = 'ACTIVE'
        AND np.current_lat BETWEEN $1 AND $2
        AND np.current_lng BETWEEN $3 AND $4
        AND w.closure_requested_at IS NULL
        AND (COALESCE(w.deposit_balance, 0) >= $5 OR w.deposit_grace_expires_at > now())
        AND ($6::gender_enum IS NULL OR u.gender = $6::gender_enum)
      ORDER BY (np.current_lat - $7) ^ 2 + (np.current_lng - $8) ^ 2, np.user_id
      LIMIT $9`,
    [p.box.minLat, p.box.maxLat, p.box.minLng, p.box.maxLng, p.minDeposit, p.gender ?? null, p.care.lat, p.care.lng, p.limit],
  );
  return rows;
}

/** One nurse for the profile page; null when not ACTIVE or closing the account. */
export async function getPublicNurse(db: Queryable, nurseId: string): Promise<NurseSearchRow | null> {
  const { rows } = await db.query<NurseSearchRow>(
    `${SEARCH_SELECT}
      WHERE np.user_id = $1
        AND np.profile_status = 'ACTIVE'
        AND u.status = 'ACTIVE'
        AND w.closure_requested_at IS NULL`,
    [nurseId],
  );
  return rows[0] ?? null;
}

/** Newest visible reviews written by patients (verified = tied to a real booking by reviews.booking_id). */
export async function listVisibleReviews(db: Queryable, nurseId: string, limit: number): Promise<ReviewRow[]> {
  const { rows } = await db.query<ReviewRow>(
    `SELECT rating, comment, created_at
       FROM reviews
      WHERE reviewee_id = $1 AND is_visible AND reviewer_role = 'PATIENT'
      ORDER BY created_at DESC, id
      LIMIT $2`,
    [nurseId, limit],
  );
  return rows;
}
