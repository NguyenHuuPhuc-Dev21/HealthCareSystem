import {
  BalanceType,
  TxStatus,
  TxType,
  WithdrawalStatus,
} from '../enums';
import type {
  BankAccountDto,
  EarningsPointDto,
  UpcomingSettlementDto,
  WalletSummaryDto,
  WalletTransactionDto,
  WithdrawalDto,
} from '../contracts/wallet.contracts';

export const INITIAL_TRANSACTIONS: WalletTransactionDto[] = [
  {
    id: 'tx-001',
    type: TxType.ESCROW_RELEASE,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.AVAILABLE,
    amount: 297500,
    bookingCode: 'HC-2026-1042',
    description: 'Quyết toán ca HC-2026-1042 (thực nhận 70% sau khi trích ký quỹ ân hạn)',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-002',
    type: TxType.DEPOSIT_WITHHOLD,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.DEPOSIT,
    amount: 127500,
    bookingCode: 'HC-2026-1042',
    description: 'Trích 30% thu nhập ca HC-2026-1042 vào ký quỹ (ân hạn)',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-003',
    type: TxType.ESCROW_RELEASE,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.AVAILABLE,
    amount: 425000,
    bookingCode: 'HC-2026-1039',
    description: 'Quyết toán ca HC-2026-1039 (Vào ví khả dụng)',
    createdAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-004',
    type: TxType.WITHDRAW,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.AVAILABLE,
    amount: -2000000,
    description: 'Rút tiền về Vietcombank •••• 6899 (Đã xử lý)',
    createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-005',
    type: TxType.COMMISSION_PAYMENT,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.AVAILABLE,
    amount: -60000,
    bookingCode: 'HC-2026-1035',
    description: 'Nộp hoa hồng 15% ca thu tiền mặt HC-2026-1035',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-006',
    type: TxType.PENALTY_DEDUCT,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.DEPOSIT,
    amount: -100000,
    bookingCode: 'HC-2026-1031',
    description: 'Phạt hủy ca gấp HC-2026-1031 (20% giá trị ca theo SLA)',
    createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-007',
    type: TxType.PENALTY_REVERSAL,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.DEPOSIT,
    amount: 100000,
    bookingCode: 'HC-2026-1031',
    description: 'Hoàn lại khoản phạt ca HC-2026-1031 sau khiếu nại thành công',
    createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-008',
    type: TxType.ESCROW_RELEASE,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.AVAILABLE,
    amount: 680000,
    bookingCode: 'HC-2026-1028',
    description: 'Quyết toán ca toàn diện HC-2026-1028',
    createdAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-009',
    type: TxType.WITHDRAW,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.AVAILABLE,
    amount: -1000000,
    description: 'Rút tiền về Vietcombank •••• 6899',
    createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-010',
    type: TxType.TOPUP,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.DEPOSIT,
    amount: 300000,
    description: 'Nạp ký quỹ qua VietQR (Đủ mức 300.000đ)',
    createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-011',
    type: TxType.ESCROW_RELEASE,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.AVAILABLE,
    amount: 425000,
    bookingCode: 'HC-2026-1020',
    description: 'Quyết toán ca phục hồi chức năng HC-2026-1020',
    createdAt: new Date(Date.now() - 12 * 24 * 3600 * 1000).toISOString(),
  },
  {
    id: 'tx-012',
    type: TxType.COMMISSION_PAYMENT,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.AVAILABLE,
    amount: -75000,
    bookingCode: 'HC-2026-1018',
    description: 'Nộp hoa hồng ca tiền mặt HC-2026-1018',
    createdAt: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
  },
];

export const INITIAL_UPCOMING_SETTLEMENTS: UpcomingSettlementDto[] = [
  {
    bookingCode: 'HC-2026-1048',
    serviceName: 'Chăm sóc người cao tuổi tại nhà (4 giờ)',
    grossAmount: 500000,
    commissionAmount: 75000,
    netAmount: 425000,
    settleAt: new Date(Date.now() + 9 * 3600 * 1000 + 12 * 60 * 1000).toISOString(),
    disputeOpen: false,
  },
];

