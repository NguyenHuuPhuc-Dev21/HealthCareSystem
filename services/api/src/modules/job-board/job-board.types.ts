/**
 * Types and job names for job-board (BE-3 · Phase 3 · FR-BOOK-03 Mechanism B · BR-08 §2.2).
 * Public shapes (JobItem, DirectInvitation) come from packages/shared job-board.contracts (FE-2).
 */
import type { MatchingBookingRow } from '../matching-radar/matching-radar.types';

/** Recurring sweep: direct requests whose 15-minute window ended → broadcast (or Radar for urgent bookings). */
export const DIRECT_REQUEST_SWEEP_JOB = 'job-board.direct-request-sweep';
/** Operational cadence (not a business number). */
export const DIRECT_REQUEST_SWEEP_EVERY_MS = 60_000;

/** Booking as the board reads it: matching-radar's booking columns + who asked + the direct offer, if any. */
export type BoardBookingRow = MatchingBookingRow & {
  customer_name: string;
  matching_started_at: Date | null;
};

export type DirectOfferRow = {
  offer_id: string;
  booking_id: string;
  nurse_id: string;
  expires_at: Date | null;
};

export interface ClaimOk {
  success: true;
  booking_id: string;
  bookingCode: string;
}

export interface SweepResult {
  expired: number;
  toRadar: number;
  failed: number;
}
