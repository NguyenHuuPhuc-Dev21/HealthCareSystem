/**
 * chat — SQL (BE-2 · Phase 6). Phone numbers are never read here: nothing can leak them.
 */
import type { Queryable } from '../../core/database';
import type { ChatBookingRow, MessageRow } from './chat.types';

const BOOKING_SELECT = `
  SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.execution_status::text AS execution_status,
         c.full_name AS customer_name, p.full_name AS patient_name, n.full_name AS nurse_name
    FROM bookings b
    JOIN users c ON c.id = b.customer_id
    JOIN patient_profiles p ON p.id = b.patient_profile_id
    LEFT JOIN users n ON n.id = b.nurse_id`;

export async function findBooking(db: Queryable, bookingId: string): Promise<ChatBookingRow | null> {
  const { rows } = await db.query<ChatBookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [bookingId]);
  return rows[0] ?? null;
}

/**
 * FOR SHARE: a message and a check-out / cancellation (FOR UPDATE on the booking) serialize, so nothing is
 * accepted after the conversation closed; concurrent messages do not block each other.
 */
export async function shareLockBooking(db: Queryable, bookingId: string): Promise<ChatBookingRow | null> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM bookings WHERE id = $1 FOR SHARE`, [bookingId]);
  return rows[0] ? findBooking(db, bookingId) : null;
}

const MESSAGE_COLUMNS = `m.id, m.booking_id, m.sender_id, m.receiver_id, m.message_type::text AS message_type, m.content,
  m.call_duration_sec, m.is_flagged, m.is_read, m.read_at, m.created_at`;

export async function listMessages(db: Queryable, bookingId: string, limit: number): Promise<MessageRow[]> {
  const { rows } = await db.query<MessageRow>(
    `SELECT * FROM (SELECT ${MESSAGE_COLUMNS} FROM conversations_messages m WHERE m.booking_id = $1
                     ORDER BY m.created_at DESC, m.id DESC LIMIT $2) t
      ORDER BY t.created_at, t.id`,
    [bookingId, limit],
  );
  return rows;
}

/** Admin evidence view: everything, with sender names and flag reasons. */
export async function listAllMessagesWithFlags(db: Queryable, bookingId: string): Promise<MessageRow[]> {
  const { rows } = await db.query<MessageRow>(
    `SELECT ${MESSAGE_COLUMNS}, u.full_name AS sender_name, to_jsonb(f.reasons) AS flag_reasons
       FROM conversations_messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN chat_flags f ON f.message_id = m.id
      WHERE m.booking_id = $1
      ORDER BY m.created_at, m.id`,
    [bookingId],
  );
  return rows;
}

export async function insertMessage(
  db: Queryable,
  p: { bookingId: string; senderId: string; receiverId: string; type: string; content: string | null; callSec: number | null; flagged: boolean; at: Date },
): Promise<MessageRow> {
  const { rows } = await db.query<MessageRow>(
    `INSERT INTO conversations_messages (booking_id, sender_id, receiver_id, message_type, content, call_duration_sec, is_flagged, created_at)
     VALUES ($1, $2, $3, $4::message_type_enum, $5, $6, $7, $8)
     RETURNING id, booking_id, sender_id, receiver_id, message_type::text AS message_type, content, call_duration_sec,
               is_flagged, is_read, read_at, created_at`,
    [p.bookingId, p.senderId, p.receiverId, p.type, p.content, p.callSec, p.flagged, p.at],
  );
  return rows[0];
}

export async function insertFlag(
  db: Queryable,
  p: { messageId: string; bookingId: string; senderId: string; reasons: string[]; matches: string[]; at: Date },
): Promise<void> {
  await db.query(
    `INSERT INTO chat_flags (message_id, booking_id, sender_id, reasons, matches, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [p.messageId, p.bookingId, p.senderId, p.reasons, p.matches, p.at],
  );
}

/** Read receipt: every message received by `readerId` up to (and including) `lastMessageId`. Returns its time. */
export async function markRead(db: Queryable, bookingId: string, readerId: string, lastMessageId: string, at: Date): Promise<Date | null> {
  const { rows } = await db.query<{ created_at: Date }>(
    `SELECT created_at FROM conversations_messages WHERE id = $1 AND booking_id = $2`,
    [lastMessageId, bookingId],
  );
  if (!rows[0]) return null;
  await db.query(
    `UPDATE conversations_messages SET is_read = TRUE, read_at = $4
      WHERE booking_id = $1 AND receiver_id = $2 AND is_read = FALSE AND created_at <= $3`,
    [bookingId, readerId, rows[0].created_at, at],
  );
  return rows[0].created_at;
}

/** WebSocket: may this user follow this conversation? (customer, the current nurse, or an Admin) */
export async function canWatch(db: Queryable, bookingId: string, user: { id: string; role: string }): Promise<boolean> {
  if (user.role === 'ADMIN') {
    const { rows } = await db.query(`SELECT 1 FROM bookings WHERE id = $1`, [bookingId]);
    return rows.length > 0;
  }
  const { rows } = await db.query(`SELECT 1 FROM bookings WHERE id = $1 AND (customer_id = $2 OR nurse_id = $2)`, [bookingId, user.id]);
  return rows.length > 0;
}
