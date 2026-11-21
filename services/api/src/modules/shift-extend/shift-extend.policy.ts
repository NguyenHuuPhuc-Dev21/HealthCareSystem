/**
 * shift-extend policy (FR-SHIFT-03, BR-15 §2.3). PURE: no DB, no clock, no config — every boundary is unit-testable.
 */
import { ExecutionStatus, ServiceUnit } from '@healthcare-system/shared';
import type { AdjustmentStatus, BusyRow, ExtensionViewStatus } from './shift-extend.types';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export type RequestProblem = 'BOOKING_NOT_IN_PROGRESS' | 'EXTENSION_WINDOW_CLOSED' | 'INVALID_EXTENSION_HOURS';

/**
 * Can the customer ask for `hours` more right now?
 *  - the shift is running (IN_PROGRESS);
 *  - now ≤ scheduled end − deadlineMinutes (SRS: "at least 30 minutes before the end");
 *  - 1 ≤ hours ≤ maxHours, whole hours.
 */
export function requestProblem(
  executionStatus: ExecutionStatus,
  hours: number,
  nowMs: number,
  endMs: number,
  deadlineMinutes: number,
  maxHours: number,
): RequestProblem | null {
  if (executionStatus !== ExecutionStatus.IN_PROGRESS) return 'BOOKING_NOT_IN_PROGRESS';
  if (nowMs > endMs - deadlineMinutes * MINUTE_MS) return 'EXTENSION_WINDOW_CLOSED';
  if (!Number.isInteger(hours) || hours < 1 || hours > maxHours) return 'INVALID_EXTENSION_HOURS';
  return null;
}

/**
 * Price of ONE extra hour, from the service catalogue:
 *  - PER_HOUR: the catalogue price per hour;
 *  - PER_SHIFT / PER_TIME: the price of the visit spread over its booked length (pro rata),
 *    so an extra hour costs what an hour of this visit costs. `bookedHours` excludes earlier extensions.
 */
export function hourlyRate(unit: ServiceUnit, basePrice: number, bookedHours: number): number {
  if (unit === ServiceUnit.PER_HOUR) return basePrice;
  if (!(bookedHours > 0)) throw new RangeError('bookedHours must be positive');
  return Math.round(basePrice / bookedHours);
}

/**
 * Would [from, to) — the extension — collide with another shift of the nurse, including the travel buffer
 * before the next one? `busy` = her other CONFIRMED / IN_PROGRESS bookings (this booking excluded).
 */
export function nextShiftConflict(busy: BusyRow[], fromMs: number, toMs: number, bufferMinutes: number): boolean {
  const end = toMs + bufferMinutes * MINUTE_MS;
  return busy.some((b) => new Date(b.start_time).getTime() < end && new Date(b.end_time).getTime() > fromMs);
}

/** Status shown to the apps. */
export function viewStatus(status: AdjustmentStatus, appliedAt: Date | null): ExtensionViewStatus {
  switch (status) {
    case 'REQUESTED':
      return 'AWAITING_NURSE';
    case 'ACCEPTED':
      return appliedAt ? 'CONFIRMED' : 'AWAITING_PAYMENT';
    case 'PAID':
      return 'CONFIRMED';
    case 'REJECTED':
      return 'DECLINED';
    case 'EXPIRED':
      return 'EXPIRED';
  }
}

/** Transfer content / gateway orderCode of the n-th extension of a booking. */
export function extensionPaymentCode(bookingCode: string, seq: number): string {
  return `${bookingCode}-GH${seq}`;
}

/** True for an orderCode that belongs to an extension (gateway-webhooks routes it to confirmExtensionPayment). */
export function isExtensionPaymentCode(orderCode: string): boolean {
  return /-GH\d+$/.test(orderCode);
}

export const hoursToMs = (hours: number) => hours * HOUR_MS;
