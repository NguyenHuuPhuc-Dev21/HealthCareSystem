/**
 * reviews-trustscore — two-way blind reviews and the nurse TrustScore (BE-1 / Dev A, Phase 6).
 * Traceability: FR-RATE-01 · BR-18 §2.5 · BR-02 · SRS §4.6, §5.2 rows 6–7 · FR-SEARCH-01 (cached rating)
 *
 *  Reviews
 *   - Open when the booking is COMPLETED; close REVIEW_WINDOW_DAYS after the shift ended (check-out, else
 *     the scheduled end). One review per side; nobody edits or deletes a review.
 *   - Blind: a review stays hidden until BOTH sides have reviewed, or REVIEW_BLIND_DAYS after the shift
 *     (hourly job `reviews-trustscore.reveal-sweep`). Revealing is the only place `is_visible` changes.
 *   - On reveal: the nurse's cached rating_avg is recalculated, and a customer rating ≥ TRUST_RECOVERY_MIN_STARS
 *     gives the nurse +TRUST_RECOVERY_GOOD_RATING (once per booking, capped at 100).
 *
 *  TrustScore — `applyTrustScoreChange` is the ONLY writer of nurse_profiles.trust_score.
 *   - Other modules call it inside their own transaction: nurse cancel (−5 / −20, cancellation-policy),
 *     upheld dispute (−25, disputes — BE-3), Admin adjustment (admin, Phase 7).
 *   - Clamped to 0..100; one event per (nurse, reason, booking): a retry never applies twice.
 *   - Falling below TRUST_SUSPEND_BELOW suspends an ACTIVE nurse. Nothing re-activates automatically:
 *     the Admin lifts a suspension by hand.
 */
import { UserRole, type SystemConfigKey } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, conflict, forbidden, notFound } from '../../core/errors';
import { blindPeriodOver, clampScore, earnsRecovery, reviewDeadline, reviewerRole, submitProblem, suspendsNurse } from './reviews-trustscore.policy';
import * as repo from './reviews-trustscore.repo';
import type { SubmitReviewBody } from './reviews-trustscore.schema';
import type {
  PendingReviewDto,
  ReceivedReviewDto,
  ReviewRules,
  SentReviewDto,
  SubmitReviewResult,
  TrustScoreChange,
  TrustScoreDto,
  TrustScoreResult,
} from './reviews-trustscore.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;
const LIST_LIMIT = 100;
const SWEEP_BATCH = 200;

const SUBMIT_MESSAGES = {
  BOOKING_NOT_COMPLETED: 'Reviews open once the shift is completed',
  REVIEW_WINDOW_CLOSED: 'The time to review this shift is over',
} as const;

const notFoundBooking = () => notFound('BOOKING_NOT_FOUND', 'Booking not found');

/** Reads the rules from system_configs. */
export async function loadReviewRules(getNumber: (k: SystemConfigKey) => Promise<number>): Promise<ReviewRules> {
  const [blindDays, windowDays, recoveryPoints, recoveryMinStars, suspendBelow] = await Promise.all([
    getNumber('REVIEW_BLIND_DAYS'),
    getNumber('REVIEW_WINDOW_DAYS'),
    getNumber('TRUST_RECOVERY_GOOD_RATING'),
    getNumber('TRUST_RECOVERY_MIN_STARS'),
    getNumber('TRUST_SUSPEND_BELOW'),
  ]);
  return { blindDays, windowDays, recoveryPoints, recoveryMinStars, suspendBelow };
}

/**
 * Changes a nurse's TrustScore. Call it with the caller's TRANSACTION client.
 * Locks the nurse_profiles row; idempotent per (nurse, reason, booking) when `bookingId` is given.
 * `suspendBelow` comes from TRUST_SUSPEND_BELOW (read it with getConfigNumber if you have no rules at hand).
 */
