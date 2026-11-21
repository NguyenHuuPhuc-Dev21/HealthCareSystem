/**
 * prescription-gate policy (FR-BOOK-02, BR-15). PURE functions: no DB, no clock, no config —
 * the caller passes "today" and PRESCRIPTION_MAX_AGE_DAYS, so every boundary is unit-testable.
 */
import { ExecutionStatus } from '@healthcare-system/shared';
import type { CandidateDenial, CandidateFacts, PrescriptionProblem } from './prescription-gate.types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Epoch ms of a YYYY-MM-DD calendar date, or null when it is not a real date. */
function dateOnlyMs(value: string): number | null {
  if (!ISO_DATE.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value ? null : ms;
}

/**
 * Layer 1. Returns the first problem, or null when the booking may go on.
 *  - non-invasive service: nothing is required (and the caller stores nothing);
 *  - invasive service: image + issue date are mandatory, the date is a real date, not in the
 *    future, and at most `maxAgeDays` days before `today` (issued exactly maxAgeDays ago = valid).
 *
 * @param today YYYY-MM-DD in Vietnam time — the day the booking is created.
 */
export function checkPrescription(
  input: { isInvasive: boolean; imageKey?: string | null; issuedDate?: string | null },
  today: string,
  maxAgeDays: number,
): PrescriptionProblem | null {
  if (!input.isInvasive) return null;
  if (!input.imageKey || !input.issuedDate) return 'PRESCRIPTION_REQUIRED';

  const issued = dateOnlyMs(input.issuedDate);
  const now = dateOnlyMs(today);
  if (issued === null || now === null) return 'INVALID_PRESCRIPTION_DATE';
  if (issued > now) return 'PRESCRIPTION_DATE_IN_FUTURE';
  if ((now - issued) / DAY_MS > maxAgeDays) return 'PRESCRIPTION_TOO_OLD';
  return null;
}

/**
 * Layer 2, before acceptance: a nurse who is NOT (yet) assigned may open the prescription only
 * while the booking is still looking for a nurse, she holds a live offer for it, and she is a
 * Tier 2 nurse with a valid GPHN. Returns the reason for refusal, or null when allowed.
 */
export function candidateDenial(executionStatus: ExecutionStatus, facts: CandidateFacts): CandidateDenial | null {
  if (executionStatus !== ExecutionStatus.MATCHING) return 'BOOKING_NOT_OPEN';
  if (!facts.hasOpenOffer) return 'NOT_OFFERED';
  if (!facts.tier2Valid) return 'TIER_2_REQUIRED';
  return null;
}
