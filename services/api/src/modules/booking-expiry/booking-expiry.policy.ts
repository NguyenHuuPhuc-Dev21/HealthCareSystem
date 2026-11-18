/**
 * booking-expiry policy — PURE rules (no DB, no clock). BE-3 · Phase 3 · FR-BOOK-01/03 · BR-08 §2.5.
 */
import { ExecutionStatus, MatchingMode, PaymentStatus } from '@healthcare-system/shared';
import type { ExpiryBookingRow, ExpiryReason, ExpiryRule } from './booking-expiry.types';

const MINUTE_MS = 60_000;

/** Unpaid bank-transfer booking whose 15-minute hold has passed (FR-BOOK-01, SRS §5.2 row 9). */
export function paymentHoldExpired(b: ExpiryBookingRow, nowMs: number): boolean {
  return (
    b.execution_status === ExecutionStatus.DRAFT &&
    b.payment_status === PaymentStatus.UNPAID &&
    b.hold_expires_at !== null &&
    new Date(b.hold_expires_at).getTime() <= nowMs
  );
}

/**
 * When an unclaimed booking must give up (FR-BOOK-03 "Matching Expiry", BR-08 §2.5):
 *  - every booking: UNMATCHED_EXPIRY_LEAD_MINUTES (30) before its start;
 *  - urgent (Radar) bookings: also URGENT_UNMATCHED_EXPIRY_MINUTES (30) after matching started — whichever is first.
 */
export function unmatchedDeadline(b: ExpiryBookingRow, rule: ExpiryRule): number {
  const beforeStart = new Date(b.start_time).getTime() - rule.unmatchedLeadMinutes * MINUTE_MS;
  if (b.matching_mode === MatchingMode.RADAR_DISPATCH && b.matching_started_at) {
    return Math.min(beforeStart, new Date(b.matching_started_at).getTime() + rule.urgentUnmatchedMinutes * MINUTE_MS);
  }
  return beforeStart;
}

export function unmatchedExpired(b: ExpiryBookingRow, rule: ExpiryRule, nowMs: number): boolean {
  return b.execution_status === ExecutionStatus.MATCHING && b.nurse_id === null && unmatchedDeadline(b, rule) <= nowMs;
}

/** The reason this booking must expire now, or null. */
export function expiryReason(b: ExpiryBookingRow, rule: ExpiryRule, nowMs: number): ExpiryReason | null {
  if (paymentHoldExpired(b, nowMs)) return 'PAYMENT_TIMEOUT';
  if (unmatchedExpired(b, rule, nowMs)) return 'UNMATCHED';
  return null;
}

/** A 100% refund is due only when the platform actually holds the prepayment. Cash bookings hold nothing. */
export function refundDue(b: ExpiryBookingRow): boolean {
  return b.payment_status === PaymentStatus.ESCROW_HELD;
}
