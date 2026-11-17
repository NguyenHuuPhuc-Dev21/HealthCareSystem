/**
 * bookings policy — PURE rules (no DB, no clock). BE-2 · Phase 3 · FR-BOOK-01/02, BR-03 §2.1, BR-14 §2.3.
 */
import {
  PRESCRIPTION_MAX_AGE_DAYS,
  SHIFT_DURATION_HOURS,
  ServiceUnit,
  TASK_MAX_DURATION_HOURS,
} from '@healthcare-system/shared';
import { addDays } from '../availability-engine/availability-engine.policy';

const HOUR_MS = 3_600_000;

export type SlotProblem = 'START_IN_PAST' | 'END_BEFORE_START' | 'INVALID_DURATION';

/**
 * Bookable slot rules:
 *  - starts in the future;
 *  - shift services (PER_HOUR / PER_SHIFT): exactly 4, 8, 12 or 24 hours (BR-03 §2.1);
 *  - task-based services (PER_TIME): one visit of at most TASK_MAX_DURATION_HOURS.
 */
export function slotProblem(unit: ServiceUnit, start: Date, end: Date, nowMs: number): SlotProblem | null {
  const s = start.getTime();
  const e = end.getTime();
  if (e <= s) return 'END_BEFORE_START';
  if (s <= nowMs) return 'START_IN_PAST';
  const hours = (e - s) / HOUR_MS;
  if (unit === ServiceUnit.PER_TIME) return hours <= TASK_MAX_DURATION_HOURS ? null : 'INVALID_DURATION';
  return (SHIFT_DURATION_HOURS as readonly number[]).includes(hours) ? null : 'INVALID_DURATION';
}

export type PrescriptionProblem = 'PRESCRIPTION_REQUIRED' | 'PRESCRIPTION_DATE_IN_FUTURE' | 'PRESCRIPTION_EXPIRED';

/**
 * FR-BOOK-02 layer 1 (date part): an invasive service needs a medical order issued within the last
 * 7 days (Vietnam dates, today included). Non-invasive services need none.
 */
export function prescriptionProblem(
  isInvasive: boolean,
  prescription: { imageKey: string; issuedDate: string } | undefined,
  today: string,
): PrescriptionProblem | null {
  if (!isInvasive) return null;
  if (!prescription) return 'PRESCRIPTION_REQUIRED';
  if (prescription.issuedDate > today) return 'PRESCRIPTION_DATE_IN_FUTURE';
  if (prescription.issuedDate < addDays(today, -PRESCRIPTION_MAX_AGE_DAYS)) return 'PRESCRIPTION_EXPIRED';
  return null;
}

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I

/** HC-YYMMDD-XXXXXX (Vietnam date + 6 random characters). Uniqueness is enforced by the DB. */
export function buildBookingCode(today: string, randomBytes: Uint8Array): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += CODE_ALPHABET[randomBytes[i] % CODE_ALPHABET.length];
  return `HC-${today.slice(2).replace(/-/g, '')}-${suffix}`;
}
