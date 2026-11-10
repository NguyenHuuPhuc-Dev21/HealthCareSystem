/**
 * SQL for tier-lifecycle (ADR-0002). Every write function expects a TRANSACTION client.
 * BE-2 · Phase 1 · FR-AUTH-02 §2, BR-21 §2.5.
 */
import { TIMEZONE_DISPLAY } from '@healthcare-system/shared';
import type { Queryable } from '../../core/database';
import type { LockedTierRow, ReleasedBookingRow } from './tier-lifecycle.types';

/**
 * Tier 2 nurses whose GPHN is expired on `today` (expiry <= today, or missing), in id order.
 * Keyset pagination (`afterId`) so a nurse that keeps failing cannot make the sweep loop forever.
 * No lock here — each candidate is locked and re-checked in its own transaction.
 */
export async function findDemotionCandidates(
  db: Queryable,
  today: string,
  limit: number,
  afterId: string | null,
): Promise<string[]> {
  const { rows } = await db.query<{ user_id: string }>(
    `SELECT user_id
       FROM nurse_profiles
      WHERE tier = 'TIER_2_SPECIALIST'
        AND (gphn_number IS NULL OR gphn_expiry_date IS NULL OR gphn_expiry_date <= $1::date)
        AND ($3::uuid IS NULL OR user_id > $3::uuid)
      ORDER BY user_id
      LIMIT $2`,
    [today, limit, afterId],
  );
  return rows.map((r) => r.user_id);
}

/**
 * Locks the nurse row. credential-review locks the SAME row when it approves a renewed GPHN,
 * so a sweep and an approval for one nurse run one after the other, never interleaved.
 */
export async function lockNurseTier(db: Queryable, nurseId: string): Promise<LockedTierRow | null> {
  const { rows } = await db.query<LockedTierRow>(
    `SELECT tier, gphn_number, to_char(gphn_expiry_date, 'YYYY-MM-DD') AS gphn_expiry_date, profile_status
       FROM nurse_profiles
      WHERE user_id = $1
      FOR UPDATE`,
    [nurseId],
  );
  return rows[0] ?? null;
}

/** Tier 2 → Tier 1. profile_status is deliberately NOT touched: the nurse stays ACTIVE for Tier 1 work. */
export async function demoteToTier1(db: Queryable, nurseId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE nurse_profiles
        SET tier = 'TIER_1_BASIC', updated_at = now()
      WHERE user_id = $1 AND tier = 'TIER_2_SPECIALIST'`,
    [nurseId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Takes the nurse off every future CONFIRMED booking that needs Tier 2 and whose service date
 * (Vietnam time) is on/after `fromDate`, and puts it back to MATCHING for re-dispatch.
 *
 *  - "Needs Tier 2" = service is_invasive OR required_tier = TIER_2_SPECIALIST (hard tier gate).
 *  - Only shifts that have not started (start_time > now); a shift already IN_PROGRESS is untouched.
 *  - No penalty, no TrustScore change, no ledger entry: the customer's escrow stays on the booking,
 *    only the nurse changes (FR-AUTH-02 §2: "auto-cancelled without penalty and re-dispatched").
 *  - The nurse's prescription check is reset: the replacement nurse must verify it again.
 * The UPDATE itself row-locks the bookings, so a concurrent check-in or cancel waits for us.
 */
export async function releaseInvasiveBookings(
  db: Queryable,
  nurseId: string,
  fromDate: string,
  now: Date,
): Promise<ReleasedBookingRow[]> {
  const { rows } = await db.query<ReleasedBookingRow>(
    `UPDATE bookings b
        SET nurse_id = NULL,
            execution_status = 'MATCHING',
            prescription_verified_by_nurse = FALSE,
            updated_at = now()
       FROM service_categories s
      WHERE s.id = b.service_id
        AND b.nurse_id = $1
        AND b.execution_status = 'CONFIRMED'
        AND (s.is_invasive OR s.required_tier = 'TIER_2_SPECIALIST')
        AND b.start_time > $3
        AND (b.start_time AT TIME ZONE '${TIMEZONE_DISPLAY}')::date >= $2::date
      RETURNING b.id, b.booking_code, b.customer_id, b.matching_mode, b.start_time`,
    [nurseId, fromDate, now],
  );
  return rows;
}
