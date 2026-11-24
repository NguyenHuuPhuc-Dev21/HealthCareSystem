/**
 * notifications — SQL (BE-3 · Phase 6). The in-app centre lists IN_APP rows only; reading one marks the
 * whole event (event_id, 0023) read and acknowledged, so the 60 s SMS fallback stops.
 */
import type { Queryable } from '../../core/database';
import type { InboxRow } from './notifications.types';

const INBOX_COLUMNS = `
  id, type, priority::text AS priority, title, body, data, booking_id, read_at, is_read, created_at,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at_text`;

export async function listInbox(
  db: Queryable,
  userId: string,
  opts: { before: { at: string; id: string } | null; limit: number; unreadOnly: boolean },
): Promise<InboxRow[]> {
  const { rows } = await db.query<InboxRow>(
    `SELECT ${INBOX_COLUMNS}
       FROM notifications
      WHERE user_id = $1
        AND channel = 'IN_APP'
        AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::uuid))
        AND (NOT $4::boolean OR NOT is_read)
      ORDER BY created_at DESC, id DESC
      LIMIT $5`,
    [userId, opts.before?.at ?? null, opts.before?.id ?? null, opts.unreadOnly, opts.limit],
  );
  return rows;
}

export async function countUnread(db: Queryable, userId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND channel = 'IN_APP' AND NOT is_read`,
    [userId],
  );
  return rows[0].n;
}

/** Read + acknowledged, for the row and the other channel rows of its event. Returns the rows touched. */
export async function markEventRead(db: Queryable, userId: string, notificationId: string): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE notifications
        SET is_read = TRUE, read_at = COALESCE(read_at, now()), acked_at = COALESCE(acked_at, now())
      WHERE user_id = $1
        AND (id = $2 OR event_id = (SELECT event_id FROM notifications WHERE id = $2 AND user_id = $1))`,
    [userId, notificationId],
  );
  return rowCount ?? 0;
}

/** Everything the user can see is read; open urgent alerts are acknowledged (no SMS after this). */
export async function markAllRead(db: Queryable, userId: string): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE notifications
        SET is_read = TRUE, read_at = COALESCE(read_at, now()), acked_at = COALESCE(acked_at, now())
      WHERE user_id = $1
        AND channel IN ('IN_APP', 'PUSH_FCM')
        AND (NOT is_read OR acked_at IS NULL)
        AND (channel = 'PUSH_FCM' OR NOT is_read)`,
    [userId],
  );
  return rowCount ?? 0;
}
