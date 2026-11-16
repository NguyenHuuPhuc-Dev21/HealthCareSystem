/**
 * SQL for availability-engine (ADR-0002). Read-only. BE-2 · Phase 2.
 * Pass a transaction client when the caller must see the same snapshot it writes in
 * (e.g. booking acceptance in Phase 3 after locking the nurse row).
 */
import type { Queryable } from '../../core/database';
import type { AvailabilityType } from '@healthcare-system/shared';
import type { BusyBooking, ScheduleRow } from './availability-engine.types';

type ScheduleRowDb = {
  nurse_id: string;
  availability_type: AvailabilityType;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
};

type BusyRowDb = { id: string; nurse_id: string; start_time: Date; end_time: Date };

/**
 * Schedule rows of the given nurses: every recurring row, and date rows between
 * fromDate and toDate (YYYY-MM-DD, inclusive).
 */
export async function loadScheduleRows(
  db: Queryable,
  nurseIds: string[],
  fromDate: string,
  toDate: string,
): Promise<Map<string, ScheduleRow[]>> {
  const { rows } = await db.query<ScheduleRowDb>(
    `SELECT nurse_id, availability_type, day_of_week,
            to_char(specific_date, 'YYYY-MM-DD') AS specific_date,
            to_char(start_time, 'HH24:MI') AS start_time,
            to_char(end_time, 'HH24:MI') AS end_time
       FROM nurse_availabilities
      WHERE nurse_id = ANY($1::uuid[])
        AND (specific_date IS NULL OR specific_date BETWEEN $2::date AND $3::date)`,
    [nurseIds, fromDate, toDate],
  );
  const byNurse = new Map<string, ScheduleRow[]>();
  for (const r of rows) {
    const list = byNurse.get(r.nurse_id) ?? [];
    list.push({
      availabilityType: r.availability_type,
      dayOfWeek: r.day_of_week === null ? null : Number(r.day_of_week),
      specificDate: r.specific_date,
      startTime: r.start_time,
      endTime: r.end_time,
    });
    byNurse.set(r.nurse_id, list);
  }
  return byNurse;
}

/** CONFIRMED / IN_PROGRESS bookings of the given nurses that overlap [from, to). */
export async function loadBusyBookings(
  db: Queryable,
  nurseIds: string[],
  from: Date,
  to: Date,
): Promise<Map<string, BusyBooking[]>> {
  const { rows } = await db.query<BusyRowDb>(
    `SELECT id, nurse_id, start_time, end_time
       FROM bookings
      WHERE nurse_id = ANY($1::uuid[])
        AND execution_status IN ('CONFIRMED', 'IN_PROGRESS')
        AND tstzrange(start_time, end_time) && tstzrange($2::timestamptz, $3::timestamptz)`,
    [nurseIds, from, to],
  );
  const byNurse = new Map<string, BusyBooking[]>();
  for (const r of rows) {
    const list = byNurse.get(r.nurse_id) ?? [];
    list.push({ id: r.id, start: new Date(r.start_time), end: new Date(r.end_time) });
    byNurse.set(r.nurse_id, list);
  }
  return byNurse;
}
