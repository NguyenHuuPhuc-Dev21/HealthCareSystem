import type {
  CommissionDebtDto,
  CommissionPaymentLinkDto,
} from '@healthcare-system/shared';

const COMMISSION_DEBTS_STORAGE_KEY = 'carenest_mock_commission_debts_v1';
const WALLET_STORAGE_KEY = 'carenest_mock_wallet_v2';

function getInitialDebts(): CommissionDebtDto[] {
  const now = Date.now();
  return [
    {
      bookingId: 'bk-cash-1057',
      bookingCode: 'HC-2026-1057',
      serviceName: 'Chăm sóc vết loét độ 3 & Thay băng tại nhà',
      bookingAmount: 500000,
      commissionAmount: 75000,
      // Đã check-out 27 giờ trước -> quá hạn 3 giờ
      dueAt: new Date(now - 3 * 3600 * 1000).toISOString(),
      status: 'OVERDUE',
    },
    {
      bookingId: 'bk-cash-1058',
      bookingCode: 'HC-2026-1058',
      serviceName: 'Hỗ trợ phục hồi chức năng sau tai biến',
      bookingAmount: 600000,
      commissionAmount: 90000,
      // Check-out 19 giờ trước -> còn 5 giờ để nộp
      dueAt: new Date(now + 5 * 3600 * 1000).toISOString(),
      status: 'UNPAID',
    },
    {
      bookingId: 'bk-cash-1056',
      bookingCode: 'HC-2026-1056',
      serviceName: 'Tiêm truyền thuốc & Theo dõi chỉ số sinh tồn',
      bookingAmount: 400000,
      commissionAmount: 60000,
      dueAt: new Date(now - 48 * 3600 * 1000).toISOString(),
      status: 'PAID',
      paidAt: new Date(now - 24 * 3600 * 1000).toISOString(),
    },
  ];
}

function loadDebts(): CommissionDebtDto[] {
  if (typeof window === 'undefined') return getInitialDebts();
  try {
    const raw = localStorage.getItem(COMMISSION_DEBTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fallback
  }
  const initial = getInitialDebts();
  saveDebts(initial);
  syncWalletSuspension(initial);
  return initial;
}

function saveDebts(debts: CommissionDebtDto[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMMISSION_DEBTS_STORAGE_KEY, JSON.stringify(debts));
  } catch {
    // ignore
  }
  syncWalletSuspension(debts);
}

/**
 * Đồng bộ trạng thái khóa tài khoản trong ví nếu có khoản nợ quá hạn
 */
function syncWalletSuspension(debts: CommissionDebtDto[]): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) return;
    const walletState = JSON.parse(raw);
    const hasOverdue = debts.some((d) => d.status === 'OVERDUE');

    if (hasOverdue) {
      walletState.isSuspended = true;
      walletState.suspendedReason = 'COMMISSION_OVERDUE';
    } else if (walletState.suspendedReason === 'COMMISSION_OVERDUE') {
      walletState.isSuspended = false;
      walletState.suspendedReason = null;
    }
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletState));
  } catch {
    // ignore
  }
}

/**
 * Sắp xếp các khoản nợ: Quá hạn -> Sắp hết hạn -> Đã nộp
 */
function sortDebts(items: CommissionDebtDto[]): CommissionDebtDto[] {
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
  const debts = loadDebts();
  // Tự động kiểm tra nếu có khoản UNPAID nào đã quá dueAt thì chuyển thành OVERDUE
  const now = Date.now();
  let modified = false;
  for (const d of debts) {
    if (d.status === 'UNPAID' && new Date(d.dueAt).getTime() <= now) {
      d.status = 'OVERDUE';
      modified = true;
    }
  }
  if (modified) {
    saveDebts(debts);
  }
  return sortDebts(debts);
}

export async function mockGetCommissionPaymentLink(
  bookingId: string
): Promise<CommissionPaymentLinkDto> {
  const debts = loadDebts();
  const debt = debts.find((d) => d.bookingId === bookingId || d.bookingCode === bookingId);
  if (!debt) {
    throw new Error(`Không tìm thấy khoản nợ hoa hồng cho ca ${bookingId}`);
  }

  const transferContent = `HH ${debt.bookingCode}`;
  return {
    checkoutUrl: `https://pay.carenest.vn/commission/${debt.bookingCode}`,
    qrCode: `https://api.vietqr.io/image/970422-0388998899-qr_only.png?amount=${debt.commissionAmount}&addInfo=${encodeURIComponent(transferContent)}`,
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
  const debts = loadDebts();
  const debt = debts.find((d) => d.bookingId === bookingId || d.bookingCode === bookingId);
  if (!debt) {
    throw new Error(`Không tìm thấy khoản nợ hoa hồng cho ca ${bookingId}`);
  }

  const paidAt = new Date().toISOString();
  debt.status = 'PAID';
  debt.paidAt = paidAt;

  saveDebts(debts);
  return { success: true, paidAt };
}

export function mockResetCommissionDebts(): CommissionDebtDto[] {
  const initial = getInitialDebts();
  saveDebts(initial);
  return sortDebts(initial);
}

export function mockClearAllCommissionDebts(): CommissionDebtDto[] {
  const empty: CommissionDebtDto[] = [];
  saveDebts(empty);
  return empty;
}

export function mockAddCashCommissionDebt(shift: {
  bookingId: string;
  bookingCode: string;
  serviceName: string;
  totalAmount: number;
}): CommissionDebtDto {
  const debts = loadDebts();
  const commissionAmount = Math.floor(shift.totalAmount * 0.15);
  const dueAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  const newDebt: CommissionDebtDto = {
    bookingId: shift.bookingId,
    bookingCode: shift.bookingCode,
    serviceName: shift.serviceName,
    bookingAmount: shift.totalAmount,
    commissionAmount,
    dueAt,
    status: 'UNPAID',
  };

  const filtered = debts.filter((d) => d.bookingId !== shift.bookingId);
  filtered.push(newDebt);
  saveDebts(filtered);
  return newDebt;
}
