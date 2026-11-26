/**
 * admin-finance — types (BE-3 · Phase 7 · FR-ADMIN-01 "Financial Ledger & Reconciliation" · CT-15).
 * Money is whole VND (BIGINT in the DB, number here).
 */

/** A report period: Vietnam calendar days, both inclusive. */
export interface Period {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  /** UTC instants: [fromAt, toAt) */
  fromAt: Date;
  toAt: Date;
}

export type CheckName = 'ESCROW_LEDGER' | 'AVAILABLE_LEDGER' | 'DEPOSIT_LEDGER';

export interface LedgerCheck {
  name: CheckName;
  /** Σ wallets.<balance> now */
  walletsTotal: number;
  /** Σ signed ledger movements of that balance */
  ledgerTotal: number;
  ok: boolean;
}

/**
 * GET /admin/finance/reconciliation. Field names follow admin-web features/finance/finance.api.ts
 * (FinancialReconDto, snake_case); the first five are the CT-15 figures.
 */
export interface FinancialReconDto {
  period: { from: string; to: string };
  generated_at: string;
  // --- CT-15 ---
  /** Customer money held in escrow right now (Σ escrow_locked_balance). */
  total_escrow_held: number;
  /** 15% platform commission earned in the period: transfer settlements + cash commissions paid. */
  total_commission_collected: number;
  /** Paid out to nurses in the period: credited to available balances by settlements. */
  total_payouts: number;
  /** Escrow refunded to customers in the period. */
  total_refunds: number;
  /** Withdrawal requests waiting for an Admin right now (amount). */
  pending_withdrawals: number;
  // --- detail ---
  escrow_received: number;
  commission_transfer: number;
  commission_cash: number;
  deposit_withheld: number;
  withdrawals_paid: number;
  pending_withdrawals_count: number;
  deposits_held: number;
  deposit_penalties: number;
  deposit_penalty_reversals: number;
  deposit_refunds_paid: number;
  /** Outstanding nurse debts (FR-ADMIN-01): deposits below zero + cash commissions not yet paid. */
  nurse_deposit_debt: number;
  cash_commission_unpaid: number;
  cash_commission_overdue: number;
  pending_deposit_refunds: number;
  open_settlement_holds: number;
  last_deposit_reconciliation: { run_date: string; status: 'OK' | 'MISMATCH'; resolved: boolean } | null;
  /** Each wallet balance against its ledger: all ok = the books balance. */
  checks: LedgerCheck[];
}

export interface LedgerExportRow {
  created_at: Date;
  tx_type: string;
  balance_type: string;
  status: string;
  amount: string | number;
  balance_before: string | number;
  balance_after: string | number;
  user_id: string;
  role: string;
  booking_code: string | null;
  idempotency_key: string;
  external_ref: string | null;
}

export interface AdminWithdrawalDto {
  id: string;
  nurseId: string;
  nurseName: string;
  phone: string;
  amount: number;
  bankName: string;
  bankAccountNo: string;
  accountHolder: string;
  status: string;
  rejectReason: string | null;
  payoutRef: string | null;
  requestedAt: string;
  processedAt: string | null;
}

export interface AdminDepositRefundDto {
  id: string;
  nurseId: string;
  nurseName: string;
  status: string;
  pendingReasons: string[];
  eligibleAt: string | null;
  depositBalance: number;
  refundAmount: number | null;
  bankName: string | null;
  bankAccountNo: string | null;
  accountHolder: string | null;
  dueBy: string | null;
  rejectReason: string | null;
  requestedAt: string;
  updatedAt: string;
}

export interface AdminReconciliationRunDto {
  id: string;
  runDate: string;
  status: 'OK' | 'MISMATCH';
  walletsTotal: number;
  ledgerTotal: number;
  custodyTotal: number;
  mismatchedWallets: number;
  details: unknown;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface AdminSettlementHoldDto {
  bookingId: string;
  bookingCode: string;
  nurseId: string | null;
  totalAmount: number;
  reason: string;
  detectedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface NurseDebtDto {
  nurseId: string;
  nurseName: string;
  phone: string;
  profileStatus: string;
  suspendedReason: string | null;
  depositBalance: number;
  depositDebt: number;
  unpaidCommission: number;
  overdueCommission: number;
  unpaidCashBookings: number;
}

/** Operational caps (not business numbers). */
export const MAX_REPORT_DAYS = 366;
export const MAX_EXPORT_ROWS = 50_000;
export const MAX_LIST_ROWS = 200;
