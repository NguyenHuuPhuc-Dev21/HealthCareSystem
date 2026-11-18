/**
 * Types and job names for booking-expiry (BE-3 · Phase 3 · FR-BOOK-01/03 · BR-04 §2.1 · BR-08 §2.5).
 */
import type { ExecutionStatus, MatchingMode, PaymentMethod, PaymentStatus } from '@healthcare-system/shared';

/** Recurring safety-net sweep (every minute): unpaid holds that passed + unmatched bookings at their deadline. */
export const EXPIRY_SWEEP_JOB = 'booking-expiry.sweep';
/** Operational cadence of the sweep (not a business number). */
export const EXPIRY_SWEEP_EVERY_MS = 60_000;

/** Why a booking expired (stored in bookings.cancellation_reason). */
export type ExpiryReason = 'PAYMENT_TIMEOUT' | 'UNMATCHED';

/** Booking as expiry reads it (locked FOR UPDATE). */
export type ExpiryBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  matching_mode: MatchingMode;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  execution_status: ExecutionStatus;
  start_time: Date;
  hold_expires_at: Date | null;
  matching_started_at: Date | null;
  total_amount: string | number;
};

/** Expiry deadlines read from system_configs. */
export interface ExpiryRule {
  unmatchedLeadMinutes: number; // UNMATCHED_EXPIRY_LEAD_MINUTES (30)
  urgentUnmatchedMinutes: number; // URGENT_UNMATCHED_EXPIRY_MINUTES (30)
}

export interface ExpiryResult {
  expired: boolean;
  reason: ExpiryReason | null;
  /** true when a 100% refund of the escrowed prepayment was booked. */
  refunded: boolean;
}

export interface SweepResult {
  paymentTimeouts: number;
  unmatched: number;
  refunded: number;
  failed: number;
}

export interface ExpiryNotice {
  userId: string;
  bookingId: string;
  title: string;
  body: string;
}
