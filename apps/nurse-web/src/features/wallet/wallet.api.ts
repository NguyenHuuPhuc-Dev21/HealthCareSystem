import type { BankAccountDto, WithdrawalDto } from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { USE_MOCK_WALLET } from '../../lib/mock-flags';
import * as mockWallet from './wallet.mock';

export interface WalletBalancesDto {
  available_balance: number;
  escrow_locked_balance: number;
  deposit_balance: number;
}

export async function getWalletBalances(): Promise<ApiResponse<WalletBalancesDto>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockWallet.mockGetWalletBalances();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as WalletBalancesDto,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải số dư ví',
        },
      };
    }
  }
  return apiClient<WalletBalancesDto>('/wallets/me');
}

export async function getBankAccount(): Promise<ApiResponse<BankAccountDto | null>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockWallet.mockGetBankAccount();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải thông tin tài khoản ngân hàng',
        },
      };
    }
  }
  return apiClient<BankAccountDto | null>('/nurse/bank-account');
}

export async function getWithdrawals(): Promise<ApiResponse<WithdrawalDto[]>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockWallet.mockGetWithdrawals();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải lịch sử rút tiền',
        },
      };
    }
  }
  return apiClient<WithdrawalDto[]>('/wallets/withdrawals');
}

export async function requestWithdrawal(
  amount: number,
  idempotencyKey?: string
): Promise<ApiResponse<{ withdrawal_id: string }>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockWallet.mockRequestWithdrawal(amount, idempotencyKey);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as { withdrawal_id: string },
        error: {
          code: err.code || 'REQUEST_FAILED',
          message: err.message || 'Không thể tạo yêu cầu rút tiền',
        },
      };
    }
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
