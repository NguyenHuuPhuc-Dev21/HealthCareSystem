/**
 * Types for withdrawals (BE-3 · Phase 5 · FR-PAY-04). Public shapes (WithdrawalDto) from packages/shared wallet.contracts.
 */
export type WithdrawalRow = {
  id: string;
  wallet_id: string;
  user_id: string;
  amount: string | number;
  status: string;
  bank_name: string;
  bank_account_no: string;
  account_holder: string;
  reject_reason: string | null;
  payout_ref: string | null;
  created_at: Date;
  reviewed_at: Date | null;
};

/** POST /wallets/withdraw — FE-2 reads withdrawal_id; the rest is the new WithdrawalDto. */
export interface WithdrawResult {
  withdrawal_id: string;
  id: string;
  amount: number;
  status: string;
  requestedAt: string;
}
