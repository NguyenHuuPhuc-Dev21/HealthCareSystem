/**
 * DTOs for nurse-availabilities (BE-2 · Phase 2 · FR-SCHED-01). Contract: docs/api/nurse-availabilities.api.md
 * Shapes match apps/nurse-web/src/features/availabilities (FE-2, board N13).
 */

/** Weekly window. endTime <= startTime = runs past midnight (e.g. 19:00–06:00). */
export interface RecurringWindowDto {
  id: string;
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday
  startTime: string; // HH:MM, Vietnam local
  endTime: string;
}

/** A window on one date: a time-off exception, or open hours that replace that weekday's windows. */
export interface DateWindowDto {
  id: string;
  specificDate: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
}

/** A confirmed / in-progress shift shown read-only on the calendar. */
export interface CalendarBookingDto {
  id: string;
  code: string;
  date: string; // Vietnam date of the start
  startTime: string; // HH:MM Vietnam
  endTime: string; // HH:MM Vietnam — endTime <= startTime = ends the next day
  status: 'CONFIRMED' | 'IN_PROGRESS'; // ExecutionStatus values (packages/shared)
  serviceName: string;
}

export interface AvailabilityView {
  recurringWindows: RecurringWindowDto[];
  timeOffExceptions: DateWindowDto[];
  dateAvailabilities: DateWindowDto[];
  bookings: CalendarBookingDto[];
}

/** Row of nurse_availabilities as this module reads it. */
export type AvailabilityRowDb = {
  id: string;
  availability_type: string;
  day_of_week: number | null;
  specific_date: string | null;
  start_time: string; // HH24:MI
  end_time: string;
};

export type CalendarBookingRowDb = {
  id: string;
  booking_code: string;
  start_time: Date;
  end_time: Date;
  execution_status: 'CONFIRMED' | 'IN_PROGRESS';
  service_name: string;
};
