import type {
  CommissionDebtDto,
  CommissionPaymentLinkDto,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import * as mockCommission from './commission-payment.mock';

/**
 * Lấy danh sách các khoản hoa hồng ca tiền mặt (N11, FR-PAY-01, FR-PAY-02)
 */
export async function getCommissionDebts(): Promise<ApiResponse<CommissionDebtDto[]>> {
  if (env.useMockWallet) {
    try {
      const data = await mockCommission.mockGetCommissionDebts();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải danh sách khoản nợ hoa hồng',
        },
      };
    }
  }

  const res = await apiClient<any>('/nurse/commission-debts');
  if (!res.success || !res.data) return res;

  // Chuẩn hóa dữ liệu trả về từ backend nếu có snake_case
  const rawList = Array.isArray(res.data) ? res.data : res.data.items || [];
  const debts: CommissionDebtDto[] = rawList.map((item: any) => ({
    bookingId: item.bookingId || item.booking_id,
    bookingCode: item.bookingCode || item.booking_code,
    serviceName: item.serviceName || item.service_name,
    bookingAmount: item.bookingAmount ?? item.booking_amount ?? 0,
    commissionAmount: item.commissionAmount ?? item.commission_amount ?? 0,
    dueAt: item.dueAt || item.due_at || item.dueTime || item.due_time,
    status: item.status,
    paidAt: item.paidAt || item.paid_at,
  }));

  return { success: true, data: mockCommission.sortDebts(debts) };
}

/**
 * Lấy VietQR link & thông tin thanh toán hoa hồng cho ca trực (FR-PAY-02)
 */
export async function getCommissionPaymentLink(
  bookingId: string
): Promise<ApiResponse<CommissionPaymentLinkDto>> {
  if (env.useMockWallet) {
    try {
      const data = await mockCommission.mockGetCommissionPaymentLink(bookingId);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as CommissionPaymentLinkDto,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tạo liên kết thanh toán hoa hồng',
        },
      };
    }
  }

  const res = await apiClient<any>(`/bookings/${bookingId}/commission-payment-link`, {
    method: 'POST',
  });
  if (!res.success || !res.data) return res;

  const raw = res.data;
  const data: CommissionPaymentLinkDto = {
    checkoutUrl: raw.checkoutUrl || raw.checkout_url || '',
    qrCode: raw.qrCode || raw.qr_code || '',
    transferContent: raw.transferContent || raw.transfer_content || `HOAHONG ${bookingId}`,
    dueTime: raw.dueTime || raw.due_time || '',
    amount: raw.amount,
    bankName: raw.bankName || raw.bank_name || 'Ngân hàng TMCP Quân Đội (MB Bank)',
    accountNumber: raw.accountNumber || raw.account_number || '0388998899',
  };

  return { success: true, data };
}

/**
 * Kiểm tra trạng thái nộp hoa hồng cho một ca (dùng khi thăm dò trạng thái từ VietQrSheet)
 */
export async function getCommissionPaymentStatus(
  bookingId: string
): Promise<ApiResponse<{ status: 'UNPAID' | 'PAID' | 'OVERDUE'; paidAt?: string }>> {
  const debtsRes = await getCommissionDebts();
  if (!debtsRes.success || !debtsRes.data) {
    return {
      success: false,
      data: { status: 'UNPAID' },
      error: debtsRes.error,
    };
  }

  const found = debtsRes.data.find(
    (d) => d.bookingId === bookingId || d.bookingCode === bookingId
  );
  if (!found) {
    return {
      success: false,
      data: { status: 'UNPAID' },
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy ca' },
    };
  }

  return {
    success: true,
    data: {
      status: found.status,
      paidAt: found.paidAt,
    },
  };
}

/**
 * Xác nhận đã thanh toán hoa hồng (dành cho Mock / Webhook test)
 */
export async function confirmCommissionPayment(
  bookingId: string
): Promise<ApiResponse<{ success: boolean; paidAt: string }>> {
  if (env.useMockWallet) {
    try {
      const data = await mockCommission.mockConfirmCommissionPayment(bookingId);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: { success: false, paidAt: '' },
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi xác nhận nộp hoa hồng',
        },
      };
    }
  }

  return apiClient<{ success: boolean; paidAt: string }>(
    `/bookings/${bookingId}/confirm-commission`,
    { method: 'POST' }
  );
}

/**
 * Reset mock về 3 khoản ban đầu
 */
export async function resetCommissionDebtsMock(): Promise<CommissionDebtDto[]> {
  return mockCommission.mockResetCommissionDebts();
}

/**
 * Clear hết nợ để test trạng thái trống (Empty state)
 */
export async function clearCommissionDebtsMock(): Promise<CommissionDebtDto[]> {
  return mockCommission.mockClearAllCommissionDebts();
}

/**
 * Thêm một khoản nợ ca tiền mặt mới (dùng khi test check-out tiền mặt)
 */
export async function addCashCommissionDebtMock(
  bookingId: string,
  bookingCode: string,
  serviceName: string,
  bookingAmount: number
): Promise<CommissionDebtDto> {
  return mockCommission.mockAddCashCommissionDebt(bookingId, bookingCode, serviceName, bookingAmount);
}
