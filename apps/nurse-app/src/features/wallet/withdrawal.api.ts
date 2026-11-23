import {
  INITIAL_BANK_ACCOUNT,
  INITIAL_WITHDRAWALS,
  WithdrawalStatus,
  type BankAccountDto,
  type WithdrawalDto,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import { getWalletSummary, setMockWalletSummary } from './wallet.api';

// In-memory mock withdrawal store for app testing & runtime
let mockWithdrawalsState: WithdrawalDto[] = [...INITIAL_WITHDRAWALS];
let mockBankAccountState: BankAccountDto | null = { ...INITIAL_BANK_ACCOUNT };
let mockIdempotencyKeys: Record<string, string> = {};

export function resetWithdrawalMockState(): void {
  mockWithdrawalsState = [...INITIAL_WITHDRAWALS];
  mockBankAccountState = { ...INITIAL_BANK_ACCOUNT };
  mockIdempotencyKeys = {};
}

export function setMockBankAccount(account: BankAccountDto | null): void {
  mockBankAccountState = account ? { ...account } : null;
}

export function setMockWithdrawals(withdrawals: WithdrawalDto[]): void {
  mockWithdrawalsState = [...withdrawals];
}

export function getMockWithdrawals(): WithdrawalDto[] {
  return [...mockWithdrawalsState];
}

/**
 * Standard RFC 4122 Version 4 UUID generator
 * Ensures idempotency keys have valid UUID structure across environments
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validates requested withdrawal amount against available balance
 */
export function validateWithdrawalAmount(
  amount: number,
  availableBalance: number
): string | null {
  if (amount <= 0) {
    return 'Vui lòng nhập số tiền lớn hơn 0đ';
  }
  if (!Number.isInteger(amount)) {
    return 'Số tiền rút phải là số nguyên';
  }
  if (amount > availableBalance) {
    return `Số tiền rút vượt quá số dư khả dụng (${availableBalance.toLocaleString('vi-VN')}đ)`;
  }
  return null;
}

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getBankAccount(): Promise<ApiResponse<BankAccountDto | null>> {
  if (env.useMockWallet) {
    await delay(80);
    return { success: true, data: mockBankAccountState ? { ...mockBankAccountState } : null };
  }

  const res = await apiClient<BankAccountDto | null>('/nurse/bank-account');
  return { success: res.success, data: res.data ?? null, error: res.error };
}

export async function getWithdrawals(): Promise<ApiResponse<WithdrawalDto[]>> {
  if (env.useMockWallet) {
    await delay(120);
    return { success: true, data: [...mockWithdrawalsState] };
  }

  const res = await apiClient<any[]>('/wallets/withdrawals');
  if (!res.success || !res.data) {
    return { success: false, data: [], error: res.error };
  }

  const items: WithdrawalDto[] = res.data.map((item: any) => ({
    id: item.id,
    amount: Number(item.amount || 0),
    status: item.status,
    rejectReason: item.rejectReason ?? item.reject_reason,
    requestedAt: item.requestedAt ?? item.requested_at,
    processedAt: item.processedAt ?? item.processed_at,
  }));

  return { success: true, data: items };
}

export async function requestWithdrawal(
  amount: number,
  idempotencyKey?: string
): Promise<ApiResponse<{ withdrawal_id: string }>> {
  if (env.useMockWallet) {
    await delay(180);

    if (idempotencyKey && mockIdempotencyKeys[idempotencyKey]) {
      return { success: true, data: { withdrawal_id: mockIdempotencyKeys[idempotencyKey] } };
    }

    if (amount <= 0 || !Number.isInteger(amount)) {
      return {
        success: false,
        data: null as any,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Số tiền rút phải là số nguyên dương hợp lệ',
        },
      };
    }

    const summaryRes = await getWalletSummary();
    const available = summaryRes.success && summaryRes.data ? summaryRes.data.availableBalance : 0;

    if (amount > available) {
      return {
        success: false,
        data: null as any,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Số dư khả dụng không đủ để thực hiện yêu cầu rút tiền',
        },
      };
    }

    const withdrawalId = `wd-${Date.now()}`;
    const newRecord: WithdrawalDto = {
      id: withdrawalId,
      amount,
      status: WithdrawalStatus.WITHDRAW_REQUESTED,
      requestedAt: new Date().toISOString(),
    };

    mockWithdrawalsState = [newRecord, ...mockWithdrawalsState];
    if (idempotencyKey) {
      mockIdempotencyKeys[idempotencyKey] = withdrawalId;
    }

    // Deduct available balance
    setMockWalletSummary({ availableBalance: Math.max(0, available - amount) });

    return {
      success: true,
      data: { withdrawal_id: withdrawalId },
    };
  }

  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  return apiClient<{ withdrawal_id: string }>('/wallets/withdraw', {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount }),
  });
}
