/**
 * Types for wallets-ledger (BE-3 · Phase 5 · FR-PAY-01/03 · ADR-0004).
 * Public shapes (WalletSummaryDto, WalletTransactionDto, EarningsPointDto, UpcomingSettlementDto, Paged)
 * come from packages/shared wallet.contracts (FE-2).
 */
import type { EarningsPointDto, TxType } from '@healthcare-system/shared';

/** Recurring sweep: pay the travel support owed by on-site prescription rejections (0012). */
export const TRAVEL_SUPPORT_SWEEP_JOB = 'wallets-ledger.travel-support-sweep';
/** Operational cadence and batch size (not business numbers). */
export const TRAVEL_SUPPORT_SWEEP_EVERY_MS = 5 * 60_000;
export const TRAVEL_SUPPORT_BATCH_SIZE = 200;

/** Transactions page size (FE-2 asks without a limit) and the maximum a caller may request. */
export const DEFAULT_TX_PAGE_SIZE = 20;
export const MAX_TX_PAGE_SIZE = 50;

/** Filter chips of the nurse wallet screen (apps/nurse-web WalletPage) — or one exact TxType. */
export type TxFilterGroup = 'ALL' | 'SETTLE' | 'PENALTY' | 'WITHDRAW' | 'DEPOSIT';

export type EarningsRange = 'week' | 'month';

export interface EarningsResult {
  points: EarningsPointDto[];
  totalAmount: number;
  periodLabel: string;
}

export type SuspendedReason = 'DEPOSIT_BELOW_MIN' | 'COMMISSION_OVERDUE' | 'TRUST_SCORE_LOW' | 'ACCOUNT_CLOSING';

export type NurseWalletRow = {
  id: string;
  available_balance: string | number;
  escrow_locked_balance: string | number;
  deposit_balance: string | number;
  deposit_grace_expires_at: Date | null;
  deposit_grace_shifts_used: number;
  closure_requested_at: Date | null;
};

export type NurseStatusRow = {
  profile_status: string | null;
  suspended_reason: string | null;
};

export type TxRow = {
  id: string;
  tx_type: TxType | string;
  status: string;
  balance_type: string;
  amount: string | number;
  balance_before: string | number;
  balance_after: string | number;
  booking_code: string | null;
  created_at: Date;
  /** created_at as PostgreSQL text — exact (microseconds) for the cursor. */
  created_at_text: string;
};

export type EarningRow = { created_at: Date; amount: string | number };

export type UpcomingSettlementRow = {
  booking_code: string;
  service_name: string;
  total_amount: string | number;
  platform_fee: string | number;
  checkout_time: Date;
  dispute_status: string;
};

export type PendingTravelSupportRow = {
  id: string;
  booking_id: string;
  nurse_id: string;
  travel_support_amount: string | number;
};

/** One posting on a NURSE wallet. `delta` is signed: + credits, − debits the chosen balance. */
export interface NurseEntry {
  userId: string;
  bookingId: string | null;
  txType: TxType;
  balance: 'AVAILABLE' | 'DEPOSIT';
  delta: number;
  idempotencyKey: string;
  externalRef: string | null;
}

export interface TravelSupportSweepResult {
  paid: number;
  failed: number;
}
