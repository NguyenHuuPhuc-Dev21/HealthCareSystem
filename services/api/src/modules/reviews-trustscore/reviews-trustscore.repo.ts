/**
 * SQL for reviews-trustscore (ADR-0002). BE-1 · FR-RATE-01, FR-SEARCH-01.
 * Phase 2 scope: the cached nurse rating only (see README).
 */
import type { Queryable } from '../../core/database';

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
