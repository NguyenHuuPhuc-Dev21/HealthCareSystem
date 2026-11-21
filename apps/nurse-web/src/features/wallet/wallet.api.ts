import type {
  BankAccountDto,
  EarningsPointDto,
  Paged,
  UpcomingSettlementDto,
  WalletSummaryDto,
  WalletTransactionDto,
  WithdrawalDto,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { USE_MOCK_WALLET } from '../../lib/mock-flags';
import * as mockWallet from './wallet.mock';

export interface WalletBalancesDto {
  available_balance: number;
  escrow_locked_balance: number;
  deposit_balance: number;
}

export async function getWalletSummary(): Promise<ApiResponse<WalletSummaryDto>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockWallet.mockGetWalletSummary();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as WalletSummaryDto,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải thông tin ví',
        },
      };
    }
  }

  const res = await apiClient<any>('/wallets/me');
  if (!res.success || !res.data) return res as ApiResponse<WalletSummaryDto>;

  // Map backend snake_case to camelCase
  const raw = res.data;
  const data: WalletSummaryDto = {
    availableBalance: raw.availableBalance ?? raw.available_balance ?? 0,
    escrowLockedBalance: raw.escrowLockedBalance ?? raw.escrow_locked_balance ?? 0,
    depositBalance: raw.depositBalance ?? raw.deposit_balance ?? 0,
    minDeposit: raw.minDeposit ?? raw.min_deposit ?? 300000,
    isSuspended: raw.isSuspended ?? raw.is_suspended ?? false,
    suspendedReason: raw.suspendedReason ?? raw.suspended_reason ?? null,
    depositGraceActive: raw.depositGraceActive ?? raw.deposit_grace_active ?? false,
  };
  return { success: true, data };
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

export async function getUpcomingSettlements(): Promise<ApiResponse<UpcomingSettlementDto[]>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockWallet.mockGetUpcomingSettlements();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải danh sách sắp quyết toán',
        },
      };
    }
  }

  const res = await apiClient<any[]>('/wallets/me/upcoming-settlements');
  if (!res.success || !res.data) return res as ApiResponse<UpcomingSettlementDto[]>;

  const data: UpcomingSettlementDto[] = res.data.map((item) => ({
    bookingCode: item.bookingCode ?? item.booking_code ?? '',
    serviceName: item.serviceName ?? item.service_name ?? '',
    grossAmount: item.grossAmount ?? item.gross_amount ?? 0,
    commissionAmount: item.commissionAmount ?? item.commission_amount ?? 0,
    netAmount: item.netAmount ?? item.net_amount ?? 0,
    settleAt: item.settleAt ?? item.settle_at ?? '',
    disputeOpen: item.disputeOpen ?? item.dispute_open ?? false,
  }));
  return { success: true, data };
}

export async function getEarnings(range: 'week' | 'month'): Promise<
  ApiResponse<{
    points: EarningsPointDto[];
    totalAmount: number;
    periodLabel: string;
  }>
> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockWallet.mockGetEarnings(range);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: { points: [], totalAmount: 0, periodLabel: '' },
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải biểu đồ thu nhập',
        },
      };
    }
  }

  const res = await apiClient<any>(`/wallets/me/earnings?range=${range}`);
  if (!res.success || !res.data) return res;

  const raw = res.data;
  return {
    success: true,
    data: {
      points: (raw.points || []).map((p: any) => ({
        label: p.label,
        amount: p.amount,
      })),
      totalAmount: raw.totalAmount ?? raw.total_amount ?? 0,
      periodLabel: raw.periodLabel ?? raw.period_label ?? '',
    },
  };
}

export async function getWalletTransactions(params?: {
  type?: string;
  cursor?: string;
}): Promise<ApiResponse<Paged<WalletTransactionDto>>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockWallet.mockGetWalletTransactions(params);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: { items: [], nextCursor: null },
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải lịch sử giao dịch',
        },
      };
    }
  }

  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.cursor) query.set('cursor', params.cursor);

  const res = await apiClient<any>(`/wallets/me/transactions?${query.toString()}`);
  if (!res.success || !res.data) return res as ApiResponse<Paged<WalletTransactionDto>>;

  const rawItems = res.data.items || [];
  const items: WalletTransactionDto[] = rawItems.map((item: any) => ({
    id: item.id,
    type: item.type,
    status: item.status,
    balanceType: item.balanceType ?? item.balance_type,
    amount: item.amount,
    bookingCode: item.bookingCode ?? item.booking_code,
    description: item.description,
    createdAt: item.createdAt ?? item.created_at,
  }));

  return {
    success: true,
    data: {
      items,
      nextCursor: res.data.nextCursor ?? res.data.next_cursor ?? null,
    },
  };
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
