/**
 * Types and job names for tier-lifecycle (BE-2 · Phase 1 · FR-AUTH-02 §2, BR-21 §2.5).
 * Status enums come from packages/shared; only module-local shapes live here.
 */
import type { MatchingMode, NurseTier, ProfileStatus } from '@healthcare-system/shared';
import { TIMEZONE_DISPLAY } from '@healthcare-system/shared';

/** Daily sweep that demotes Tier 2 nurses whose GPHN has expired. */
export const GPHN_EXPIRY_SWEEP_JOB = 'tier-lifecycle.gphn-expiry-sweep';

/**
 * Operational schedule (not a business number): 00:05 Vietnam time, every day.
 * Just after midnight so a GPHN that expires "today" stops counting as Tier 2 before
 * the day's shifts start. Far from the 19:00–21:00 shift-handover window.
 */
export const GPHN_EXPIRY_SWEEP_SCHEDULE = { pattern: '5 0 * * *', tz: TIMEZONE_DISPLAY };

/**
 * Job that puts a booking back into dispatch after its nurse was removed.
 * OWNED BY matching-radar (BE-2 · Phase 3). Until Phase 3 lands, worker.ts registers a
 * placeholder handler (registerRedispatchPlaceholder) so the jobs do not fall into the DLQ.
 */
export const REDISPATCH_JOB = 'matching-radar.redispatch';

export type RedispatchReason = 'NURSE_TIER_DEMOTED';

export interface RedispatchPayload {
  bookingId: string;
  reason: RedispatchReason;
  /** The nurse who was removed — the matcher must not offer the booking to them again. */
  releasedNurseId: string;
  matchingMode: MatchingMode;
}

/** Row of nurse_profiles as the sweep reads it under FOR UPDATE. */
export type LockedTierRow = {
  tier: NurseTier;
  gphn_number: string | null;
  /** YYYY-MM-DD (to_char) or null. */
  gphn_expiry_date: string | null;
  profile_status: ProfileStatus;
};

/** A booking taken away from the demoted nurse (RETURNING of releaseInvasiveBookings). */
export type ReleasedBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  matching_mode: MatchingMode;
  start_time: Date;
};

export interface DemotionOutcome {
  nurseId: string;
  previousExpiryDate: string | null;
  releasedBookings: ReleasedBookingRow[];
}

export interface SweepResult {
  /** Nurses moved from Tier 2 to Tier 1 in this run. */
  demoted: number;
  /** Candidates that no longer qualified once locked (e.g. a renewal was approved meanwhile). */
  skipped: number;
  /** Bookings put back into dispatch. */
  releasedBookings: number;
  /** Nurses or follow-up steps that failed; the job is retried when this is > 0. */
  failed: number;
}

/** What the sweep needs to send a notification (core/notifications satisfies a wrapper of this). */
export interface TierNotice {
  userId: string;
  bookingId?: string;
  title: string;
  body: string;
}
