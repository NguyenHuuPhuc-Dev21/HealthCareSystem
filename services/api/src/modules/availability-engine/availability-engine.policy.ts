/**
 * availability-engine — PURE core (no DB, no clock). BE-2 · Phase 2.
 * FR-SCHED-01 · BR-03 §2.5 · BR-14 §2.5 · RTM: Phase 2 exit criteria.
 *
 *   effective availability = declared schedule
 *                            − time-off exceptions
 *                            − (CONFIRMED / IN_PROGRESS bookings ± travel buffer)
 *
 * THE ONLY implementation of this rule. Nurse search (BE-3), Radar / Job Board matching and
 * booking acceptance (BE-2, Phase 3) must all go through this module — never re-implement it
 * in SQL — so search and dispatch can never disagree (Phase 2 exit criterion).
 *
 * Conventions
 *  - Declared times are Vietnam local (Asia/Ho_Chi_Minh, UTC+7, no DST). Absolute instants
 *    are epoch ms; intervals are half-open [start, end).
 *  - end_time <= start_time  → the window runs past midnight into the next day.
 *  - end_time 23:59          → "until midnight" (the UI's all-day is 00:00–23:59).
 *  - On a date that has DATE_AVAILABLE rows, those rows REPLACE the recurring windows that
 *    start on that date. Overnight spill from the previous evening still counts.
 *  - TIME_OFF_EXCEPTION rows are subtracted from whatever is declared (incl. spill).
 *  - A slot is available only if ONE contiguous effective interval covers it entirely.
 *  - The buffer blocks [booking.start − buffer, booking.end + buffer): a new shift may start
 *    exactly `buffer` minutes after another ends (60 min gap = OK, 59 = not OK).
 */
import { AvailabilityType } from '@healthcare-system/shared';
import type { AvailabilityCheck, BusyBooking, Interval, NurseSchedule, ScheduleRow, Slot } from './availability-engine.types';

export const MINUTE_MS = 60_000;
export const DAY_MINUTES = 24 * 60;
const DAY_MS = DAY_MINUTES * MINUTE_MS;
/** Vietnam is UTC+7 all year (no daylight saving time). */
const VN_OFFSET_MS = 7 * 60 * MINUTE_MS;

// ---- clock & calendar helpers -------------------------------------------------------

/** 'HH:MM' or 'HH:MM:SS' → minutes since midnight. */
export function clockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * [startMinute, endMinute) of a window relative to its start day.
 * 23:59 as an end means midnight (1440); end <= start means overnight (end + 1440).
 */
export function windowMinutes(startTime: string, endTime: string): [number, number] {
  const s = clockToMinutes(startTime);
  let e = clockToMinutes(endTime);
  if (e === DAY_MINUTES - 1) e = DAY_MINUTES;
  if (e <= s) e += DAY_MINUTES;
  return [s, e];
}

/** Epoch ms of 00:00 Vietnam time on a YYYY-MM-DD date. */
export function vnMidnight(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - VN_OFFSET_MS;
}

