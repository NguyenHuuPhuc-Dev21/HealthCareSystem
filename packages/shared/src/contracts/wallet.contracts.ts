import type {
  BalanceType,
  DepositRefundStatus,
  PenaltyReason,
  TxStatus,
  TxType,
  WithdrawalStatus,
} from '../enums';

export interface WalletSummaryDto {
  availableBalance: number;      // có thể rút
  escrowLockedBalance: number;   // đang giữ chờ quyết toán
  depositBalance: number;        // ký quỹ, chỉ trừ phạt SLA
  minDeposit: number;            // từ cấu hình MIN_NURSE_DEPOSIT
  isSuspended: boolean;
  suspendedReason?: 'DEPOSIT_BELOW_MIN' | 'COMMISSION_OVERDUE' | 'TRUST_SCORE_LOW' | 'ACCOUNT_CLOSING' | null;
  depositGraceActive: boolean;   // ân hạn ký quỹ (ADR-0004): chỉ nhận ca chuyển khoản
}

export interface WalletTransactionDto {
  id: string;
  type: TxType;
  status: TxStatus;
  balanceType: BalanceType;
  amount: number;                // dương = cộng, âm = trừ
  bookingCode?: string;          // HC-2026-1042
  description: string;
  createdAt: string;             // ISO
}

export interface EarningsPointDto {
  label: string;
  amount: number;
}

export interface UpcomingSettlementDto {
  bookingCode: string;
  serviceName: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  settleAt: string;              // checkout + 24h
  disputeOpen: boolean;          // true = đang khiếu nại, đồng hồ dừng
}

export interface Paged<T> {
  items: T[];
  nextCursor?: string | null;
}

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

export interface DepositTopupLinkDto {
  topupId: string;
  amount: number;            // ≤ shortfall
  qrImageUrl: string;        // hoặc qrPayload để tự vẽ QR
  bankName: string;          // ngân hàng của đối tác lưu ký, không phải tài khoản nền tảng
  accountNumber: string;
  transferContent: string;   // ví dụ "KQ NURSE123 TOPUP-0001"
  expiresAt: string;         // ISO
}

export interface AppealPenaltyRequest {
  reason: string;            // ≥ 20 ký tự
  evidenceKeys?: string[];   // ảnh đã tải lên qua presigned URL
}

/** Cash booking platform commission debt (FR-PAY-01, FR-PAY-02, BR-05) */
export interface CommissionDebtDto {
  bookingId: string;
  bookingCode: string;          // HC-2026-1057
  serviceName: string;
  bookingAmount: number;        // giá trong app, không gồm tiền tip
  commissionAmount: number;     // floor(bookingAmount × 0.15)
  dueAt: string;                // checkout + 24h
  status: 'UNPAID' | 'PAID' | 'OVERDUE';
  paidAt?: string;
}

/** VietQR & payment link for self-paying 15% platform commission */
export interface CommissionPaymentLinkDto {
  checkoutUrl: string;
  qrCode: string;
  transferContent: string;      // có mã ca
  dueTime: string;
  amount?: number;
  bankName?: string;
  accountNumber?: string;
}


