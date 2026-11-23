/**
 * reviews-trustscore policy (FR-RATE-01). PURE: no DB, no clock, no config — boundaries are unit-testable.
 */
import { ExecutionStatus, ProfileStatus, UserRole } from '@healthcare-system/shared';
import type { ReviewerRole } from './reviews-trustscore.types';

const DAY_MS = 86_400_000;
export const TRUST_SCORE_MIN = 0; // schema CHECK (trust_score BETWEEN 0 AND 100)
export const TRUST_SCORE_MAX = 100;

/** Who is reviewing this booking: its customer, its nurse, or nobody allowed. */
export function reviewerRole(
  b: { customer_id: string; nurse_id: string | null },
  user: { id: string; role: UserRole },
): ReviewerRole | null {
  if (user.role === UserRole.PATIENT && b.customer_id === user.id) return 'PATIENT';
  if (user.role === UserRole.NURSE && b.nurse_id === user.id) return 'NURSE';
  return null;
}

export type SubmitProblem = 'BOOKING_NOT_COMPLETED' | 'REVIEW_WINDOW_CLOSED';

/** Reviews open when the booking is COMPLETED (not at settlement) and close windowDays after the shift ended. */
export function submitProblem(status: ExecutionStatus, completedMs: number, nowMs: number, windowDays: number): SubmitProblem | null {
  if (status !== ExecutionStatus.COMPLETED) return 'BOOKING_NOT_COMPLETED';
  if (nowMs >= completedMs + windowDays * DAY_MS) return 'REVIEW_WINDOW_CLOSED';
  return null;
}

/** End of the review window. */
export function reviewDeadline(completedMs: number, windowDays: number): Date {
  return new Date(completedMs + windowDays * DAY_MS);
}

/** Hidden reviews of a booking become visible once this is true (or as soon as both sides reviewed). */
export function blindPeriodOver(completedMs: number, nowMs: number, blindDays: number): boolean {
  return nowMs >= completedMs + blindDays * DAY_MS;
}

/** New score kept within 0..100; `applied` is what really changed. */
export function clampScore(before: number, delta: number): { after: number; applied: number } {
  const after = Math.min(TRUST_SCORE_MAX, Math.max(TRUST_SCORE_MIN, before + delta));
  return { after, applied: after - before };
}

/** An ACTIVE nurse falling below the threshold is suspended (never re-activated automatically). */
export function suspendsNurse(status: ProfileStatus, after: number, suspendBelow: number): boolean {
  return status === ProfileStatus.ACTIVE && after < suspendBelow;
}

/** A customer rating that earns the recovery points. */
export function earnsRecovery(reviewerRole: ReviewerRole, rating: number, minStars: number): boolean {
  return reviewerRole === 'PATIENT' && rating >= minStars;
}
