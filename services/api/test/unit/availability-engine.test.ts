import { describe, expect, it } from 'vitest';
import { AvailabilityType } from '@healthcare-system/shared';
import {
  checkSlot,
  clockToMinutes,
  effectiveIntervals,
  subtract,
  normalize,
  vnClock,
  vnDate,
  weekdayOf,
  windowMinutes,
} from '../../src/modules/availability-engine/availability-engine.policy';
import type { BusyBooking, NurseSchedule, ScheduleRow } from '../../src/modules/availability-engine/availability-engine.types';

/**
 * availability-engine — FR-SCHED-01, BR-03 §2.5, BR-14 §2.5, Phase 2 exit criteria.
 * Pure engine only: dates are fixed, nothing reads the real clock.
 * Calendar used: 2026-11-16 is a MONDAY (dayOfWeek 1), Vietnam time = UTC+7.
 */

const BUFFER = 60;
const MON = '2026-11-16';
const TUE = '2026-11-17';
const SUN = '2026-11-15';

/** Vietnam local date + HH:MM → absolute Date. */
const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
const slot = (date: string, from: string, toDate: string, to: string) => ({ start: vn(date, from), end: vn(toDate, to) });

const weekly = (dayOfWeek: number, startTime: string, endTime: string): ScheduleRow => ({
  availabilityType: AvailabilityType.RECURRING_AVAILABLE,
  dayOfWeek,
  specificDate: null,
  startTime,
  endTime,
});
const off = (specificDate: string, startTime = '00:00', endTime = '23:59'): ScheduleRow => ({
  availabilityType: AvailabilityType.TIME_OFF_EXCEPTION,
  dayOfWeek: null,
  specificDate,
  startTime,
  endTime,
});
const open = (specificDate: string, startTime: string, endTime: string): ScheduleRow => ({
  availabilityType: AvailabilityType.DATE_AVAILABLE,
  dayOfWeek: null,
  specificDate,
  startTime,
  endTime,
});
const booking = (id: string, date: string, from: string, toDate: string, to: string): BusyBooking => ({
  id,
  start: vn(date, from),
  end: vn(toDate, to),
});

const check = (s: NurseSchedule, sl: { start: Date; end: Date }, ignore?: string) => checkSlot(s, sl, BUFFER, ignore);

describe('clock & calendar', () => {
  it('parses clocks, overnight windows and the 23:59 = midnight convention', () => {
    expect(clockToMinutes('07:30')).toBe(450);
    expect(windowMinutes('08:00', '16:00')).toEqual([480, 960]);
    expect(windowMinutes('19:00', '06:00')).toEqual([1140, 1800]); // past midnight
    expect(windowMinutes('00:00', '23:59')).toEqual([0, 1440]); // all day
    expect(windowMinutes('08:00', '08:00')).toEqual([480, 1920]); // 24 h (only shifts use this)
  });

  it('uses Vietnam dates and weekdays, not UTC', () => {
    expect(weekdayOf(MON)).toBe(1);
    expect(weekdayOf(SUN)).toBe(0);
    // 2026-11-16 23:30 UTC is already Tuesday 06:30 in Vietnam
    const t = Date.parse('2026-11-16T23:30:00Z');
    expect(vnDate(t)).toBe(TUE);
    expect(vnClock(t)).toBe('06:30');
  });

  it('interval algebra', () => {
    expect(normalize([{ start: 5, end: 8 }, { start: 1, end: 3 }, { start: 3, end: 4 }])).toEqual([
      { start: 1, end: 4 },
      { start: 5, end: 8 },
    ]);
    expect(subtract([{ start: 0, end: 10 }], [{ start: 2, end: 3 }, { start: 8, end: 12 }])).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 8 },
    ]);
  });
});

describe('declared schedule', () => {
  const s: NurseSchedule = { rows: [weekly(1, '08:00', '16:00')], busy: [] };

  it('a slot inside a weekly window is available; outside is NO_DECLARED_AVAILABILITY', () => {
    expect(check(s, slot(MON, '09:00', MON, '13:00'))).toEqual({ available: true });
    expect(check(s, slot(MON, '15:00', MON, '17:00'))).toEqual({ available: false, reason: 'NO_DECLARED_AVAILABILITY' });
    expect(check(s, slot(TUE, '09:00', TUE, '13:00'))).toEqual({ available: false, reason: 'NO_DECLARED_AVAILABILITY' });
  });

  it('applies to every week (recurring)', () => {
    expect(check(s, slot('2026-11-23', '08:00', '2026-11-23', '16:00'))).toEqual({ available: true });
  });

  it('an overnight window covers the early hours of the next day', () => {
    const night: NurseSchedule = { rows: [weekly(1, '19:00', '06:00')], busy: [] };
    expect(check(night, slot(MON, '20:00', TUE, '06:00'))).toEqual({ available: true });
    expect(check(night, slot(TUE, '02:00', TUE, '05:00'))).toEqual({ available: true });
    expect(check(night, slot(TUE, '05:00', TUE, '07:00')).available).toBe(false);
  });

  it('touching windows merge: a shift can run across them (all-day Mon + Tue morning)', () => {
    const s2: NurseSchedule = { rows: [weekly(1, '00:00', '23:59'), weekly(2, '00:00', '08:00')], busy: [] };
    expect(check(s2, slot(MON, '20:00', TUE, '08:00'))).toEqual({ available: true });
  });

  it('a slot must fit in ONE contiguous window (a gap in the middle fails)', () => {
    const s2: NurseSchedule = { rows: [weekly(1, '07:00', '12:00'), weekly(1, '13:00', '17:00')], busy: [] };
    expect(check(s2, slot(MON, '08:00', MON, '16:00'))).toEqual({ available: false, reason: 'NO_DECLARED_AVAILABILITY' });
  });

  it('DATE_AVAILABLE replaces that date’s weekly windows only', () => {
    const s2: NurseSchedule = { rows: [weekly(1, '08:00', '16:00'), open(MON, '18:00', '22:00')], busy: [] };
    expect(check(s2, slot(MON, '09:00', MON, '12:00'))).toEqual({ available: false, reason: 'NO_DECLARED_AVAILABILITY' });
    expect(check(s2, slot(MON, '18:00', MON, '22:00'))).toEqual({ available: true });
    expect(check(s2, slot('2026-11-23', '09:00', '2026-11-23', '12:00'))).toEqual({ available: true }); // next Monday
  });

  it('DATE_AVAILABLE also opens a day with no weekly windows', () => {
    const s2: NurseSchedule = { rows: [open(TUE, '07:00', '11:00')], busy: [] };
    expect(check(s2, slot(TUE, '07:00', TUE, '11:00'))).toEqual({ available: true });
  });
});

