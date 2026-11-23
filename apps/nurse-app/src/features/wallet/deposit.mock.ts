import {
  DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
  DEFAULT_DEPOSIT_REFUND_HOLD_DAYS,
  DEFAULT_DEPOSIT_WITHHOLD_RATE,
  DEFAULT_MIN_NURSE_DEPOSIT_VND,
  DepositRefundStatus,
  PenaltyReason,
  TxStatus,
} from '@healthcare-system/shared';
import type {
  AppealPenaltyRequest,
  DepositPenaltyDto,
  DepositRefundRequestDto,
  DepositStatusDto,
  DepositTopupLinkDto,
} from '@healthcare-system/shared';
import { env } from '../../lib/env';

export type MockDepositScenario = 'full' | 'grace' | 'expired' | 'closing';

export interface MockDepositState {
  scenario: MockDepositScenario;
  depositBalance: number;
  minDeposit: number;
  grace: {
    active: boolean;
    shiftsUsed: number;
    maxShifts: number;
    expiresAt: string | null;
    withholdRate: number;
  };
  canAcceptCash: boolean;
  canAcceptTransfer: boolean;
  custodyPartnerName: string;
  totalWithheld: number;
  penalties: DepositPenaltyDto[];
  refundRequest: DepositRefundRequestDto | null;
}

