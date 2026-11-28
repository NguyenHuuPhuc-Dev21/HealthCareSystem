/**
 * check-in — SQL (BE-2 · Phase 4). Shift log and booking writes are in shift-logs.repo.
 */
import type { Queryable } from '../../core/database';
import type { AttemptOutcome, SelfieUploadRow } from './check-in.types';

export async function insertSelfieUpload(
  db: Queryable,
  p: { key: string; bookingId: string; nurseId: string; contentType: string; at: Date },
): Promise<void> {
  await db.query(
    `INSERT INTO checkin_selfie_uploads (object_key, booking_id, nurse_id, content_type, issued_at) VALUES ($1, $2, $3, $4, $5)`,
    [p.key, p.bookingId, p.nurseId, p.contentType, p.at],
  );
}

export async function findSelfieUpload(db: Queryable, key: string): Promise<SelfieUploadRow | null> {
  const { rows } = await db.query<SelfieUploadRow>(
    `SELECT object_key, booking_id, nurse_id, content_type, issued_at, used_at FROM checkin_selfie_uploads WHERE object_key = $1`,
    [key],
  );
  return rows[0] ?? null;
}

/** Single use: false when another check-in already consumed this key. */
export async function markSelfieUsed(db: Queryable, key: string, at: Date): Promise<boolean> {
  const r = await db.query(`UPDATE checkin_selfie_uploads SET used_at = $2 WHERE object_key = $1 AND used_at IS NULL`, [key, at]);
  return (r.rowCount ?? 0) === 1;
}

export async function insertAttempt(
  db: Queryable,
  p: { bookingId: string; nurseId: string; at: Date; lat: number; lng: number; distanceM: number | null; mock: boolean; outcome: AttemptOutcome },
): Promise<void> {
  await db.query(
    `INSERT INTO checkin_attempts (booking_id, nurse_id, attempted_at, lat, lng, distance_m, is_mock_location, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [p.bookingId, p.nurseId, p.at, p.lat, p.lng, p.distanceM, p.mock, p.outcome],
  );
}
