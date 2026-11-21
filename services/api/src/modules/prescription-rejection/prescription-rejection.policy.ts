/**
 * prescription-rejection policy (FR-BOOK-02 Layer 3, BR-15 §2.2). PURE: no DB, no clock, no config —
 * the caller passes "now" and PRESCRIPTION_REJECTION_WINDOW_MINUTES, so every boundary is unit-testable.
 *
 * The nurse may reject only when ALL hold, checked in this order:
 *   a) she is the booking's assigned nurse                        else NOT_ASSIGNED_NURSE
 *   b) the service is invasive (it has a medical order)           else PRESCRIPTION_NOT_REQUIRED
 *   c) the booking is CONFIRMED or IN_PROGRESS                    else ALREADY_CANCELLED / BOOKING_NOT_ACTIVE
 *   d) now ≥ start − windowMinutes (she is about to be on site)   else TOO_EARLY_TO_REJECT
 *   e) now < scheduled end                                        else SHIFT_ALREADY_ENDED
 */
import { ExecutionStatus } from '@healthcare-system/shared';
import type { RejectionFacts, RejectionProblem } from './prescription-rejection.types';

const MINUTE_MS = 60_000;
const ACTIVE: ReadonlySet<string> = new Set([ExecutionStatus.CONFIRMED, ExecutionStatus.IN_PROGRESS]);

export function rejectionProblem(
  facts: RejectionFacts,
  nurseId: string,
  nowMs: number,
  windowMinutes: number,
): RejectionProblem | null {
  if (!facts.nurseId || facts.nurseId !== nurseId) return 'NOT_ASSIGNED_NURSE';
  if (!facts.isInvasive) return 'PRESCRIPTION_NOT_REQUIRED';
  if (facts.executionStatus === ExecutionStatus.CANCELLED) return 'ALREADY_CANCELLED';
  if (!ACTIVE.has(facts.executionStatus)) return 'BOOKING_NOT_ACTIVE';
  if (nowMs < facts.startMs - windowMinutes * MINUTE_MS) return 'TOO_EARLY_TO_REJECT';
  if (nowMs >= facts.endMs) return 'SHIFT_ALREADY_ENDED';
  return null;
}

/** When the action opens for this booking (for the TOO_EARLY_TO_REJECT details). */
export function rejectionOpensAt(startMs: number, windowMinutes: number): Date {
  return new Date(startMs - windowMinutes * MINUTE_MS);
}

/** A refund is due only when the platform actually holds the prepayment (cash bookings hold nothing). */
export function refundDue(paymentStatus: string): boolean {
  return paymentStatus === 'ESCROW_HELD';
}
