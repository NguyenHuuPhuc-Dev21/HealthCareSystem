/**
 * Types for cash-commission (BE-3 · Phase 5 · FR-PAY-02 cash part · BR-05).
 * Public shapes (CommissionDebtDto, CommissionPaymentLinkDto) from packages/shared wallet.contracts (FE-2).
 */
export const OVERDUE_SWEEP_JOB = 'cash-commission.overdue-sweep';
/** Operational cadence (not a business number). */
export const OVERDUE_SWEEP_EVERY_MS = 5 * 60_000;
export const COMMISSION_CODE_PREFIX = 'HH';
/** nurse_profiles.suspended_reason written by the overdue sweep (and cleared on payment). */
export const COMMISSION_SUSPENSION_REASON = 'COMMISSION_OVERDUE';

export type CommissionStatus = 'UNPAID' | 'PAID' | 'OVERDUE';

export type DebtRow = {
  booking_id: string;
  booking_code: string;
  service_name: string;
  total_amount: string | number;
  platform_fee: string | number;
  commission_due_at: Date;
  paid_at: Date | null;
};

export type CommissionBookingRow = {
  id: string;
  booking_code: string;
  nurse_id: string | null;
  payment_method: string;
  execution_status: string;
  platform_fee: string | number;
  commission_due_at: Date | null;
  settled_at: Date | null;
};

export type CommissionPaymentRow = {
  booking_id: string;
  nurse_id: string;
  amount: string | number;
  payment_code: string;
  provider_ref: string | null;
  paid_at: Date | null;
};

export type CommissionOutcome = 'COMMISSION_PAID' | 'COMMISSION_RETURNED' | 'DUPLICATE' | 'AMOUNT_MISMATCH' | 'UNKNOWN_COMMISSION';

export interface CommissionPayment {
  paymentCode: string;
  amount: number;
  providerRef: string;
}

export interface CommissionResult {
  outcome: CommissionOutcome;
  bookingId: string | null;
}

export interface OverdueSweepResult {
  suspended: number;
}