describe('time-off exceptions (exit criterion 1)', () => {
  it('an all-day time-off removes that date entirely → TIME_OFF', () => {
    const s: NurseSchedule = { rows: [weekly(1, '08:00', '16:00'), off(MON)], busy: [] };
    expect(check(s, slot(MON, '09:00', MON, '10:00'))).toEqual({ available: false, reason: 'TIME_OFF' });
    expect(check(s, slot('2026-11-23', '09:00', '2026-11-23', '10:00'))).toEqual({ available: true });
  });

  it('a partial time-off only cuts its hours', () => {
    const s: NurseSchedule = { rows: [weekly(1, '08:00', '16:00'), off(MON, '12:00', '14:00')], busy: [] };
    expect(check(s, slot(MON, '08:00', MON, '12:00'))).toEqual({ available: true });
    expect(check(s, slot(MON, '11:00', MON, '13:00'))).toEqual({ available: false, reason: 'TIME_OFF' });
  });

  it('an all-day time-off also cuts the spill of the previous night', () => {
    const s: NurseSchedule = { rows: [weekly(1, '19:00', '06:00'), off(TUE)], busy: [] };
    expect(check(s, slot(MON, '20:00', MON, '23:00'))).toEqual({ available: true });
    expect(check(s, slot(TUE, '01:00', TUE, '04:00'))).toEqual({ available: false, reason: 'TIME_OFF' });
  });
});

describe('bookings and the 60-minute travel buffer (exit criterion 2)', () => {
  // all day Monday, one confirmed shift 10:00–14:00
  const s: NurseSchedule = { rows: [weekly(1, '00:00', '23:59')], busy: [booking('b1', MON, '10:00', MON, '14:00')] };

  it('overlapping the shift → BOOKING_CONFLICT', () => {
    expect(check(s, slot(MON, '13:00', MON, '16:00'))).toEqual({ available: false, reason: 'BOOKING_CONFLICT' });
  });

  it('starting 59 min after the shift → TRAVEL_BUFFER; 60 min after → available', () => {
    expect(check(s, slot(MON, '14:59', MON, '18:00'))).toEqual({ available: false, reason: 'TRAVEL_BUFFER' });
    expect(check(s, slot(MON, '15:00', MON, '18:00'))).toEqual({ available: true });
  });

  it('ending 59 min before the shift → TRAVEL_BUFFER; 60 min before → available', () => {
    expect(check(s, slot(MON, '06:00', MON, '09:01'))).toEqual({ available: false, reason: 'TRAVEL_BUFFER' });
    expect(check(s, slot(MON, '06:00', MON, '09:00'))).toEqual({ available: true });
  });

  it('the buffer applies across midnight and to shifts of other days', () => {
    const night: NurseSchedule = {
      rows: [weekly(1, '00:00', '23:59'), weekly(2, '00:00', '23:59')],
      busy: [booking('b2', MON, '20:00', TUE, '06:00')],
    };
    expect(check(night, slot(TUE, '06:30', TUE, '10:00'))).toEqual({ available: false, reason: 'TRAVEL_BUFFER' });
    expect(check(night, slot(TUE, '07:00', TUE, '10:00'))).toEqual({ available: true });
  });

  it('ignoreBookingId lets a booking be re-checked against itself (re-match / extension)', () => {
    expect(check(s, slot(MON, '10:00', MON, '14:00'), 'b1')).toEqual({ available: true });
  });

  it('effective intervals = schedule − (bookings ± buffer)', () => {
    const range = { start: vn(MON, '00:00').getTime(), end: vn(TUE, '00:00').getTime() };
    expect(effectiveIntervals(s, range, BUFFER)).toEqual([
      { start: vn(MON, '00:00').getTime(), end: vn(MON, '09:00').getTime() },
      { start: vn(MON, '15:00').getTime(), end: vn(TUE, '00:00').getTime() },
    ]);
  });
});