export async function applyTrustScoreChange(db: Queryable, change: TrustScoreChange, suspendBelow: number): Promise<TrustScoreResult> {
  const nurse = await repo.lockNurseScore(db, change.nurseId);
  if (!nurse) return { applied: false, scoreBefore: 0, scoreAfter: 0, suspended: false };
  const before = nurse.trust_score;
  const bookingId = change.bookingId ?? null;
  if (bookingId && (await repo.trustEventExists(db, change.nurseId, change.reason, bookingId))) {
    return { applied: false, scoreBefore: before, scoreAfter: before, suspended: false };
  }
  const { after, applied } = clampScore(before, change.delta);
  const suspended = suspendsNurse(nurse.profile_status, after, suspendBelow);
  await repo.insertTrustEvent(db, {
    nurseId: change.nurseId,
    reason: change.reason,
    requested: change.delta,
    applied,
    before,
    after,
    bookingId,
    note: change.note ?? null,
    actorId: change.actorId ?? null,
  });
  await repo.updateNurseScore(db, change.nurseId, after, suspended);
  return { applied: true, scoreBefore: before, scoreAfter: after, suspended };
}

/**
 * Makes the booking's hidden reviews visible, then updates what depends on them.
 * Call it in a transaction that holds the booking row lock. Returns how many reviews became visible.
 */
export async function revealBooking(db: Queryable, bookingId: string, rules: ReviewRules): Promise<number> {
  const revealed = await repo.revealReviews(db, bookingId);
  for (const r of revealed) {
    if (r.reviewer_role !== 'PATIENT') continue;
    await repo.recalculateNurseRatingAvg(db, r.reviewee_id);
    if (earnsRecovery(r.reviewer_role, r.rating, rules.recoveryMinStars)) {
      await applyTrustScoreChange(
        db,
        { nurseId: r.reviewee_id, delta: rules.recoveryPoints, reason: 'GOOD_RATING_RECOVERY', bookingId },
        rules.suspendBelow,
      );
    }
  }
  return revealed.length;
}

export interface ReviewsDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  now?: () => number;
}

interface Viewer {
  id: string;
  role: UserRole;
}

export class ReviewsService {
  constructor(private readonly deps: ReviewsDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private rules(): Promise<ReviewRules> {
    return loadReviewRules(this.deps.getNumber);
  }

  /** POST /bookings/:id/reviews — the customer or the nurse of the booking. */
  async submit(viewer: Viewer, bookingId: string, body: SubmitReviewBody): Promise<SubmitReviewResult> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    const rules = await this.rules();
    const nowMs = this.nowMs();
    return this.deps.withTx(async (db) => {
      const b = await repo.lockReviewBooking(db, bookingId);
      const role = b ? reviewerRole(b, viewer) : null;
      if (!b || !role) throw notFoundBooking();
      const problem = submitProblem(b.execution_status, new Date(b.completed_at).getTime(), nowMs, rules.windowDays);
      if (problem) throw new AppError(422, problem, SUBMIT_MESSAGES[problem]);
      const revieweeId = role === 'PATIENT' ? b.nurse_id! : b.customer_id;

      let reviewId: string;
      try {
        reviewId = await repo.insertReview(db, {
          bookingId,
          reviewerId: viewer.id,
          revieweeId,
          role,
          rating: body.rating,
          comment: body.comment ? body.comment : null,
          tags: body.tags ?? [],
        });
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw conflict('ALREADY_REVIEWED', 'You have already reviewed this shift');
        throw e;
      }

      // Both sides in → reveal now (no need to wait the blind period).
      let isVisible = false;
      if ((await repo.countReviewers(db, bookingId)) >= 2) {
        await revealBooking(db, bookingId, rules);
        isVisible = true;
      }
      return { review_id: reviewId, isVisible };
    });
  }

  /** GET /nurse/reviews/pending — shifts the nurse can still review. */
  async pendingForNurse(nurseId: string): Promise<PendingReviewDto[]> {
    const { windowDays } = await this.rules();
    const since = new Date(this.nowMs() - windowDays * DAY_MS);
    const rows = await repo.listPendingForNurse(this.deps.read, nurseId, since);
    return rows.map((r) => {
      const completed = new Date(r.completed_at);
      return {
        bookingId: r.booking_id,
        bookingCode: r.booking_code,
        customerName: r.customer_name,
        completedAt: completed.toISOString(),
        expiresAt: reviewDeadline(completed.getTime(), windowDays).toISOString(),
      };
    });
  }

