/**
 * nurse-availabilities policy — PURE rules (no DB, no clock). BE-2 · Phase 2 · FR-SCHED-01.
 * Interval maths come from availability-engine so the schedule editor and the engine agree.
 * Overlapping windows are NOT an error: the engine takes their union.
 */
import { AvailabilityType } from '@healthcare-system/shared';
import { addDays, covers, offeredIntervals } from '../availability-engine/availability-engine.policy';
import type { BusyBooking, Interval, ScheduleRow } from '../availability-engine/availability-engine.types';
import type { PutAvailabilitiesBody } from './nurse-availabilities.schema';

type Dated = { specificDate: string };

/** Date rows that ended before yesterday are useless for scheduling: they are not stored again. */
export function isStale(w: Dated, today: string): boolean {
  return w.specificDate < addDays(today, -1);
}

/** The PUT body as engine rows (what will be stored). */
export function toScheduleRows(body: PutAvailabilitiesBody, today: string): ScheduleRow[] {
  return [
    ...body.recurringWindows.map((w) => ({
      availabilityType: AvailabilityType.RECURRING_AVAILABLE,
      dayOfWeek: w.dayOfWeek,
      specificDate: null,
      startTime: w.startTime,
      endTime: w.endTime,
    })),
    ...body.timeOffExceptions
      .filter((w) => !isStale(w, today))
      .map((w) => ({
        availabilityType: AvailabilityType.TIME_OFF_EXCEPTION,
        dayOfWeek: null,
        specificDate: w.specificDate,
        startTime: w.startTime,
        endTime: w.endTime,
      })),
    ...body.dateAvailabilities
      .filter((w) => !isStale(w, today))
      .map((w) => ({
        availabilityType: AvailabilityType.DATE_AVAILABLE,
        dayOfWeek: null,
        specificDate: w.specificDate,
        startTime: w.startTime,
        endTime: w.endTime,
      })),
  ];
}

/**
 * A schedule change may not take away time a confirmed / in-progress shift relies on.
 * Returns the first booking that the OLD schedule covered (from now on) but the NEW one does not.
 * Bookings the old schedule never covered (legacy / test data) do not block a save.
 * The travel buffer is not part of this check: it protects new bookings, not existing ones.
 */
export function findLockedBooking<B extends BusyBooking>(
  oldRows: ScheduleRow[],
  newRows: ScheduleRow[],
  bookings: B[],
  nowMs: number,
): B | null {
  for (const b of bookings) {
    const want: Interval = { start: Math.max(b.start.getTime(), nowMs), end: b.end.getTime() };
    if (want.end <= want.start) continue;
    const range: Interval = { start: want.start - 86_400_000, end: want.end + 86_400_000 };
    if (covers(offeredIntervals(oldRows, range), want) && !covers(offeredIntervals(newRows, range), want)) return b;
  }
  return null;
}
