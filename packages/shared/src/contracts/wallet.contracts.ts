import type { WithdrawalStatus } from '../enums';

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

