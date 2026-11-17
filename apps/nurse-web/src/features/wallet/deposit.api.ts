import type {
  AppealPenaltyRequest,
  DepositPenaltyDto,
  DepositRefundRequestDto,
  DepositStatusDto,
  DepositTopupLinkDto,
  TxStatus,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { USE_MOCK_WALLET } from '../../lib/mock-flags';
import * as mockDeposit from './deposit.mock';

export async function getDepositStatus(): Promise<
  ApiResponse<DepositStatusDto & { totalWithheld?: number }>
> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockDeposit.mockGetDepositStatus();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as DepositStatusDto,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải trạng thái ký quỹ',
        },
      };
    }
  }

  const res = await apiClient<any>('/wallets/me/deposit');
  if (!res.success || !res.data) return res;

  const raw = res.data;
  const data: DepositStatusDto & { totalWithheld?: number } = {
    depositBalance: raw.depositBalance ?? raw.deposit_balance ?? 0,
    minDeposit: raw.minDeposit ?? raw.min_deposit ?? 300000,
    shortfall: raw.shortfall ?? Math.max((raw.minDeposit ?? 300000) - (raw.depositBalance ?? 0), 0),
    grace: {
      active: raw.grace?.active ?? raw.deposit_grace_active ?? false,
      shiftsUsed: raw.grace?.shiftsUsed ?? raw.deposit_grace_shifts_used ?? 0,
      maxShifts: raw.grace?.maxShifts ?? 3,
      expiresAt: raw.grace?.expiresAt ?? raw.deposit_grace_expires_at ?? null,
      withholdRate: raw.grace?.withholdRate ?? 0.30,
    },
    canAcceptCash: raw.canAcceptCash ?? false,
    canAcceptTransfer: raw.canAcceptTransfer ?? false,
    custodyPartnerName: raw.custodyPartnerName ?? 'Ngân hàng đối tác lưu ký',
    totalWithheld: raw.totalWithheld ?? 0,
  };
  return { success: true, data };
}

export async function createDepositTopupLink(amount: number): Promise<ApiResponse<DepositTopupLinkDto>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockDeposit.mockCreateDepositTopupLink(amount);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as DepositTopupLinkDto,
        error: {
          code: err.code || 'CREATE_FAILED',
          message: err.message || 'Không thể tạo mã nạp ký quỹ',
        },
      };
    }
  }

  return apiClient<DepositTopupLinkDto>('/wallets/deposit/topup-link', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function getTopupStatus(topupId: string): Promise<ApiResponse<{ status: TxStatus }>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockDeposit.mockGetTopupStatus(topupId);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as { status: TxStatus },
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi kiểm tra trạng thái nạp',
        },
      };
    }
  }

  return apiClient<{ status: TxStatus }>(`/wallets/deposit/topups/${topupId}`);
}

export async function getDepositPenalties(): Promise<ApiResponse<DepositPenaltyDto[]>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockDeposit.mockGetDepositPenalties();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải danh sách khoản trừ',
        },
      };
    }
  }

  return apiClient<DepositPenaltyDto[]>('/wallets/me/deposit/penalties');
}

export async function appealPenalty(
  txId: string,
  body: AppealPenaltyRequest
): Promise<ApiResponse<{ disputeId: string }>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockDeposit.mockAppealPenalty(txId, body);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as { disputeId: string },
        error: {
          code: err.code || 'APPEAL_FAILED',
          message: err.message || 'Không thể gửi khiếu nại khoản trừ',
        },
      };
    }
  }

  return apiClient<{ disputeId: string }>(`/wallets/me/deposit/penalties/${txId}/appeal`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getRefundRequest(): Promise<ApiResponse<DepositRefundRequestDto | null>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockDeposit.mockGetRefundRequest();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải thông tin hoàn ký quỹ',
        },
      };
    }
  }

  return apiClient<DepositRefundRequestDto | null>('/wallets/me/deposit/refund-request');
}

export async function requestAccountClosure(): Promise<ApiResponse<DepositRefundRequestDto>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockDeposit.mockRequestAccountClosure();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as DepositRefundRequestDto,
        error: {
          code: err.code || 'REQUEST_FAILED',
          message: err.message || 'Không thể gửi yêu cầu ngừng hợp tác',
        },
      };
    }
  }

  return apiClient<DepositRefundRequestDto>('/wallets/me/deposit/refund-request', {
    method: 'POST',
  });
}

export async function cancelRefundRequest(id: string): Promise<ApiResponse<{ success: boolean }>> {
  if (USE_MOCK_WALLET) {
    try {
      const data = await mockDeposit.mockCancelRefundRequest(id);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as { success: boolean },
        error: {
          code: err.code || 'CANCEL_FAILED',
          message: err.message || 'Không thể hủy yêu cầu hoàn ký quỹ',
        },
      };
    }
  }

  return apiClient<{ success: boolean }>(`/wallets/me/deposit/refund-request/${id}/cancel`, {
    method: 'POST',
  });
}
