/**
 * Types for deposits (BE-3 · Phase 5 · ADR-0004 · FR-PAY-03).
 * Public shapes (DepositStatusDto, DepositTopupLinkDto, DepositPenaltyDto, DepositRefundRequestDto, BankAccountDto,
 * AppealPenaltyRequest) come from packages/shared wallet.contracts (FE-2).
 */
import type { DepositRefundPendingReason, PenaltyReason } from '@healthcare-system/shared';

/** Daily jobs (Vietnam time). */
export const RECONCILIATION_JOB = 'deposits.reconciliation';
export const RECONCILIATION_SCHEDULE = { pattern: '30 1 * * *' }; // 01:30 every day
export const REFUND_ELIGIBILITY_JOB = 'deposits.refund-eligibility';
export const REFUND_ELIGIBILITY_SCHEDULE = { pattern: '15 2 * * *' }; // 02:15 every day, after reconciliation

/** Operational limits (not business numbers). */
export const MAX_APPEAL_EVIDENCE = 5; // FR-DISP-01: at most 5 files
export const MAX_RECONCILIATION_DETAILS = 50;
export const PAYMENT_CODE_PREFIX = 'KQ';

/** Appeal dispute marker in disputes.reason_code (disputes.api.md: kind = PENALTY_APPEAL). */
export const PENALTY_APPEAL_REASON_CODE = 'PENALTY_APPEAL';

export type TopupStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'RETURNED';

export type TopupRow = {
  id: string;
  wallet_id: string;
  nurse_id: string;
  amount: string | number;
  payment_code: string;
  status: TopupStatus;
  expires_at: Date;
  provider_ref: string | null;
};

/** What a verified webhook for a "KQ…" transfer led to (payment_webhook_events.outcome). */
export type TopupOutcome =
  | 'TOPUP_CREDITED' // whole amount credited to the deposit
  | 'TOPUP_EXCESS_RETURNED' // shortfall credited, the rest returned by the custody partner
  | 'TOPUP_RETURNED' // deposit already full (or link already paid): everything returned
  | 'DUPLICATE' // same gateway reference already handled
  | 'AMOUNT_MISMATCH' // amount differs from the link → nothing moved, Admin follows up
  | 'UNKNOWN_TOPUP';

export interface TopupPayment {
  paymentCode: string;
  amount: number;
  providerRef: string;
}

export interface TopupResult {
  outcome: TopupOutcome;
  topupId: string | null;
  credited: number;
  returned: number;
}

export type BankAccountRow = { bank_name: string; account_no: string; account_holder: string };

export type PenaltyRow = {
  transaction_id: string;
  amount: string | number;
  reason: PenaltyReason | string;
  sla_rule_ref: string;
  booking_id: string | null;
  booking_code: string | null;
  dispute_id: string | null;
  note: string | null;
  created_at: Date;
  appeal_deadline: Date | null;
  appeal_dispute_id: string | null;
  reversed: boolean;
};

export type RefundRequestRow = {
  id: string;
  wallet_id: string;
  status: string;
  pending_reasons: DepositRefundPendingReason[];
  eligible_at: Date | null;
  refund_amount: string | number | null;
  bank_name: string | null;
  bank_account_no: string | null;
  account_holder: string | null;
  transaction_id: string | null;
  due_by: Date | null;
  reject_reason: string | null;
  requested_at: Date;
  updated_at: Date;
};

/** Facts the eligibility rule needs (ADR-0004 D3). */
export interface RefundFacts {
  activeBookings: number;
  lastCheckoutAt: Date | null;
  openDisputes: number;
  unpaidCommissions: number;
}

export interface RefundEligibility {
  pendingReasons: DepositRefundPendingReason[];
  eligibleAt: Date | null;
}

/** Input of deductPenalty — called by cancellation / no-show / dispute flows. */
export interface PenaltyInput {
  nurseId: string;
  bookingId: string | null;
  reason: PenaltyReason;
  amount: number;
  slaRuleRef: string; // e.g. 'SRS §5.2 row 7'
  disputeId?: string | null;
  note?: string | null;
  decidedBy?: string | null; // null = automatic
  /** Defaults to deposit-penalty:<reason>:<bookingId>. Required when bookingId is null. */
  idempotencyKey?: string;
}

export interface ReconciliationResult {
  runDate: string;
  status: 'OK' | 'MISMATCH';
  walletsTotal: number;
  ledgerTotal: number;
  custodyTotal: number;
  mismatchedWallets: number;
}

export interface RefundSweepResult {
  ready: number;
  waiting: number;
  failed: number;
}
