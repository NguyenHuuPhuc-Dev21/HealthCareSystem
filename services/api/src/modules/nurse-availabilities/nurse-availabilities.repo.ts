/**
 * SQL for nurse-availabilities (ADR-0002). Writes expect a TRANSACTION client.
 * BE-2 · Phase 2 · FR-SCHED-01.
 */
import type { Queryable } from '../../core/database';
import type { ScheduleRow } from '../availability-engine/availability-engine.types';
import type { AvailabilityRowDb, CalendarBookingRowDb } from './nurse-availabilities.types';

/**
 * Locks the nurse's profile row for the whole schedule change. Booking acceptance (Phase 3)
 * locks the same row before asking availability-engine, so a schedule edit and an accept for one
 * nurse never interleave. Returns false when the user has no nurse profile.
 */
export async function lockNurseProfile(db: Queryable, nurseId: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT user_id FROM nurse_profiles WHERE user_id = $1 FOR UPDATE`, [nurseId]);
  return rows.length > 0;
}

export async function nurseProfileExists(db: Queryable, nurseId: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM nurse_profiles WHERE user_id = $1`, [nurseId]);
  return rows.length > 0;
}

export async function listRows(db: Queryable, nurseId: string): Promise<AvailabilityRowDb[]> {
  const { rows } = await db.query<AvailabilityRowDb>(
    `SELECT id, availability_type, day_of_week,
            to_char(specific_date, 'YYYY-MM-DD') AS specific_date,
            to_char(start_time, 'HH24:MI') AS start_time,
            to_char(end_time, 'HH24:MI') AS end_time
       FROM nurse_availabilities
      WHERE nurse_id = $1
      ORDER BY availability_type, day_of_week NULLS LAST, specific_date NULLS LAST, start_time`,
    [nurseId],
  );
  return rows;
}

export async function deleteAllRows(db: Queryable, nurseId: string): Promise<void> {
  await db.query(`DELETE FROM nurse_availabilities WHERE nurse_id = $1`, [nurseId]);
}

/** One INSERT for the whole schedule (unnest of parallel arrays). */
export async function insertRows(db: Queryable, nurseId: string, rows: ScheduleRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.query(
    `INSERT INTO nurse_availabilities (nurse_id, availability_type, day_of_week, specific_date, start_time, end_time)
     SELECT $1, t.type::availability_type_enum, t.dow, t.d::date, t.s::time, t.e::time
       FROM unnest($2::text[], $3::int[], $4::text[], $5::text[], $6::text[]) AS t(type, dow, d, s, e)`,
    [
      nurseId,
      rows.map((r) => r.availabilityType),
      rows.map((r) => r.dayOfWeek),
      rows.map((r) => r.specificDate),
      rows.map((r) => r.startTime),
      rows.map((r) => r.endTime),
    ],
  );
}

/** Confirmed / in-progress shifts of the nurse that end after `from` and start before `to`. */
export async function listCalendarBookings(
  db: Queryable,
  nurseId: string,
  from: Date,
  to: Date,
): Promise<CalendarBookingRowDb[]> {
  const { rows } = await db.query<CalendarBookingRowDb>(
    `SELECT b.id, b.booking_code, b.start_time, b.end_time, b.execution_status, s.name AS service_name
       FROM bookings b
       JOIN service_categories s ON s.id = b.service_id
      WHERE b.nurse_id = $1
        AND b.execution_status IN ('CONFIRMED', 'IN_PROGRESS')
        AND b.end_time > $2
        AND b.start_time < $3
      ORDER BY b.start_time`,
    [nurseId, from, to],
  );
  return rows;
}
