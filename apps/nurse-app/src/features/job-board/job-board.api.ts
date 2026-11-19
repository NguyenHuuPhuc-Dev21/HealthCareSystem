import type {
  ClaimJobResult,
  DirectInvitation,
  JobBoardFilter,
  JobItem,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import {
  mockAcceptDirectInvite,
  mockAcceptJob,
  mockDeclineDirectInvite,
  mockFetchDirectInvite,
  mockFetchJobBoard,
  mockFetchJobById,
  mockGetDepositStatus,
} from './job-board.mock';

export interface DepositStatusResult {
  depositBalance: number;
  minDeposit: number;
  depositGraceActive: boolean;
  graceShiftsRemaining: number;
  isAccountClosing: boolean;
}

export async function getJobBoard(
  filter: JobBoardFilter = 'all'
): Promise<ApiResponse<JobItem[]>> {
  if (env.useMockJobBoard) {
    const list = await mockFetchJobBoard(filter);
    return { success: true, data: list };
  }

  const query = filter && filter !== 'all' ? `?filter=${filter}` : '';
  const res = await apiClient<JobItem[]>(`/nurse/job-board${query}`);
  if (!res.success) {
    return { success: false, data: [], error: res.error };
  }
  return { success: true, data: res.data ?? [] };
}

export async function getJobDetail(
  id: string
): Promise<ApiResponse<JobItem | null>> {
  if (env.useMockJobBoard) {
    const job = await mockFetchJobById(id);
    return {
      success: Boolean(job),
      data: job,
      error: job ? undefined : { code: 'NOT_FOUND', message: 'Không tìm thấy ca làm việc.' },
    };
  }

  const res = await apiClient<JobItem>(`/nurse/job-board/${id}`);
  return { success: res.success, data: res.data ?? null, error: res.error };
}

export async function getDirectInvitations(): Promise<ApiResponse<DirectInvitation | null>> {
  if (env.useMockJobBoard) {
    const invite = await mockFetchDirectInvite();
    return { success: true, data: invite };
  }

  const res = await apiClient<DirectInvitation | null>('/nurse/direct-invitation');
  return { success: res.success, data: res.data ?? null, error: res.error };
}

export async function acceptJob(
  id: string,
  nurseTier = 'TIER_1_BASIC',
  depositBalance?: number
): Promise<ClaimJobResult> {
  if (env.useMockJobBoard) {
    return mockAcceptJob(id, nurseTier, { depositBalance });
  }

  const res = await apiClient<{ success: boolean; booking_id: string }>(
    `/bookings/${id}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ nurseTier, depositBalance }),
    }
  );

  if (!res.success) {
    return {
      success: false,
      errorCode: (res.error?.code as any) || 'ALREADY_CLAIMED',
      message: res.error?.message || 'Nhận ca thất bại, vui lòng thử lại.',
    };
  }

  return {
    success: true,
    bookingId: res.data?.booking_id || id,
  };
}

export async function acceptDirectInvite(
  id: string,
  nurseTier = 'TIER_1_BASIC',
  depositBalance?: number
): Promise<ClaimJobResult> {
  if (env.useMockJobBoard) {
    return mockAcceptDirectInvite(id, nurseTier, { depositBalance });
  }

  const res = await apiClient<{ success: boolean }>(
    `/bookings/${id}/accept-direct-invite`,
    {
      method: 'POST',
      body: JSON.stringify({ nurseTier, depositBalance }),
    }
  );

  if (!res.success) {
    return {
      success: false,
      errorCode: (res.error?.code as any) || 'ALREADY_CLAIMED',
      message: res.error?.message || 'Chấp nhận lời mời thất bại.',
    };
  }

  return {
    success: true,
    bookingId: id,
  };
}

export async function declineDirectInvite(
  id: string,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  if (env.useMockJobBoard) {
    return mockDeclineDirectInvite(id, reason);
  }

  const res = await apiClient<{ success: boolean }>(
    `/bookings/${id}/decline-direct-invite`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );

  return {
    success: res.success,
    message: res.error?.message,
  };
}

export async function getDepositStatus(): Promise<ApiResponse<DepositStatusResult>> {
  if (env.useMockJobBoard) {
    const data = await mockGetDepositStatus();
    return { success: true, data };
  }

  const res = await apiClient<any>('/wallets/me/deposit');
  if (!res.success || !res.data) {
    return {
      success: true,
      data: {
        depositBalance: 300000,
        minDeposit: 300000,
        depositGraceActive: false,
        graceShiftsRemaining: 0,
        isAccountClosing: false,
      },
    };
  }

  const raw = res.data;
  return {
    success: true,
    data: {
      depositBalance: raw.depositBalance ?? raw.deposit_balance ?? 300000,
      minDeposit: raw.minDeposit ?? raw.min_deposit ?? 300000,
      depositGraceActive: raw.grace?.active ?? raw.deposit_grace_active ?? false,
      graceShiftsRemaining:
        (raw.grace?.maxShifts ?? 3) - (raw.grace?.shiftsUsed ?? 0),
      isAccountClosing: raw.isAccountClosing ?? false,
    },
  };
}
