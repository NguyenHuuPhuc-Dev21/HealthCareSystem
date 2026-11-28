/**
 * Types for settlements (BE-3 · Phase 5 · FR-PAY-02 · ADR-0004 D2).
 */

/** Recurring sweep: cooled-down shifts + cancellation shares still held. Operational cadence and batch size. */
export const SETTLEMENT_SWEEP_JOB = 'settlements.sweep';
export const SETTLEMENT_SWEEP_EVERY_MS = 5 * 60_000;
export const SETTLEMENT_BATCH_SIZE = 200;

export type SettlementKind = 'SHIFT' | 'CANCELLATION';
export type SettlementTrigger = 'COOLING_ELAPSED' | 'CUSTOMER_CONFIRMED' | 'DISPUTE_RELEASED' | 'CANCELLATION_SHARE';

/** Booking as a settlement reads it (locked FOR UPDATE). */
export type SettleBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  payment_method: string;
  payment_status: string;
  execution_status: string;
  dispute_status: string;
  total_amount: string | number;
  platform_fee: string | number;
  settled_at: Date | null;
  checkout_time: Date | null;
};

export type CancellationShareRow = {
  scenario: string;
  nurse_compensation: string | number;
  platform_share: string | number;
  settlement_status: string;
};

export interface SettlementSplit {
  gross: number;
  commission: number;
  net: number;
  withheld: number;
  payout: number;
  graceShift: boolean;
}

export type SettleOutcome =
  | { settled: true; split: SettlementSplit; kind: SettlementKind }
  | { settled: false; reason: SettleSkipReason };

export type SettleSkipReason =
  | 'NOT_FOUND'
  | 'ALREADY_SETTLED'
  | 'NOT_TRANSFER_BOOKING'
  | 'NOT_HELD'
  | 'NO_NURSE'
  | 'NOT_CHECKED_OUT'
  | 'COOLING' // the cooling window is still running
  | 'DISPUTE_OPEN'
  | 'NOT_COMPLETED'
  | 'NOTHING_PENDING';

export interface SettlementSweepResult {
  shifts: number;
  cancellations: number;
  skipped: number;
  failed: number;
}

/** POST /bookings/:id/confirm-completion */
export interface ConfirmCompletionResult {
  bookingId: string;
  bookingCode: string;
  settled: true;
  settledAt: string;
}
