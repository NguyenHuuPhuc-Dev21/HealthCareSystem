import { describe, expect, it } from 'vitest';
import { ExecutionStatus, ProfileStatus, UserRole } from '@healthcare-system/shared';
import {
  blindPeriodOver,
  clampScore,
  earnsRecovery,
  reviewDeadline,
  reviewerRole,
  submitProblem,
  suspendsNurse,
} from '../../src/modules/reviews-trustscore/reviews-trustscore.policy';
import { submitReviewSchema } from '../../src/modules/reviews-trustscore/reviews-trustscore.schema';

/** reviews-trustscore policy (FR-RATE-01) — pure rules and boundaries. */
describe('reviews-trustscore — policy (unit)', () => {
  const DAY = 86_400_000;
  const done = Date.UTC(2027, 0, 10, 6, 0, 0);
  const booking = { customer_id: 'c1', nurse_id: 'n1' };

  it('only the booking\'s own customer or nurse can review it', () => {
    expect(reviewerRole(booking, { id: 'c1', role: UserRole.PATIENT })).toBe('PATIENT');
    expect(reviewerRole(booking, { id: 'n1', role: UserRole.NURSE })).toBe('NURSE');
    expect(reviewerRole(booking, { id: 'c2', role: UserRole.PATIENT })).toBeNull();
    expect(reviewerRole(booking, { id: 'n2', role: UserRole.NURSE })).toBeNull();
    expect(reviewerRole(booking, { id: 'c1', role: UserRole.ADMIN })).toBeNull();
    expect(reviewerRole({ customer_id: 'c1', nurse_id: null }, { id: 'n1', role: UserRole.NURSE })).toBeNull();
  });

  it('reviews open at COMPLETED and close exactly windowDays after the shift', () => {
    expect(submitProblem(ExecutionStatus.IN_PROGRESS, done, done + 1, 7)).toBe('BOOKING_NOT_COMPLETED');
    expect(submitProblem(ExecutionStatus.CANCELLED, done, done + 1, 7)).toBe('BOOKING_NOT_COMPLETED');
    expect(submitProblem(ExecutionStatus.COMPLETED, done, done, 7)).toBeNull();
    expect(submitProblem(ExecutionStatus.COMPLETED, done, done + 7 * DAY - 1, 7)).toBeNull();
    expect(submitProblem(ExecutionStatus.COMPLETED, done, done + 7 * DAY, 7)).toBe('REVIEW_WINDOW_CLOSED');
    expect(reviewDeadline(done, 7).getTime()).toBe(done + 7 * DAY);
  });

  it('the blind period ends exactly blindDays after the shift', () => {
    expect(blindPeriodOver(done, done + 7 * DAY - 1, 7)).toBe(false);
    expect(blindPeriodOver(done, done + 7 * DAY, 7)).toBe(true);
  });

  it('keeps the score within 0..100 and reports what really changed', () => {
    expect(clampScore(100, 2)).toEqual({ after: 100, applied: 0 });
    expect(clampScore(99, 2)).toEqual({ after: 100, applied: 1 });
    expect(clampScore(80, -20)).toEqual({ after: 60, applied: -20 });
    expect(clampScore(10, -25)).toEqual({ after: 0, applied: -10 });
  });

  it('suspends only an ACTIVE nurse that falls BELOW the threshold (60 stays)', () => {
    expect(suspendsNurse(ProfileStatus.ACTIVE, 60, 60)).toBe(false);
    expect(suspendsNurse(ProfileStatus.ACTIVE, 59, 60)).toBe(true);
    expect(suspendsNurse(ProfileStatus.SUSPENDED, 10, 60)).toBe(false);
    expect(suspendsNurse(ProfileStatus.PENDING_VERIFICATION, 10, 60)).toBe(false);
  });

  it('recovery: customer ratings of at least minStars only', () => {
    expect(earnsRecovery('PATIENT', 4, 4)).toBe(true);
    expect(earnsRecovery('PATIENT', 5, 4)).toBe(true);
    expect(earnsRecovery('PATIENT', 3, 4)).toBe(false);
    expect(earnsRecovery('NURSE', 5, 4)).toBe(false);
  });

  it('validates the body strictly', () => {
    expect(submitReviewSchema.safeParse({ rating: 5 }).success).toBe(true);
    expect(submitReviewSchema.safeParse({ rating: 4, comment: 'Tốt', tags: ['Đúng giờ'] }).success).toBe(true);
    expect(submitReviewSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(submitReviewSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(submitReviewSchema.safeParse({ rating: 4.5 }).success).toBe(false);
    expect(submitReviewSchema.safeParse({ rating: 5, comment: 'x'.repeat(501) }).success).toBe(false);
    expect(submitReviewSchema.safeParse({ rating: 5, isVisible: true }).success).toBe(false);
  });
});