export const INITIAL_WALLET_SUMMARY: WalletSummaryDto = {
  availableBalance: 3850000,
  escrowLockedBalance: 425000,
  depositBalance: 300000,
  minDeposit: 300000,
  isSuspended: false,
  suspendedReason: null,
  depositGraceActive: false,
};

export const INITIAL_BANK_ACCOUNT: BankAccountDto = {
  bankName: 'Vietcombank',
  accountMasked: '•••• 6899',
  accountHolder: 'TRAN THI MAI',
};

export const INITIAL_WITHDRAWALS: WithdrawalDto[] = [
  {
    id: 'wd-001',
    amount: 1000000,
    status: WithdrawalStatus.WITHDRAW_REQUESTED,
    requestedAt: '2026-11-13T08:30:00.000Z',
  },
  {
    id: 'wd-002',
    amount: 2000000,
    status: WithdrawalStatus.WITHDRAWN,
    requestedAt: '2026-10-27T10:15:00.000Z',
    processedAt: '2026-10-27T14:30:00.000Z',
  },
  {
    id: 'wd-003',
    amount: 500000,
    status: WithdrawalStatus.REJECTED,
    rejectReason: 'Tên chủ tài khoản chưa khớp hồ sơ — tiền đã hoàn về ví khả dụng',
    requestedAt: '2026-10-18T08:00:00.000Z',
    processedAt: '2026-10-18T11:20:00.000Z',
  },
];

export const INITIAL_EARNINGS_WEEK: EarningsPointDto[] = [
  { label: 'T2', amount: 350000 },
  { label: 'T3', amount: 500000 },
  { label: 'T4', amount: 425000 },
  { label: 'T5', amount: 750000 },
  { label: 'T6', amount: 850000 },
  { label: 'T7', amount: 500000 },
  { label: 'CN', amount: 200000 },
];

export const PENDING_COMMISSION_SAMPLE = {
  hasPendingCommission: true,
  bookingCode: 'HC-2026-1057',
  amount: 75000,
  hoursRemaining: 20,
  description: 'Ca tiền mặt HC-2026-1057 · 75.000đ · Còn 20 giờ — quá hạn sẽ tạm khóa nhận ca',
};

export function mapWalletSummary(raw: any): WalletSummaryDto {
  if (!raw) return INITIAL_WALLET_SUMMARY;
  return {
    availableBalance: Number(raw.availableBalance ?? raw.available_balance ?? 0),
    escrowLockedBalance: Number(raw.escrowLockedBalance ?? raw.escrow_locked_balance ?? 0),
    depositBalance: Number(raw.depositBalance ?? raw.deposit_balance ?? 0),
    minDeposit: Number(raw.minDeposit ?? raw.min_deposit ?? 300000),
    isSuspended: Boolean(raw.isSuspended ?? raw.is_suspended ?? false),
    suspendedReason: raw.suspendedReason ?? raw.suspended_reason ?? null,
    depositGraceActive: Boolean(raw.depositGraceActive ?? raw.deposit_grace_active ?? false),
  };
}

export function mapWalletTransaction(raw: any): WalletTransactionDto {
  return {
    id: String(raw.id || ''),
    type: raw.type as TxType,
    status: raw.status as TxStatus,
    balanceType: raw.balanceType ?? raw.balance_type ?? BalanceType.AVAILABLE,
    amount: Number(raw.amount ?? 0),
    bookingCode: raw.bookingCode ?? raw.booking_code,
    description: String(raw.description || ''),
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
  };
}

