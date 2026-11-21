/**
 * Types for availability-engine (BE-2 · Phase 2 · FR-SCHED-01, BR-03 §2.5, BR-14 §2.5).
 */
import type { AvailabilityType } from '@healthcare-system/shared';

/** A nurse_availabilities row as the engine reads it (times 'HH:MM', Vietnam local). */
export interface ScheduleRow {
  availabilityType: AvailabilityType;
  dayOfWeek: number | null; // 0 = Sunday … 6 = Saturday
  specificDate: string | null; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM — end <= start means the window runs past midnight
}

/** Half-open time interval [start, end) in epoch milliseconds (absolute, UTC). */
export interface Interval {
  start: number;
  end: number;
}

/** A CONFIRMED / IN_PROGRESS booking that occupies the nurse. */
export interface BusyBooking {
  id: string;
  start: Date;
  end: Date;
}

export interface Slot {
  start: Date;
  end: Date;
}

/** Why a nurse cannot take a slot, checked in this order. */
export type UnavailableReason =
  | 'NO_DECLARED_AVAILABILITY' // the declared schedule does not cover the slot
  | 'TIME_OFF' // covered by the schedule, but a time-off exception cuts into it
  | 'BOOKING_CONFLICT' // overlaps a CONFIRMED / IN_PROGRESS booking
  | 'TRAVEL_BUFFER'; // closer than the travel buffer (60 min) to such a booking

export type AvailabilityCheck = { available: true } | { available: false; reason: UnavailableReason };

/** Everything the pure engine needs for one nurse. */
export interface NurseSchedule {
  rows: ScheduleRow[];
  busy: BusyBooking[];
}

export interface EngineOptions {
  /** Travel buffer in minutes; read from system_configs TRAVEL_BUFFER_MINUTES when omitted. */
  bufferMinutes?: number;
  /** Booking to ignore as "busy" (e.g. the booking being re-matched or extended). */
  ignoreBookingId?: string;
}
