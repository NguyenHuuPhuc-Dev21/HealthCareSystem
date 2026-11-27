import {
  INITIAL_BANK_ACCOUNT,
  INITIAL_EARNINGS_WEEK,
  INITIAL_TRANSACTIONS,
  INITIAL_UPCOMING_SETTLEMENTS,
  INITIAL_WALLET_SUMMARY,
  PENDING_COMMISSION_SAMPLE,
  TxType,
  mapUpcomingSettlement,
  mapWalletSummary,
  mapWalletTransaction,
  type BankAccountDto,
  type EarningsPointDto,
  type Paged,
  type UpcomingSettlementDto,
  type WalletSummaryDto,
  type WalletTransactionDto,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';

// In-memory mock wallet store for app testing & runtime
let mockSummaryState: WalletSummaryDto = { ...INITIAL_WALLET_SUMMARY };
let mockTransactionsState: WalletTransactionDto[] = [...INITIAL_TRANSACTIONS];
let mockUpcomingState: UpcomingSettlementDto[] = [...INITIAL_UPCOMING_SETTLEMENTS];
let mockEarningsState: EarningsPointDto[] = [...INITIAL_EARNINGS_WEEK];
let mockPendingCommissionState = { ...PENDING_COMMISSION_SAMPLE };

export function resetWalletMockState(): void {
  mockSummaryState = { ...INITIAL_WALLET_SUMMARY };
  mockTransactionsState = [...INITIAL_TRANSACTIONS];
  mockUpcomingState = [...INITIAL_UPCOMING_SETTLEMENTS];
  mockEarningsState = [...INITIAL_EARNINGS_WEEK];
  mockPendingCommissionState = { ...PENDING_COMMISSION_SAMPLE };
}

export function setMockWalletSummary(patch: Partial<WalletSummaryDto>): void {
  mockSummaryState = { ...mockSummaryState, ...patch };
}

export function setMockPendingCommission(hasPending: boolean, patch?: Partial<typeof PENDING_COMMISSION_SAMPLE>): void {
  mockPendingCommissionState = {
    ...mockPendingCommissionState,
    hasPendingCommission: hasPending,
    ...patch,
  };
}

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getWalletSummary(): Promise<ApiResponse<WalletSummaryDto>> {
  if (env.useMockWallet) {
    await delay();
    return { success: true, data: { ...mockSummaryState } };
  }

  const res = await apiClient<any>('/wallets/me');
  if (!res.success || !res.data) {
    return { success: false, data: null as any, error: res.error };
  }

  return { success: true, data: mapWalletSummary(res.data) };
}

export async function getWalletTransactions(params?: {
  type?: string;
  cursor?: string;
  limit?: number;
}): Promise<ApiResponse<Paged<WalletTransactionDto>>> {
  if (env.useMockWallet) {
    await delay();
    const limit = params?.limit || 6;
    const startIndex = params?.cursor ? parseInt(params.cursor, 10) : 0;

    let filtered = [...mockTransactionsState];
    const typeFilter = params?.type;

    if (typeFilter && typeFilter !== 'ALL') {
      if (typeFilter === 'SETTLE') {
        filtered = filtered.filter(
          (tx) => tx.type === TxType.ESCROW_RELEASE || tx.type === TxType.DEPOSIT_WITHHOLD
        );
      } else if (typeFilter === 'PENALTY') {
        filtered = filtered.filter(
          (tx) => tx.type === TxType.PENALTY_DEDUCT || tx.type === TxType.PENALTY_REVERSAL
        );
      } else if (typeFilter === 'WITHDRAW') {
        filtered = filtered.filter((tx) => tx.type === TxType.WITHDRAW);
      } else if (typeFilter === 'DEPOSIT') {
        filtered = filtered.filter(
          (tx) =>
            tx.type === TxType.TOPUP ||
            tx.type === TxType.DEPOSIT_WITHHOLD ||
            tx.type === TxType.DEPOSIT_REFUND ||
            tx.type === TxType.PENALTY_DEDUCT ||
            tx.type === TxType.PENALTY_REVERSAL
        );
      } else {
        filtered = filtered.filter((tx) => tx.type === typeFilter);
      }
    }

    const items = filtered.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const nextCursor = nextIndex < filtered.length ? String(nextIndex) : null;

    return {
      success: true,
      data: {
        items,
        nextCursor,
      },
    };
  }

  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.cursor) query.set('cursor', params.cursor);
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await apiClient<any>(`/wallets/me/transactions?${query.toString()}`);
  if (!res.success || !res.data) {
    return { success: false, data: { items: [], nextCursor: null }, error: res.error };
  }

  const rawItems = res.data.items || [];
  return {
    success: true,
    data: {
      items: rawItems.map(mapWalletTransaction),
      nextCursor: res.data.nextCursor ?? res.data.next_cursor ?? null,
    },
  };
}

