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

const DEPOSIT_STORAGE_KEY = 'carenest_mock_deposit_v1';

export type MockDepositScenario = 'full' | 'grace' | 'expired' | 'closing';

interface MockDepositState {
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

function getInitialState(scenario: MockDepositScenario = 'full'): MockDepositState {
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
      custodyPartnerName: 'Ngân hàng đối tác (mô phỏng)',
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
      custodyPartnerName: 'Ngân hàng đối tác (mô phỏng)',
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
      custodyPartnerName: 'Ngân hàng đối tác (mô phỏng)',
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
    custodyPartnerName: 'Ngân hàng đối tác (mô phỏng)',
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
        // Còn hạn khiếu nại (còn khoảng 2 ngày 5 giờ trong 3 ngày)
        appealDeadline: new Date(Date.now() + 2 * 24 * 3600 * 1000 + 5 * 3600 * 1000).toISOString(),
        reversed: false,
      },
    ],
    refundRequest: null,
  };
}

function detectUrlScenario(): MockDepositScenario | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const q = params.get('mockDeposit');
  if (q === 'full' || q === 'grace' || q === 'expired' || q === 'closing') {
    return q;
  }
  return null;
}

function loadState(): MockDepositState {
  const urlScenario = detectUrlScenario();
  if (urlScenario) {
    const s = getInitialState(urlScenario);
    saveState(s);
    return s;
  }

  if (typeof window === 'undefined') return getInitialState('full');
  try {
    const raw = localStorage.getItem(DEPOSIT_STORAGE_KEY);
    if (!raw) {
      const s = getInitialState('full');
      localStorage.setItem(DEPOSIT_STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw) as MockDepositState;
  } catch {
    return getInitialState('full');
  }
}

function saveState(state: MockDepositState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEPOSIT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockGetDepositStatus(): Promise<DepositStatusDto & { totalWithheld?: number }> {
  await delay(180);
  const state = loadState();
  const shortfall = Math.max(state.minDeposit - state.depositBalance, 0);

  return {
    depositBalance: state.depositBalance,
    minDeposit: state.minDeposit,
    shortfall,
    grace: state.grace,
    canAcceptCash: state.canAcceptCash,
    canAcceptTransfer: state.canAcceptTransfer,
    custodyPartnerName: state.custodyPartnerName,
    totalWithheld: state.totalWithheld,
  };
}

let activeTopup: { topupId: string; amount: number; checksCount: number } | null = null;

export async function mockCreateDepositTopupLink(amount: number): Promise<DepositTopupLinkDto> {
  await delay(250);
  const state = loadState();
  const shortfall = Math.max(state.minDeposit - state.depositBalance, 0);

  if (amount > shortfall) {
    const error: any = new Error(`Ký quỹ chỉ cần đủ ${state.minDeposit.toLocaleString('vi-VN')} đ (tối đa ${shortfall.toLocaleString('vi-VN')} đ)`);
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

  return {
    topupId,
    amount,
    qrImageUrl: '',
    bankName: 'BIDV — CN Sở Giao Dịch 1 (Lưu ký CareNest)',
    accountNumber: '12410006899999',
    transferContent: `KQ NURSE123 ${topupId.toUpperCase().slice(-8)}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

export async function mockGetTopupStatus(topupId: string): Promise<{ status: TxStatus }> {
  await delay(150);
  if (!activeTopup || activeTopup.topupId !== topupId) {
    return { status: TxStatus.PENDING };
  }

  activeTopup.checksCount += 1;

  // Thành công sau 3 lần hỏi trạng thái (khoảng 15s)
  if (activeTopup.checksCount >= 3) {
    const state = loadState();
    state.depositBalance = Math.min(state.minDeposit, state.depositBalance + activeTopup.amount);
    if (state.depositBalance >= state.minDeposit) {
      state.canAcceptCash = true;
      state.canAcceptTransfer = true;
      state.grace.active = false;
    }
    saveState(state);
    activeTopup = null;
    return { status: TxStatus.COMPLETED };
  }

  return { status: TxStatus.PENDING };
}

export async function mockGetDepositPenalties(): Promise<DepositPenaltyDto[]> {
  await delay(180);
  const state = loadState();
  return state.penalties;
}

export async function mockAppealPenalty(
  txId: string,
  body: AppealPenaltyRequest
): Promise<{ disputeId: string }> {
  await delay(300);
  const state = loadState();
  const penalty = state.penalties.find((p) => p.transactionId === txId);

  if (!penalty) {
    const error: any = new Error('Không tìm thấy khoản phạt');
    error.code = 'PENALTY_NOT_FOUND';
    throw error;
  }

  if (!penalty.appealDeadline || new Date(penalty.appealDeadline).getTime() < Date.now()) {
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
  saveState(state);

  return { disputeId };
}

export async function mockGetRefundRequest(): Promise<DepositRefundRequestDto | null> {
  await delay(150);
  const state = loadState();
  return state.refundRequest;
}

export async function mockRequestAccountClosure(): Promise<DepositRefundRequestDto> {
  await delay(300);
  const state = loadState();

  if (state.refundRequest && state.refundRequest.status !== DepositRefundStatus.CANCELLED) {
    const error: any = new Error('Bạn đang có một yêu cầu hoàn ký quỹ đang mở');
    error.code = 'REFUND_REQUEST_OPEN';
    throw error;
  }

  const newReq: DepositRefundRequestDto = {
    id: `refund-${Date.now()}`,
    status: DepositRefundStatus.WAITING_HOLD,
    pendingReasons: ['HOLD_DAYS'],
    eligibleAt: new Date(Date.now() + DEFAULT_DEPOSIT_REFUND_HOLD_DAYS * 24 * 3600 * 1000).toISOString(),
    refundAmount: Math.max(state.depositBalance, 0),
    debtAmount: state.depositBalance < 0 ? Math.abs(state.depositBalance) : 0,
    bankAccount: {
      bankName: 'Vietcombank',
      accountMasked: '•••• 6899',
      accountHolder: 'TRAN THI MAI',
    },
    dueBy: null,
    requestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.refundRequest = newReq;
  state.canAcceptCash = false;
  state.canAcceptTransfer = false;
  saveState(state);

  return newReq;
}

export async function mockCancelRefundRequest(id: string): Promise<{ success: boolean }> {
  await delay(250);
  const state = loadState();

  if (!state.refundRequest || state.refundRequest.id !== id) {
    const error: any = new Error('Không tìm thấy yêu cầu hoàn ký quỹ');
    error.code = 'NOT_FOUND';
    throw error;
  }

  if (state.refundRequest.status === DepositRefundStatus.READY) {
    const error: any = new Error('Yêu cầu đã ở trạng thái Sẵn sàng hoàn, không thể hủy');
    error.code = 'CANNOT_CANCEL_READY';
    throw error;
  }

  state.refundRequest = null;
  if (state.depositBalance >= state.minDeposit) {
    state.canAcceptCash = true;
    state.canAcceptTransfer = true;
  } else if (state.grace.active) {
    state.canAcceptTransfer = true;
  }
  saveState(state);

  return { success: true };
}

export function mockSetDepositScenario(scenario: MockDepositScenario): void {
  const s = getInitialState(scenario);
  saveState(s);
}
