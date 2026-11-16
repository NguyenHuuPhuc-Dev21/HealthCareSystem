/**
 * nurse-availabilities — a nurse's weekly schedule, time-off and one-day open hours.
 * BE-2 · Phase 2 · FR-SCHED-01 · BR-03 §2.5. Contract: docs/api/nurse-availabilities.api.md
 *
 *  - GET  returns the stored schedule + the nurse's confirmed / in-progress shifts (read-only).
 *  - PUT  replaces the WHOLE schedule in ONE transaction (lock nurse row → validate → check
 *         nothing a confirmed shift relies on is removed → delete → insert). All or nothing.
 *  - Effective availability (minus bookings ± 60-min buffer) is NOT computed here:
 *    availability-engine owns it, for search and matching alike.
 */
import { AvailabilityType } from '@healthcare-system/shared';
import { query, withTransaction, type DbClient, type Queryable } from '../../core/database';
import { AppError, forbidden } from '../../core/errors';
import { vnClock, vnDate } from '../availability-engine/availability-engine.policy';
import type { ScheduleRow } from '../availability-engine/availability-engine.types';
import { todayInVietnam } from '../nurse-onboarding/nurse-onboarding.service';
import { findLockedBooking, toScheduleRows } from './nurse-availabilities.policy';
import * as repo from './nurse-availabilities.repo';
import type { PutAvailabilitiesBody } from './nurse-availabilities.schema';
import type { AvailabilityRowDb, AvailabilityView, CalendarBookingRowDb, DateWindowDto } from './nurse-availabilities.types';

/** How far ahead the calendar shows shifts (the N13 board shows ~2 months). */
export const CALENDAR_DAYS_AHEAD = 92;
const DAY_MS = 86_400_000;

export interface NurseAvailabilitiesDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  now?: () => number;
}

function toEngineRow(r: AvailabilityRowDb): ScheduleRow {
  return {
    availabilityType: r.availability_type as AvailabilityType,
    dayOfWeek: r.day_of_week === null ? null : Number(r.day_of_week),
    specificDate: r.specific_date,
    startTime: r.start_time,
    endTime: r.end_time,
  };
}

function toView(rows: AvailabilityRowDb[], bookings: CalendarBookingRowDb[]): AvailabilityView {
  const dated = (type: AvailabilityType): DateWindowDto[] =>
    rows
      .filter((r) => r.availability_type === type)
      .map((r) => ({ id: r.id, specificDate: r.specific_date!, startTime: r.start_time, endTime: r.end_time }));
  return {
    recurringWindows: rows
      .filter((r) => r.availability_type === AvailabilityType.RECURRING_AVAILABLE)
      .map((r) => ({ id: r.id, dayOfWeek: Number(r.day_of_week), startTime: r.start_time, endTime: r.end_time })),
    timeOffExceptions: dated(AvailabilityType.TIME_OFF_EXCEPTION),
    dateAvailabilities: dated(AvailabilityType.DATE_AVAILABLE),
    bookings: bookings.map((b) => ({
      id: b.id,
      code: b.booking_code,
      date: vnDate(new Date(b.start_time).getTime()),
      startTime: vnClock(new Date(b.start_time).getTime()),
      endTime: vnClock(new Date(b.end_time).getTime()),
      status: b.execution_status,
      serviceName: b.service_name,
    })),
  };
}

export class NurseAvailabilitiesService {
  constructor(private readonly deps: NurseAvailabilitiesDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private calendarBookings(db: Queryable, nurseId: string): Promise<CalendarBookingRowDb[]> {
    const now = this.nowMs();
    return repo.listCalendarBookings(db, nurseId, new Date(now), new Date(now + CALENDAR_DAYS_AHEAD * DAY_MS));
  }

  /** GET /nurse/availabilities */
  async getSchedule(nurseId: string): Promise<AvailabilityView> {
    if (!(await repo.nurseProfileExists(this.deps.read, nurseId))) {
      throw forbidden('NURSE_PROFILE_REQUIRED', 'Complete nurse onboarding before setting a schedule');
    }
    const [rows, bookings] = await Promise.all([
      repo.listRows(this.deps.read, nurseId),
      this.calendarBookings(this.deps.read, nurseId),
    ]);
    return toView(rows, bookings);
  }

  /** PUT /nurse/availabilities — replaces the whole schedule atomically. */
  async replaceSchedule(nurseId: string, body: PutAvailabilitiesBody): Promise<AvailabilityView> {
    const now = this.nowMs();
    const today = todayInVietnam(now);

    // Overlapping windows are allowed: the engine merges them (e.g. Fri 20:00–06:00 + Sat all day).
    const newRows = toScheduleRows(body, today);

    return this.deps.withTx(async (db) => {
      if (!(await repo.lockNurseProfile(db, nurseId))) {
        throw forbidden('NURSE_PROFILE_REQUIRED', 'Complete nurse onboarding before setting a schedule');
      }
      const oldRows = (await repo.listRows(db, nurseId)).map(toEngineRow);
      const bookings = await this.calendarBookings(db, nurseId);

      const locked = findLockedBooking(
        oldRows,
        newRows,
        bookings.map((b) => ({ ...b, start: new Date(b.start_time), end: new Date(b.end_time) })),
        now,
      );
      if (locked) {
        throw new AppError(
          409,
          'AVAILABILITY_LOCKED',
          // Shown as-is on board N13 (same text as FE-2's mock).
          `Khung giờ đã có ca ${locked.booking_code} nên không thể xóa hoặc sửa.`,
          {
            bookingId: locked.id,
            bookingCode: locked.booking_code,
            date: vnDate(locked.start.getTime()),
            startTime: vnClock(locked.start.getTime()),
            endTime: vnClock(locked.end.getTime()),
          },
        );
      }

      await repo.deleteAllRows(db, nurseId);
      await repo.insertRows(db, nurseId, newRows);
      return toView(await repo.listRows(db, nurseId), bookings);
    });
  }
}

let singleton: NurseAvailabilitiesService | null = null;

export function getNurseAvailabilitiesService(): NurseAvailabilitiesService {
  if (!singleton) {
    singleton = new NurseAvailabilitiesService({
      read: { query },
      withTx: (fn) => withTransaction((client: DbClient) => fn(client)),
    });
  }
  return singleton;
}