  /** GET /nurse/reviews/sent */
  async sentBy(reviewerId: string): Promise<SentReviewDto[]> {
    const rows = await repo.listSentByReviewer(this.deps.read, reviewerId, LIST_LIMIT);
    return rows.map((r) => ({
      id: r.id,
      bookingCode: r.booking_code,
      customerName: r.customer_name,
      rating: r.rating,
      ...(r.comment ? { comment: r.comment } : {}),
      ...(r.tags && r.tags.length ? { tags: r.tags } : {}),
      isVisible: r.is_visible,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  /** GET /nurse/reviews/received — visible reviews only (blind ones never leave the server). */
  async receivedBy(revieweeId: string): Promise<ReceivedReviewDto[]> {
    const rows = await repo.listReceivedVisible(this.deps.read, revieweeId, LIST_LIMIT);
    return rows.map((r) => ({
      id: r.id,
      bookingCode: r.booking_code,
      customerName: r.customer_name,
      rating: r.rating,
      ...(r.comment ? { comment: r.comment } : {}),
      isVisible: true,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  /** GET /nurse/trust-score */
  async trustScore(nurseId: string): Promise<TrustScoreDto> {
    const profile = await repo.getNurseScore(this.deps.read, nurseId);
    if (!profile) throw forbidden('NURSE_PROFILE_REQUIRED', 'Nurse profile not found');
    const [dist, history] = await Promise.all([
      repo.ratingDistribution(this.deps.read, nurseId),
      repo.listTrustHistory(this.deps.read, nurseId, LIST_LIMIT),
    ]);
    const ratingCount = dist[1]! + dist[2]! + dist[3]! + dist[4]! + dist[5]!;
    return {
      score: profile.trust_score,
      ratingAvg: ratingCount ? Number(profile.rating_avg) : null,
      ratingCount,
      ratingDistribution: { star5: dist[5]!, star4: dist[4]!, star3: dist[3]!, star2: dist[2]!, star1: dist[1]! },
      history: history.map((h) => ({
        id: h.id,
        delta: h.applied_delta,
        reason: h.reason,
        ...(h.booking_code ? { bookingCode: h.booking_code } : {}),
        ...(h.note ? { note: h.note } : {}),
        createdAt: new Date(h.created_at).toISOString(),
      })),
    };
  }

  /**
   * Reveal sweep: every booking whose blind period is over. Each booking is its own transaction
   * (under its row lock), so one failure does not undo the others; throws at the end if any failed.
   */
  async revealSweep(): Promise<{ bookings: number; reviews: number }> {
    const rules = await this.rules();
    const nowMs = this.nowMs();
    const cutoff = new Date(nowMs - rules.blindDays * DAY_MS);
    const ids = await repo.findBlindExpired(this.deps.read, cutoff, SWEEP_BATCH);
    let bookings = 0;
    let reviews = 0;
    const failures: string[] = [];
    for (const id of ids) {
      try {
        const n = await this.deps.withTx(async (db) => {
          const b = await repo.lockReviewBooking(db, id);
          if (!b || !blindPeriodOver(new Date(b.completed_at).getTime(), nowMs, rules.blindDays)) return 0;
          return revealBooking(db, id, rules);
        });
        if (n > 0) bookings += 1;
        reviews += n;
      } catch (e) {
        failures.push(`${id}: ${(e as Error).message}`);
      }
    }
    if (failures.length) throw new Error(`reveal-sweep failed for ${failures.length} booking(s): ${failures.join('; ')}`);
    return { bookings, reviews };
  }
}


let singleton: ReviewsService | null = null;

export function getReviewsService(): ReviewsService {
  if (!singleton) {
    singleton = new ReviewsService({
      read: getPool(),
      withTx: (fn) => withTransaction((client) => fn(client)),
      getNumber: getConfigNumber,
    });
  }
  return singleton;
}