export async function getEarnings(range: 'week' | 'month' = 'week'): Promise<
  ApiResponse<{
    points: EarningsPointDto[];
    totalAmount: number;
    periodLabel: string;
  }>
> {
  if (env.useMockWallet) {
    await delay();
    const points = mockEarningsState;
    const totalAmount = points.reduce((acc, p) => acc + p.amount, 0);
    return {
      success: true,
      data: {
        points,
        totalAmount,
        periodLabel: range === 'week' ? 'Tuần này' : 'Tháng này',
      },
    };
  }

  const res = await apiClient<any>(`/wallets/me/earnings?range=${range}`);
  if (!res.success || !res.data) {
    return {
      success: false,
      data: { points: [], totalAmount: 0, periodLabel: '' },
      error: res.error,
    };
  }

  const raw = res.data;
  return {
    success: true,
    data: {
      points: (raw.points || []).map((p: any) => ({
        label: String(p.label),
        amount: Number(p.amount || 0),
      })),
      totalAmount: Number(raw.totalAmount ?? raw.total_amount ?? 0),
      periodLabel: String(raw.periodLabel ?? raw.period_label ?? ''),
    },
  };
}

export async function getUpcomingSettlements(): Promise<ApiResponse<UpcomingSettlementDto[]>> {
  if (env.useMockWallet) {
    await delay();
    return { success: true, data: [...mockUpcomingState] };
  }

  const res = await apiClient<any[]>('/wallets/me/upcoming-settlements');
  if (!res.success || !res.data) {
    return { success: false, data: [], error: res.error };
  }

  return {
    success: true,
    data: res.data.map(mapUpcomingSettlement),
  };
}

export async function getPendingCommissionNotice(): Promise<{
  hasPendingCommission: boolean;
  bookingCode?: string;
  amount?: number;
  hoursRemaining?: number;
  description?: string;
}> {
  if (env.useMockWallet) {
    await delay(50);
    return { ...mockPendingCommissionState };
  }

  try {
    const res = await apiClient<any>('/nurse/commission-debts');
    if (res.success && res.data) {
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.items)
        ? res.data.items
        : null;

      if (list) {
        const pending = list.find(
          (item: any) => item.status === 'PENDING' || item.status === 'OVERDUE' || !item.paidAt
        );
        if (!pending) return { hasPendingCommission: false };

        const dueMs = pending.dueAt ? Date.parse(pending.dueAt) : Number.NaN;
        const hoursRemaining = Number.isFinite(dueMs)
          ? Math.max(0, Math.round((dueMs - Date.now()) / 3600000))
          : 24;
        return {
          hasPendingCommission: true,
          bookingCode: pending.bookingCode ?? pending.booking_code,
          amount: Number(pending.commissionAmount ?? pending.amount ?? 0),
          hoursRemaining,
          description: pending.description,
        };
      }

      return {
        hasPendingCommission: Boolean(res.data.hasPendingCommission ?? res.data.has_pending),
        bookingCode: res.data.bookingCode ?? res.data.booking_code,
        amount: Number(res.data.amount || 0),
        hoursRemaining: Number(res.data.hoursRemaining ?? res.data.hours_remaining ?? 24),
        description: res.data.description,
      };
    }
  } catch {
    // fallback
  }

  return { hasPendingCommission: false };
}

export async function getBankAccount(): Promise<ApiResponse<BankAccountDto | null>> {
  if (env.useMockWallet) {
    await delay(80);
    return { success: true, data: { ...INITIAL_BANK_ACCOUNT } };
  }

  const res = await apiClient<BankAccountDto | null>('/nurse/bank-account');
  return { success: res.success, data: res.data ?? null, error: res.error };
}
