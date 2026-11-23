import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
} from '@healthcare-system/shared';
import type {
  CommissionDebtDto,
  CommissionPaymentLinkDto,
} from '@healthcare-system/shared';

export function getInitialCommissionDebts(): CommissionDebtDto[] {
  const now = Date.now();
  return [
    {
      bookingId: 'bk-cash-1057',
      bookingCode: 'HC-2026-1057',
      serviceName: 'Chăm sóc vết loét độ 3 & Thay băng tại nhà',
      bookingAmount: 500000,
      commissionAmount: Math.floor(500000 * DEFAULT_PLATFORM_COMMISSION_RATE), // 75.000đ
      // Check-out 27 giờ trước -> quá hạn 3 giờ
      dueAt: new Date(now - 3 * 3600 * 1000).toISOString(),
      status: 'OVERDUE',
    },
    {
      bookingId: 'bk-cash-1058',
      bookingCode: 'HC-2026-1058',
      serviceName: 'Hỗ trợ phục hồi chức năng sau tai biến',
      bookingAmount: 600000,
      commissionAmount: Math.floor(600000 * DEFAULT_PLATFORM_COMMISSION_RATE), // 90.000đ
      // Check-out 19 giờ trước -> còn 5 giờ để nộp
      dueAt: new Date(now + 5 * 3600 * 1000).toISOString(),
      status: 'UNPAID',
    },
    {
      bookingId: 'bk-cash-1056',
      bookingCode: 'HC-2026-1056',
      serviceName: 'Tiêm truyền thuốc & Theo dõi chỉ số sinh tồn',
      bookingAmount: 400000,
      commissionAmount: Math.floor(400000 * DEFAULT_PLATFORM_COMMISSION_RATE), // 60.000đ
      dueAt: new Date(now - 48 * 3600 * 1000).toISOString(),
      status: 'PAID',
      paidAt: new Date(now - 24 * 3600 * 1000).toISOString(),
    },
  ];
}

let inMemoryDebts: CommissionDebtDto[] = getInitialCommissionDebts();

/**
 * Sắp xếp các khoản nợ: Quá hạn -> Sắp hết hạn -> Đã nộp
 */
export function sortDebts(items: CommissionDebtDto[]): CommissionDebtDto[] {
  return [...items].sort((a, b) => {
    // Priority: OVERDUE (0), UNPAID (1), PAID (2)
    const priority = (s: string) => (s === 'OVERDUE' ? 0 : s === 'UNPAID' ? 1 : 2);
    const pA = priority(a.status);
    const pB = priority(b.status);

    if (pA !== pB) return pA - pB;

    // Trong cùng nhóm UNPAID hoặc OVERDUE: sắp xếp theo dueAt tăng dần (hết hạn sớm hơn đứng trước)
    if (a.status === 'OVERDUE' || a.status === 'UNPAID') {
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    }

    // Trong nhóm PAID: đã thanh toán gần nhất lên đầu
    const paidA = a.paidAt ? new Date(a.paidAt).getTime() : 0;
    const paidB = b.paidAt ? new Date(b.paidAt).getTime() : 0;
    return paidB - paidA;
  });
}

export async function mockGetCommissionDebts(): Promise<CommissionDebtDto[]> {
  const now = Date.now();
  // Tự động kiểm tra nếu có khoản UNPAID nào đã quá dueAt thì chuyển thành OVERDUE
  for (const d of inMemoryDebts) {
    if (d.status === 'UNPAID' && new Date(d.dueAt).getTime() <= now) {
      d.status = 'OVERDUE';
    }
  }
  return sortDebts(inMemoryDebts);
}

export async function mockGetCommissionPaymentLink(
  bookingId: string
): Promise<CommissionPaymentLinkDto> {
  const debt = inMemoryDebts.find((d) => d.bookingId === bookingId || d.bookingCode === bookingId);
  if (!debt) {
    throw new Error(`Không tìm thấy khoản nợ hoa hồng cho ca ${bookingId}`);
  }

  const transferContent = `HOAHONG ${debt.bookingCode.replace(/[^A-Za-z0-9]/g, '')}`;
  return {
    checkoutUrl: `https://pay.carenest.vn/commission/${debt.bookingCode}`,
    qrCode: `https://api.vietqr.io/image/970422-0388998899-qr_only.png?amount=${debt.commissionAmount}&addInfo=${encodeURIComponent(
      transferContent
    )}`,
    transferContent,
    dueTime: debt.dueAt,
    amount: debt.commissionAmount,
    bankName: 'Ngân hàng TMCP Quân Đội (MB Bank)',
    accountNumber: '0388998899',
  };
}

export async function mockConfirmCommissionPayment(
  bookingId: string
): Promise<{ success: boolean; paidAt: string }> {
  const debt = inMemoryDebts.find((d) => d.bookingId === bookingId || d.bookingCode === bookingId);
  if (!debt) {
    throw new Error(`Không tìm thấy khoản nợ hoa hồng cho ca ${bookingId}`);
  }

  const paidAt = new Date().toISOString();
  debt.status = 'PAID';
  debt.paidAt = paidAt;

  return { success: true, paidAt };
}

export async function mockAddCashCommissionDebt(
  bookingId: string,
  bookingCode: string,
  serviceName: string,
  bookingAmount: number
): Promise<CommissionDebtDto> {
  const existing = inMemoryDebts.find((d) => d.bookingId === bookingId || d.bookingCode === bookingCode);
  if (existing) {
    return existing;
  }

  const newDebt: CommissionDebtDto = {
    bookingId,
    bookingCode,
    serviceName,
    bookingAmount,
    commissionAmount: Math.floor(bookingAmount * DEFAULT_PLATFORM_COMMISSION_RATE),
    dueAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    status: 'UNPAID',
  };

  inMemoryDebts = [newDebt, ...inMemoryDebts];
  return newDebt;
}

export async function mockResetCommissionDebts(): Promise<CommissionDebtDto[]> {
  inMemoryDebts = getInitialCommissionDebts();
  return sortDebts(inMemoryDebts);
}

export async function mockClearAllCommissionDebts(): Promise<CommissionDebtDto[]> {
  inMemoryDebts = [];
  return [];
}
