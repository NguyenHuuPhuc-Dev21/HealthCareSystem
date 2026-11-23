import type { ExecutionStatus, ProfileStatus } from '@healthcare-system/shared';

/** Same names as packages/shared trust-score.contracts TrustScoreReason. */
export type TrustScoreReason =
  | 'CANCEL_OVER_12H' // −5  (SRS §5.2 row 6)
  | 'CANCEL_WITHIN_12H' // −20 (row 7)
  | 'DISPUTE_UPHELD' // −25 (FR-DISP-01)
  | 'GOOD_RATING_RECOVERY' // +2 per shift rated ≥ 4 stars
  | 'ADMIN_ADJUSTMENT';

export type ReviewerRole = 'PATIENT' | 'NURSE';

export interface ReviewRules {
  blindDays: number; // REVIEW_BLIND_DAYS (7)
  windowDays: number; // REVIEW_WINDOW_DAYS (7, proposed)
  recoveryPoints: number; // TRUST_RECOVERY_GOOD_RATING (2)
  recoveryMinStars: number; // TRUST_RECOVERY_MIN_STARS (4)
  suspendBelow: number; // TRUST_SUSPEND_BELOW (60)
}

export interface TrustScoreChange {
  nurseId: string;
  /** Negative for a penalty. */
  delta: number;
  reason: TrustScoreReason;
  /** The booking it is about — makes the change idempotent (once per nurse, reason and booking). */
  bookingId?: string | null;
  note?: string | null;
  /** Admin who made an ADMIN_ADJUSTMENT; null = system. */
  actorId?: string | null;
}

export interface TrustScoreResult {
  /** false when this (nurse, reason, booking) was already applied, or the nurse has no profile. */
  applied: boolean;
  scoreBefore: number;
  scoreAfter: number;
  /** The change suspended the nurse (score fell below TRUST_SUSPEND_BELOW while ACTIVE). */
  suspended: boolean;
}

/** A booking as the review flow reads it. `completed_at` = check-out time, else the scheduled end. */
export type ReviewBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  execution_status: ExecutionStatus;
  completed_at: Date;
};

export type NurseScoreRow = { trust_score: number; profile_status: ProfileStatus };

export type RevealedReviewRow = { reviewer_role: ReviewerRole; reviewee_id: string; rating: number };

export interface SubmitReviewInput {
  rating: number;
  comment?: string;
  tags?: string[];
}

export interface SubmitReviewResult {
  review_id: string;
  /** true when both sides have now reviewed (both become visible at once). */
  isVisible: boolean;
}

export interface PendingReviewDto {
  bookingId: string;
  bookingCode: string;
  customerName: string;
  completedAt: string;
  expiresAt: string;
}

export interface SentReviewDto {
  id: string;
  bookingCode: string;
  customerName: string;
  rating: number;
  comment?: string;
  tags?: string[];
  isVisible: boolean;
  createdAt: string;
}

export interface ReceivedReviewDto {
  id: string;
  bookingCode: string;
  customerName?: string;
  rating: number;
  comment?: string;
  isVisible: boolean;
  createdAt: string;
}

export interface TrustScoreDto {
  score: number;
  ratingAvg: number | null;
  ratingCount: number;
  ratingDistribution: { star5: number; star4: number; star3: number; star2: number; star1: number };
  history: { id: string; delta: number; reason: TrustScoreReason; bookingCode?: string; note?: string; createdAt: string }[];
}

/** What core/jobs offers (injected so tests need no Redis). */
export interface RecurringRegistry {
  registerHandler(jobName: string, handler: (payload: unknown) => Promise<void>): void;
  scheduleRecurring(schedulerId: string, repeat: { pattern: string; tz?: string } | { every: number }, jobName: string): Promise<void>;
}
