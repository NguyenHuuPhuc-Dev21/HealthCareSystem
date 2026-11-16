import type { DepositRefundStatus, PenaltyReason, WithdrawalStatus } from '../enums';

export interface BankAccountDto {
  bankName: string; // Vietcombank
  accountMasked: string; // •••• 6899
  accountHolder: string;
}

export interface WithdrawalDto {
  id: string;
  amount: number;
  status: WithdrawalStatus; // WITHDRAW_REQUESTED | WITHDRAWN | REJECTED
  rejectReason?: string;
  requestedAt: string;
  processedAt?: string;
}


/** Deposit state shown on the wallet / deposit screens (ADR-0004) */
export interface DepositStatusDto {
  depositBalance: number;          // may be negative (debt)
  minDeposit: number;              // MIN_NURSE_DEPOSIT
  shortfall: number;               // max(minDeposit − depositBalance, 0); top-up may not exceed it
  grace: {
    active: boolean;               // short deposit but still allowed transfer-paid jobs
    shiftsUsed: number;
    maxShifts: number;             // DEPOSIT_GRACE_MAX_SHIFTS
    expiresAt: string | null;      // ISO, first ACTIVE + DEPOSIT_GRACE_DAYS
    withholdRate: number;          // DEPOSIT_WITHHOLD_RATE
  };
  canAcceptCash: boolean;          // false while the deposit is short
  canAcceptTransfer: boolean;      // full deposit, or grace active
  custodyPartnerName?: string;     // who holds the money (ADR-0004 D1)
}

/** One deposit deduction and its explanation (deposit_penalty_details) */
export interface DepositPenaltyDto {
  transactionId: string;
  amount: number;
  reason: PenaltyReason;
  slaRuleRef: string;              // e.g. 'SRS §5.2 row 7'
  bookingId?: string;
  bookingCode?: string;
  disputeId?: string;
  note?: string;
  createdAt: string;
  appealDeadline: string | null;   // null = not appealable (DISPUTE_UPHELD)
  appealDisputeId?: string;        // set once the nurse has appealed
  reversed: boolean;               // a PENALTY_REVERSAL exists
}

export type DepositRefundPendingReason =
  | 'ACTIVE_BOOKING'
  | 'HOLD_DAYS'
  | 'OPEN_DISPUTE'
  | 'UNPAID_COMMISSION';

/** Account closure → deposit refund request (deposit_refund_requests) */
export interface DepositRefundRequestDto {
  id: string;
  status: DepositRefundStatus;
  pendingReasons: DepositRefundPendingReason[];
  eligibleAt: string | null;       // earliest date all conditions can clear
  refundAmount: number | null;     // max(deposit_balance, 0) once READY
  debtAmount: number;              // 0 or the amount still owed when deposit is negative
  bankAccount: BankAccountDto;
  dueBy: string | null;            // READY + DEPOSIT_REFUND_SLA_WORKING_DAYS
  rejectReason?: string;
  requestedAt: string;
  updatedAt: string;
}