export function mapUpcomingSettlement(raw: any): UpcomingSettlementDto {
  return {
    bookingCode: String(raw.bookingCode ?? raw.booking_code ?? ''),
    serviceName: String(raw.serviceName ?? raw.service_name ?? ''),
    grossAmount: Number(raw.grossAmount ?? raw.gross_amount ?? 0),
    commissionAmount: Number(raw.commissionAmount ?? raw.commission_amount ?? 0),
    netAmount: Number(raw.netAmount ?? raw.net_amount ?? 0),
    settleAt: String(raw.settleAt ?? raw.settle_at ?? ''),
    disputeOpen: Boolean(raw.disputeOpen ?? raw.dispute_open ?? false),
  };
}

export interface TxTypeMeta {
  title: string;
  badgeLabel: string;
  isNegative: boolean;
}

export function getTxTypeMeta(type: TxType, bookingCode?: string): TxTypeMeta {
  switch (type) {
    case TxType.ESCROW_RELEASE:
      return {
        title: bookingCode ? `Quyết toán ca ${bookingCode}` : 'Quyết toán ca làm việc',
        badgeLabel: 'Ví khả dụng',
        isNegative: false,
      };
    case TxType.DEPOSIT_WITHHOLD:
      return {
        title: bookingCode
          ? `Giữ lại vào ký quỹ (ân hạn) ca ${bookingCode}`
          : 'Giữ lại vào ký quỹ (ân hạn)',
        badgeLabel: 'Ví ký quỹ',
        isNegative: false,
      };
    case TxType.WITHDRAW:
      return {
        title: 'Rút tiền về ngân hàng',
        badgeLabel: 'Chuyển khoản',
        isNegative: true,
      };
    case TxType.COMMISSION_PAYMENT:
      return {
        title: bookingCode
          ? `Nộp hoa hồng ca tiền mặt ${bookingCode}`
          : 'Nộp hoa hồng sàn 15%',
        badgeLabel: 'Hoa hồng ca',
        isNegative: true,
      };
    case TxType.PENALTY_DEDUCT:
      return {
        title: bookingCode ? `Phạt vi phạm SLA ca ${bookingCode}` : 'Phạt trừ ký quỹ SLA',
        badgeLabel: 'Trừ ký quỹ',
        isNegative: true,
      };
    case TxType.PENALTY_REVERSAL:
      return {
        title: bookingCode
          ? `Hoàn lại khoản phạt ca ${bookingCode}`
          : 'Hoàn lại khoản phạt ký quỹ',
        badgeLabel: 'Cộng ký quỹ',
        isNegative: false,
      };
    case TxType.TOPUP:
      return {
        title: 'Nạp ký quỹ qua VietQR',
        badgeLabel: 'Ví ký quỹ',
        isNegative: false,
      };
    case TxType.DEPOSIT_REFUND:
      return {
        title: 'Hoàn ký quỹ khi đóng tài khoản',
        badgeLabel: 'Chi hoàn',
        isNegative: false,
      };
    default:
      return {
        title: bookingCode ? `Giao dịch đơn ${bookingCode}` : 'Giao dịch ví',
        badgeLabel: 'Giao dịch',
        isNegative: false,
      };
  }
}

export interface DepositWarningResult {
  status: 'FULL' | 'BELOW_MIN' | 'GRACE';
  isWarning: boolean;
  message: string;
  actionLabel?: string;
}

export function getDepositWarningResult(summary: WalletSummaryDto): DepositWarningResult {
  if (summary.depositGraceActive) {
    return {
      status: 'GRACE',
      isWarning: false,
      message: 'Đang làm quen — chỉ nhận ca chuyển khoản',
    };
  }

  if (summary.depositBalance < summary.minDeposit) {
    return {
      status: 'BELOW_MIN',
      isWarning: true,
      message: `Ký quỹ dưới mức tối thiểu ${summary.minDeposit.toLocaleString('vi-VN')}đ`,
      actionLabel: 'Nạp ký quỹ',
    };
  }

  return {
    status: 'FULL',
    isWarning: false,
    message: 'Đã đủ mức yêu cầu · Chỉ dùng trừ phạt vi phạm cam kết (SLA)',
  };
}