/** Vietnam calendar date (YYYY-MM-DD) of an instant. */
export function vnDate(ms: number): string {
  return new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** Vietnam local clock 'HH:MM' of an instant. */
export function vnClock(ms: number): string {
  return new Date(ms + VN_OFFSET_MS).toISOString().slice(11, 16);
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  return vnDate(vnMidnight(date) + days * DAY_MS);
}

/** Every date from `from` to `to`, both included. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---- interval algebra ---------------------------------------------------------------

/** Sorted, non-overlapping, non-touching union of the intervals. */
export function normalize(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** `base` minus every interval in `cut` (both normalized internally). */
export function subtract(base: Interval[], cut: Interval[]): Interval[] {
  const cuts = normalize(cut);
  const out: Interval[] = [];
  for (const b of normalize(base)) {
    let pieces: Interval[] = [b];
    for (const c of cuts) {
      if (c.end <= b.start || c.start >= b.end) continue;
      pieces = pieces.flatMap((p) => {
        if (c.end <= p.start || c.start >= p.end) return [p];
        const left = { start: p.start, end: Math.min(c.start, p.end) };
        const right = { start: Math.max(c.end, p.start), end: p.end };
        return [left, right].filter((x) => x.end > x.start);
      });
    }
    out.push(...pieces);
  }
  return out;
}

export function clip(intervals: Interval[], range: Interval): Interval[] {
  return intervals
    .map((i) => ({ start: Math.max(i.start, range.start), end: Math.min(i.end, range.end) }))
    .filter((i) => i.end > i.start);
}

/** True when one interval of the (normalized) set contains [start, end) entirely. */
export function covers(intervals: Interval[], range: Interval): boolean {
  return normalize(intervals).some((i) => i.start <= range.start && i.end >= range.end);
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

// ---- the rule -----------------------------------------------------------------------

function rowInterval(date: string, row: Pick<ScheduleRow, 'startTime' | 'endTime'>): Interval {
  const [s, e] = windowMinutes(row.startTime, row.endTime);
  const base = vnMidnight(date);
  return { start: base + s * MINUTE_MS, end: base + e * MINUTE_MS };
}

/** Dates whose windows can touch [range.start, range.end): one day back for overnight spill. */
function datesTouching(range: Interval): string[] {
  return datesBetween(addDays(vnDate(range.start), -1), vnDate(range.end - 1));
}

/** Declared availability (recurring / date-open), BEFORE time-off, over `range`. */
export function declaredIntervals(rows: ScheduleRow[], range: Interval): Interval[] {
  const recurring = rows.filter((r) => r.availabilityType === AvailabilityType.RECURRING_AVAILABLE);
  const dateOpen = rows.filter((r) => r.availabilityType === AvailabilityType.DATE_AVAILABLE);
  const out: Interval[] = [];
  for (const date of datesTouching(range)) {
    const opened = dateOpen.filter((r) => r.specificDate === date);
    const source = opened.length > 0 ? opened : recurring.filter((r) => r.dayOfWeek === weekdayOf(date));
    for (const r of source) out.push(rowInterval(date, r));
  }
  return clip(normalize(out), range);
}

/** Time-off exceptions over `range`. */
export function timeOffIntervals(rows: ScheduleRow[], range: Interval): Interval[] {
  return clip(
    normalize(
      rows
        .filter((r) => r.availabilityType === AvailabilityType.TIME_OFF_EXCEPTION && r.specificDate)
        .map((r) => rowInterval(r.specificDate!, r)),
    ),
    range,
  );
}

/** Declared availability minus time-off (what the nurse offers, ignoring bookings). */
export function offeredIntervals(rows: ScheduleRow[], range: Interval): Interval[] {
  return subtract(declaredIntervals(rows, range), timeOffIntervals(rows, range));
}

/** Time blocked by bookings, each widened by the travel buffer on both sides. */
export function busyIntervals(busy: BusyBooking[], bufferMinutes: number, ignoreBookingId?: string): Interval[] {
  const pad = bufferMinutes * MINUTE_MS;
  return normalize(
    busy
      .filter((b) => b.id !== ignoreBookingId)
      .map((b) => ({ start: b.start.getTime() - pad, end: b.end.getTime() + pad })),
  );
}

/** Effective availability over `range`: offered − busy(± buffer). */
export function effectiveIntervals(
  schedule: NurseSchedule,
  range: Interval,
  bufferMinutes: number,
  ignoreBookingId?: string,
): Interval[] {
  return clip(subtract(offeredIntervals(schedule.rows, range), busyIntervals(schedule.busy, bufferMinutes, ignoreBookingId)), range);
}

/** Range the engine looks at for a slot: wide enough for spill and buffers. */
export function lookRange(slot: Slot, bufferMinutes: number): Interval {
  const pad = Math.max(bufferMinutes * MINUTE_MS, DAY_MS);
  return { start: slot.start.getTime() - pad, end: slot.end.getTime() + pad };
}

/** Can this nurse take [slot.start, slot.end)? With the first reason when not. */
export function checkSlot(
  schedule: NurseSchedule,
  slot: Slot,
  bufferMinutes: number,
  ignoreBookingId?: string,
): AvailabilityCheck {
  const want: Interval = { start: slot.start.getTime(), end: slot.end.getTime() };
  const range = lookRange(slot, bufferMinutes);

  if (!covers(declaredIntervals(schedule.rows, range), want)) return { available: false, reason: 'NO_DECLARED_AVAILABILITY' };
  if (!covers(offeredIntervals(schedule.rows, range), want)) return { available: false, reason: 'TIME_OFF' };
  const busy = schedule.busy.filter((b) => b.id !== ignoreBookingId);
  if (busy.some((b) => overlaps({ start: b.start.getTime(), end: b.end.getTime() }, want))) {
    return { available: false, reason: 'BOOKING_CONFLICT' };
  }
  if (!covers(effectiveIntervals(schedule, range, bufferMinutes, ignoreBookingId), want)) {
    return { available: false, reason: 'TRAVEL_BUFFER' };
  }
  return { available: true };
}
