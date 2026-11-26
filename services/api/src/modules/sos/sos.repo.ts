/**
 * sos — SQL (BE-3 · Phase 4 · FR-SHIFT-05).
 */
import type { Queryable } from '../../core/database';
import type { IncidentEvent, SosBookingRow, SosRow, SosStatus, VitalReading } from './sos.types';

/** The booking, its patient, nurse, check-in position and vitals — row-locked so two presses serialise. */
export async function lockBooking(db: Queryable, bookingId: string): Promise<SosBookingRow | null> {
  const { rows } = await db.query<SosBookingRow>(
    `SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.execution_status::text AS execution_status,
            p.full_name AS patient_name, n.full_name AS nurse_name,
            s.checkin_lat, s.checkin_lng, p.lat AS care_lat, p.lng AS care_lng, s.vital_signs_log
       FROM bookings b
       JOIN patient_profiles p ON p.id = b.patient_profile_id
       LEFT JOIN users n ON n.id = b.nurse_id
       LEFT JOIN shift_logs s ON s.booking_id = b.id
      WHERE b.id = $1
      FOR UPDATE OF b`,
    [bookingId],
  );
  return rows[0] ?? null;
}

const SELECT = `
  SELECT a.id, a.booking_id, b.booking_code, b.customer_id, b.nurse_id, p.full_name AS patient_name, n.full_name AS nurse_name,
         a.raised_by, a.raised_by_role, a.lat, a.lng, a.vitals, a.status, a.acknowledged_at, a.closed_at, a.outcome,
         a.close_note, a.created_at
    FROM sos_alerts a
    JOIN bookings b ON b.id = a.booking_id
    JOIN patient_profiles p ON p.id = b.patient_profile_id
    LEFT JOIN users n ON n.id = b.nurse_id`;

export async function findOpenForBooking(db: Queryable, bookingId: string): Promise<SosRow | null> {
  const { rows } = await db.query<SosRow>(`${SELECT} WHERE a.booking_id = $1 AND a.status <> 'CLOSED'`, [bookingId]);
  return rows[0] ?? null;
}

/** The open alert of a booking, else its latest one (for the tracking screen). */
export async function currentForBooking(db: Queryable, bookingId: string): Promise<SosRow | null> {
  const { rows } = await db.query<SosRow>(
    `${SELECT} WHERE a.booking_id = $1 ORDER BY (a.status <> 'CLOSED') DESC, a.created_at DESC LIMIT 1`,
    [bookingId],
  );
  return rows[0] ?? null;
}

export async function findAlert(db: Queryable, id: string, lock = false): Promise<SosRow | null> {
  const { rows } = await db.query<SosRow>(`${SELECT} WHERE a.id = $1 ${lock ? 'FOR UPDATE OF a' : ''}`, [id]);
  return rows[0] ?? null;
}

export async function insertAlert(
  db: Queryable,
  a: { bookingId: string; raisedBy: string; role: string; lat: number | null; lng: number | null; vitals: VitalReading | null; at: Date },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO sos_alerts (booking_id, raised_by, raised_by_role, lat, lng, vitals, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING id`,
    [a.bookingId, a.raisedBy, a.role, a.lat, a.lng, a.vitals ? JSON.stringify(a.vitals) : null, a.at],
  );
  return rows[0].id;
}

export async function setAcknowledged(db: Queryable, id: string, by: string, at: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE sos_alerts SET status = 'ACKNOWLEDGED', acknowledged_by = $2, acknowledged_at = $3 WHERE id = $1 AND status = 'ACTIVE'`,
    [id, by, at],
  );
  return (rowCount ?? 0) > 0;
}

export async function setClosed(db: Queryable, id: string, c: { by: string; at: Date; outcome: string; note: string }): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE sos_alerts SET status = 'CLOSED', closed_by = $2, closed_at = $3, outcome = $4, close_note = $5
      WHERE id = $1 AND status <> 'CLOSED'`,
    [id, c.by, c.at, c.outcome, c.note],
  );
  return (rowCount ?? 0) > 0;
}

/** Appends one event to the incident report kept with the shift (the shift_logs row is created if missing). */
export async function appendIncident(db: Queryable, bookingId: string, e: IncidentEvent): Promise<void> {
  await db.query(
    `INSERT INTO shift_logs (booking_id, emergency_incident_log) VALUES ($1, jsonb_build_array($2::jsonb))
     ON CONFLICT (booking_id) DO UPDATE
       SET emergency_incident_log = COALESCE(shift_logs.emergency_incident_log, '[]'::jsonb) || jsonb_build_array($2::jsonb)`,
    [bookingId, JSON.stringify(e)],
  );
}

export async function incidentLog(db: Queryable, bookingId: string): Promise<unknown[]> {
  const { rows } = await db.query<{ log: unknown[] | null }>(`SELECT emergency_incident_log AS log FROM shift_logs WHERE booking_id = $1`, [bookingId]);
  return rows[0]?.log ?? [];
}

export async function listAlerts(
  db: Queryable,
  viewer: { id: string; isAdmin: boolean },
  statuses: SosStatus[],
  limit: number,
): Promise<SosRow[]> {
  const { rows } = await db.query<SosRow>(
    `${SELECT}
      WHERE a.status = ANY($1::text[])
        AND ($2::boolean OR b.customer_id = $3 OR b.nurse_id = $3)
      ORDER BY (a.status = 'ACTIVE') DESC, a.created_at DESC
      LIMIT $4`,
    [statuses, viewer.isAdmin, viewer.id, limit],
  );
  return rows;
}

export async function activeAdminIds(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'`);
  return rows.map((r) => r.id);
}

/** The acknowledging user's SOS notifications for this alert are acknowledged too: no SMS fallback for them. */
export async function ackNotifications(db: Queryable, userId: string, alertId: string): Promise<void> {
  await db.query(
    `UPDATE notifications SET acked_at = COALESCE(acked_at, now()), is_read = TRUE, read_at = COALESCE(read_at, now())
      WHERE user_id = $1 AND type = 'SOS' AND data->>'alertId' = $2`,
    [userId, alertId],
  );
}
