import { describe, expect, it } from 'vitest';
import { AvailabilityType } from '@healthcare-system/shared';
import { findLockedBooking, toScheduleRows } from '../../src/modules/nurse-availabilities/nurse-availabilities.policy';
import { putAvailabilitiesSchema } from '../../src/modules/nurse-availabilities/nurse-availabilities.schema';
import type { ScheduleRow } from '../../src/modules/availability-engine/availability-engine.types';

/**
 * nurse-availabilities — FR-SCHED-01 (board N13). Pure policy + schema.
 * 2026-11-16 is a Monday. Vietnam time = UTC+7.
 */

const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
const NOW = vn('2026-11-12', '09:00').getTime(); // Thursday
const TODAY = '2026-11-12';

/** The weekly schedule FE-2 seeds for the demo nurse (board N13). */
const FE_SEED = [
  { id: 'seed-w1', dayOfWeek: 1, startTime: '07:00', endTime: '12:00' },
  { id: 'seed-w2', dayOfWeek: 1, startTime: '19:00', endTime: '06:00' },
  { id: 'seed-w3', dayOfWeek: 2, startTime: '07:00', endTime: '12:00' },
  { id: 'seed-w4', dayOfWeek: 2, startTime: '19:00', endTime: '06:00' },
  { id: 'seed-w5', dayOfWeek: 3, startTime: '07:00', endTime: '21:00' },
  { id: 'seed-w6', dayOfWeek: 4, startTime: '07:00', endTime: '12:00' },
  { id: 'seed-w7', dayOfWeek: 5, startTime: '20:00', endTime: '06:00' },
  { id: 'seed-w8', dayOfWeek: 6, startTime: '00:00', endTime: '23:59' },
];

describe('schema', () => {
  it('accepts the FE payload (client ids, overnight windows, all-day 00:00–23:59)', () => {
    const r = putAvailabilitiesSchema.safeParse({
      recurringWindows: FE_SEED,
      timeOffExceptions: [{ id: 'off-1', specificDate: '2026-11-20', startTime: '00:00', endTime: '23:59' }],
      dateAvailabilities: [{ id: 'open-1', specificDate: '2026-11-21', startTime: '13:00', endTime: '17:00' }],
    });
    expect(r.success).toBe(true);
  });

  it('time-off and date lists default to empty', () => {
    expect(putAvailabilitiesSchema.parse({ recurringWindows: [] })).toEqual({
      recurringWindows: [],
      timeOffExceptions: [],
      dateAvailabilities: [],
    });
  });

  it.each([
    ['zero-length window', { recurringWindows: [{ dayOfWeek: 1, startTime: '08:00', endTime: '08:00' }] }],
    ['24:00 is not a time', { recurringWindows: [{ dayOfWeek: 1, startTime: '08:00', endTime: '24:00' }] }],
    ['day 7', { recurringWindows: [{ dayOfWeek: 7, startTime: '08:00', endTime: '09:00' }] }],
    ['unknown field', { recurringWindows: [], nurseId: 'x' }],
    ['bad date', { recurringWindows: [], timeOffExceptions: [{ specificDate: '2026-02-30', startTime: '00:00', endTime: '23:59' }] }],
  ])('rejects %s', (_label: unknown, body: unknown) => {
    expect(putAvailabilitiesSchema.safeParse(body).success).toBe(false);
  });
});

describe('toScheduleRows', () => {
  it('maps the three lists and drops date rows older than yesterday', () => {
    const rows = toScheduleRows(
      putAvailabilitiesSchema.parse({
        recurringWindows: [{ dayOfWeek: 1, startTime: '07:00', endTime: '12:00' }],
        timeOffExceptions: [
          { specificDate: '2026-11-01', startTime: '00:00', endTime: '23:59' }, // stale → dropped
          { specificDate: '2026-11-11', startTime: '00:00', endTime: '23:59' }, // yesterday → kept
        ],
        dateAvailabilities: [{ specificDate: '2026-11-21', startTime: '13:00', endTime: '17:00' }],
      }),
      TODAY,
    );
    expect(rows.map((r) => [r.availabilityType, r.dayOfWeek ?? r.specificDate])).toEqual([
      [AvailabilityType.RECURRING_AVAILABLE, 1],
      [AvailabilityType.TIME_OFF_EXCEPTION, '2026-11-11'],
      [AvailabilityType.DATE_AVAILABLE, '2026-11-21'],
    ]);
  });
});

describe('findLockedBooking (409 AVAILABILITY_LOCKED)', () => {
  const weekly = (dayOfWeek: number, startTime: string, endTime: string): ScheduleRow => ({
    availabilityType: AvailabilityType.RECURRING_AVAILABLE,
    dayOfWeek,
    specificDate: null,
    startTime,
    endTime,
  });
  const off = (specificDate: string): ScheduleRow => ({
    availabilityType: AvailabilityType.TIME_OFF_EXCEPTION,
    dayOfWeek: null,
    specificDate,
    startTime: '00:00',
    endTime: '23:59',
  });
  // Friday 2026-11-13 20:00 → Saturday 06:00, like HC-2026-1052 on the board
  const shift = { id: 'b1', code: 'HC-2026-1052', start: vn('2026-11-13', '20:00'), end: vn('2026-11-14', '06:00') };
  const oldRows = [weekly(5, '20:00', '06:00'), weekly(1, '07:00', '12:00')];

  it('removing the window under a confirmed shift is refused', () => {
    expect(findLockedBooking(oldRows, [weekly(1, '07:00', '12:00')], [shift], NOW)).toBe(shift);
  });

  it('shrinking it so the shift is no longer covered is refused', () => {
    expect(findLockedBooking(oldRows, [weekly(5, '21:00', '06:00')], [shift], NOW)).toBe(shift);
  });

  it('a time-off on the shift date is refused', () => {
    expect(findLockedBooking(oldRows, [...oldRows, off('2026-11-13')], [shift], NOW)).toBe(shift);
  });

  it('widening it, or changing other days, is fine', () => {
    expect(findLockedBooking(oldRows, [weekly(5, '18:00', '07:00')], [shift], NOW)).toBeNull();
    expect(findLockedBooking(oldRows, [weekly(5, '20:00', '06:00')], [shift], NOW)).toBeNull();
  });

  it('a shift the old schedule never covered does not block the save', () => {
    expect(findLockedBooking([weekly(1, '07:00', '12:00')], [], [shift], NOW)).toBeNull();
  });

  it('a shift that already ended does not block the save', () => {
    expect(findLockedBooking(oldRows, [], [shift], vn('2026-11-14', '07:00').getTime())).toBeNull();
  });
});
