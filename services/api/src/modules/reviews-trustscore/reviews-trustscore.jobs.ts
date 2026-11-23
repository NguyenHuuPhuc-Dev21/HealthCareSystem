/**
 * reviews-trustscore background job (BE-1 · Phase 6 · FR-RATE-01) — on the shared job queue.
 *
 *   reviews-trustscore.reveal-sweep · hourly at :07 Asia/Ho_Chi_Minh
 *   Reveals the reviews of every booking whose blind period (REVIEW_BLIND_DAYS after the shift) is over,
 *   then recalculates rating_avg and applies the good-rating recovery. Idempotent: revealed reviews are
 *   no longer hidden, and the recovery is once per booking.
 */
import { TIMEZONE_DISPLAY } from '@healthcare-system/shared';
import { getReviewsService, type ReviewsService } from './reviews-trustscore.service';
import type { RecurringRegistry } from './reviews-trustscore.types';

export const REVEAL_SWEEP_JOB = 'reviews-trustscore.reveal-sweep';
export const REVEAL_SWEEP_SCHEDULE = { pattern: '7 * * * *', tz: TIMEZONE_DISPLAY };

export async function registerReviewsTrustScoreJobs(jobs: RecurringRegistry, service: ReviewsService = getReviewsService()): Promise<void> {
  jobs.registerHandler(REVEAL_SWEEP_JOB, async () => {
    const out = await service.revealSweep();
    if (out.reviews) console.log(`[${REVEAL_SWEEP_JOB}] revealed ${out.reviews} review(s) on ${out.bookings} booking(s)`);
  });
  await jobs.scheduleRecurring(REVEAL_SWEEP_JOB, REVEAL_SWEEP_SCHEDULE, REVEAL_SWEEP_JOB);
}