export function getInitialDepositState(scenario: MockDepositScenario = env.mockDepositScenario): MockDepositState {
  if (scenario === 'grace') {
    return {
      scenario: 'grace',
      depositBalance: 127500,
      minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
      grace: {
        active: true,
        shiftsUsed: 1,
        maxShifts: DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
        expiresAt: new Date(Date.now() + 22 * 24 * 3600 * 1000).toISOString(),
        withholdRate: DEFAULT_DEPOSIT_WITHHOLD_RATE,
      },
      canAcceptCash: false,
      canAcceptTransfer: true,
      custodyPartnerName: 'BIDV — CN Sở Giao Dịch 1 (Lưu ký CareNest)',
      totalWithheld: 127500,
      penalties: [],
      refundRequest: null,
    };
  }

  if (scenario === 'expired') {
    return {
      scenario: 'expired',
      depositBalance: 255000,
      minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
      grace: {
        active: false,
        shiftsUsed: 3,
        maxShifts: DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
        expiresAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        withholdRate: DEFAULT_DEPOSIT_WITHHOLD_RATE,
      },
      canAcceptCash: false,
      canAcceptTransfer: false,
      custodyPartnerName: 'BIDV — CN Sở Giao Dịch 1 (Lưu ký CareNest)',
      totalWithheld: 255000,
      penalties: [],
      refundRequest: null,
    };
  }

  if (scenario === 'closing') {
    return {
      scenario: 'closing',
      depositBalance: DEFAULT_MIN_NURSE_DEPOSIT_VND,
      minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
      grace: {
        active: false,
        shiftsUsed: 3,
        maxShifts: DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
        expiresAt: null,
        withholdRate: DEFAULT_DEPOSIT_WITHHOLD_RATE,
      },
      canAcceptCash: false,
      canAcceptTransfer: false,
      custodyPartnerName: 'BIDV — CN Sở Giao Dịch 1 (Lưu ký CareNest)',
      totalWithheld: 0,
      penalties: [],
      refundRequest: {
        id: 'refund-req-001',
        status: DepositRefundStatus.WAITING_HOLD,
        pendingReasons: ['HOLD_DAYS', 'UNPAID_COMMISSION'],
        eligibleAt: new Date(Date.now() + DEFAULT_DEPOSIT_REFUND_HOLD_DAYS * 24 * 3600 * 1000).toISOString(),
        refundAmount: DEFAULT_MIN_NURSE_DEPOSIT_VND,
        debtAmount: 0,
        bankAccount: {
          bankName: 'Vietcombank',
          accountMasked: '•••• 6899',
          accountHolder: 'TRAN THI MAI',
        },
        dueBy: null,
        requestedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  // Default: 'full' (đủ 300.000đ)
  return {
    scenario: 'full',
    depositBalance: DEFAULT_MIN_NURSE_DEPOSIT_VND,
    minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
    grace: {
      active: false,
      shiftsUsed: 3,
      maxShifts: DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
      expiresAt: null,
      withholdRate: DEFAULT_DEPOSIT_WITHHOLD_RATE,
    },
    canAcceptCash: true,
    canAcceptTransfer: true,
    custodyPartnerName: 'BIDV — CN Sở Giao Dịch 1 (Lưu ký CareNest)',
    totalWithheld: 0,
    penalties: [
      {
        transactionId: 'pen-tx-001',
        amount: 100000,
        reason: PenaltyReason.NURSE_LATE_CANCEL,
        slaRuleRef: 'SRS §5.2 dòng 7',
        bookingId: 'bk-1031',
        bookingCode: 'HC-2026-1031',
        note: 'Hủy ca gấp 2 giờ trước ca trực để xử lý việc riêng',
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        appealDeadline: null,
        reversed: true,
      },
      {
        transactionId: 'pen-tx-002',
        amount: 50000,
        reason: PenaltyReason.NURSE_LATE_CANCEL,
        slaRuleRef: 'SRS §5.2 dòng 7',
        bookingId: 'bk-1045',
        bookingCode: 'HC-2026-1045',
        note: 'Hủy ca trước 4 giờ do xe hỏng',
        createdAt: new Date(Date.now() - 19 * 3600 * 1000).toISOString(),
        // Còn hạn khiếu nại (3 ngày)
        appealDeadline: new Date(Date.now() + 2 * 24 * 3600 * 1000 + 5 * 3600 * 1000).toISOString(),
        reversed: false,
      },
    ],
    refundRequest: null,
  };
}

let activeDepositState: MockDepositState = getInitialDepositState();

export function resetDepositMockState(): void {
  activeDepositState = getInitialDepositState();
  activeTopup = null;
}

export function mockSetDepositScenario(scenario: MockDepositScenario): void {
  activeDepositState = getInitialDepositState(scenario);
  activeTopup = null;
}

export function getMockDepositState(): MockDepositState {
  return activeDepositState;
}

export function patchMockDepositState(patch: Partial<MockDepositState>): void {
  activeDepositState = { ...activeDepositState, ...patch };
}

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockGetDepositStatus(): Promise<DepositStatusDto & { totalWithheld?: number }> {
  await delay();
  const shortfall = Math.max(activeDepositState.minDeposit - activeDepositState.depositBalance, 0);

  return {
    depositBalance: activeDepositState.depositBalance,
    minDeposit: activeDepositState.minDeposit,
    shortfall,
    grace: { ...activeDepositState.grace },
    canAcceptCash: activeDepositState.canAcceptCash,
    canAcceptTransfer: activeDepositState.canAcceptTransfer,
    custodyPartnerName: activeDepositState.custodyPartnerName,
    totalWithheld: activeDepositState.totalWithheld,
  };
}

let activeTopup: { topupId: string; amount: number; checksCount: number } | null = null;

export async function mockCreateDepositTopupLink(amount: number): Promise<DepositTopupLinkDto> {
  await delay();
  const shortfall = Math.max(activeDepositState.minDeposit - activeDepositState.depositBalance, 0);

  if (amount > shortfall) {
    const error: any = new Error(
      `Ký quỹ chỉ cần đủ ${activeDepositState.minDeposit.toLocaleString('vi-VN')} đ (tối đa ${shortfall.toLocaleString('vi-VN')} đ)`
    );
    error.code = 'TOPUP_EXCEEDS_SHORTFALL';
    throw error;
  }

  if (amount < 10000) {
    const error: any = new Error('Số tiền nạp tối thiểu là 10.000 đ');
    error.code = 'AMOUNT_TOO_SMALL';
    throw error;
  }

  const topupId = `topup-${Date.now()}`;
  activeTopup = { topupId, amount, checksCount: 0 };
  const transferContent = `KQ NURSE123 ${topupId.toUpperCase().slice(-8)}`;

  return {
    topupId,
    amount,
    qrImageUrl: `https://img.vietqr.io/image/970418-12410006899999-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(
      transferContent
    )}&accountName=CARENEST%20CUSTODY`,
    bankName: 'BIDV — CN Sở Giao Dịch 1 (Lưu ký CareNest)',
    accountNumber: '12410006899999',
    transferContent,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

export async function mockGetTopupStatus(topupId: string): Promise<{ status: TxStatus }> {
  await delay();
  if (!activeTopup || activeTopup.topupId !== topupId) {
    return { status: TxStatus.PENDING };
  }

  activeTopup.checksCount += 1;

  // Thành công sau 3 lần hỏi trạng thái
  if (activeTopup.checksCount >= 3) {
    activeDepositState.depositBalance = Math.min(
      activeDepositState.minDeposit,
      activeDepositState.depositBalance + activeTopup.amount
    );
    if (activeDepositState.depositBalance >= activeDepositState.minDeposit) {
      activeDepositState.canAcceptCash = true;
      activeDepositState.canAcceptTransfer = true;
      activeDepositState.grace.active = false;
    }
    activeTopup = null;
    return { status: TxStatus.COMPLETED };
  }

  return { status: TxStatus.PENDING };
}

export async function mockGetDepositPenalties(): Promise<DepositPenaltyDto[]> {
  await delay();
  return [...activeDepositState.penalties];
}

export async function mockAppealPenalty(
  txId: string,
  body: AppealPenaltyRequest
): Promise<{ disputeId: string }> {
  await delay();
  const penalty = activeDepositState.penalties.find((p) => p.transactionId === txId);

  if (!penalty) {
    const error: any = new Error('Không tìm thấy khoản phạt');
    error.code = 'PENALTY_NOT_FOUND';
    throw error;
  }

  if (!penalty.appealDeadline) {
    const error: any = new Error('Khoản trừ này không thể khiếu nại');
    error.code = 'NOT_APPEALABLE';
    throw error;
  }

  if (new Date(penalty.appealDeadline).getTime() < Date.now()) {
    const error: any = new Error('Đã hết thời hạn khiếu nại khoản phạt này (quá 3 ngày)');
    error.code = 'APPEAL_WINDOW_CLOSED';
    throw error;
  }

  if (body.reason.trim().length < 20) {
    const error: any = new Error('Lý do khiếu nại phải có ít nhất 20 ký tự');
    error.code = 'INVALID_REASON';
    throw error;
  }

  const disputeId = `disp-${Date.now()}`;
  penalty.appealDisputeId = disputeId;
  return { disputeId };
}

export async function mockGetRefundRequest(): Promise<DepositRefundRequestDto | null> {
  await delay();
  return activeDepositState.refundRequest ? { ...activeDepositState.refundRequest } : null;
}

export async function mockRequestAccountClosure(): Promise<DepositRefundRequestDto> {
  await delay();

  if (activeDepositState.refundRequest && activeDepositState.refundRequest.status !== DepositRefundStatus.CANCELLED) {
    const error: any = new Error('Bạn đang có một yêu cầu hoàn ký quỹ đang mở');
    error.code = 'REFUND_REQUEST_OPEN';
    throw error;
  }

  const newReq: DepositRefundRequestDto = {
    id: `refund-${Date.now()}`,
    status: DepositRefundStatus.WAITING_HOLD,
    pendingReasons: ['HOLD_DAYS'],
    eligibleAt: new Date(Date.now() + DEFAULT_DEPOSIT_REFUND_HOLD_DAYS * 24 * 3600 * 1000).toISOString(),
    refundAmount: Math.max(activeDepositState.depositBalance, 0),
    debtAmount: activeDepositState.depositBalance < 0 ? Math.abs(activeDepositState.depositBalance) : 0,
    bankAccount: {
      bankName: 'Vietcombank',
      accountMasked: '•••• 6899',
      accountHolder: 'TRAN THI MAI',
    },
    dueBy: null,
    requestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  activeDepositState.refundRequest = newReq;
  activeDepositState.canAcceptCash = false;
  activeDepositState.canAcceptTransfer = false;

  return { ...newReq };
}

export async function mockCancelRefundRequest(id: string): Promise<{ success: boolean }> {
  await delay();

  if (!activeDepositState.refundRequest || activeDepositState.refundRequest.id !== id) {
    const error: any = new Error('Không tìm thấy yêu cầu hoàn ký quỹ');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (activeDepositState.refundRequest.status === DepositRefundStatus.READY) {
    const error: any = new Error('Yêu cầu đã ở trạng thái Sẵn sàng hoàn, không thể hủy');
    error.code = 'CANNOT_CANCEL_READY';
    throw error;
  }

  activeDepositState.refundRequest = null;
  if (activeDepositState.depositBalance >= activeDepositState.minDeposit) {
    activeDepositState.canAcceptCash = true;
    activeDepositState.canAcceptTransfer = true;
  } else if (activeDepositState.grace.active) {
    activeDepositState.canAcceptTransfer = true;
  }

  return { success: true };
}
