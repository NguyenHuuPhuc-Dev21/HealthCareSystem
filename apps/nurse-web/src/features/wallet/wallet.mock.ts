import {
  BalanceType,
  INITIAL_TRANSACTIONS,
  INITIAL_UPCOMING_SETTLEMENTS,
  TxStatus,
  TxType,
  WithdrawalStatus,
} from '@healthcare-system/shared';
import type {
  BankAccountDto,
  EarningsPointDto,
  Paged,
  UpcomingSettlementDto,
  WalletSummaryDto,
  WalletTransactionDto,
  WithdrawalDto,
} from '@healthcare-system/shared';
import type { WalletBalancesDto } from './wallet.api';

const WALLET_STORAGE_KEY = 'carenest_mock_wallet_v2';

interface MockWalletState {
  availableBalance: number;
  escrowLockedBalance: number;
  depositBalance: number;
  minDeposit: number;
  isSuspended: boolean;
  suspendedReason?: 'DEPOSIT_BELOW_MIN' | 'COMMISSION_OVERDUE' | 'TRUST_SCORE_LOW' | 'ACCOUNT_CLOSING' | null;
  depositGraceActive: boolean;
  bankAccount: BankAccountDto | null;
  withdrawals: WithdrawalDto[];
  transactions: WalletTransactionDto[];
  upcomingSettlements: UpcomingSettlementDto[];
  idempotencyKeys: Record<string, string>;
}

const INITIAL_WALLET_STATE: MockWalletState = {
  availableBalance: 3850000,
  escrowLockedBalance: 425000,
  depositBalance: 300000,
  minDeposit: 300000,
  isSuspended: false,
  suspendedReason: null,
  depositGraceActive: false,
  bankAccount: {
    bankName: 'Vietcombank',
    accountMasked: '•••• 6899',
    accountHolder: 'TRAN THI MAI',
  },
  withdrawals: [
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
  ],
  transactions: INITIAL_TRANSACTIONS,
  upcomingSettlements: INITIAL_UPCOMING_SETTLEMENTS,
  idempotencyKeys: {},
};

function loadWalletState(): MockWalletState {
  if (typeof window === 'undefined') return INITIAL_WALLET_STATE;
  try {
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(INITIAL_WALLET_STATE));
      return INITIAL_WALLET_STATE;
    }
    return JSON.parse(raw) as MockWalletState;
  } catch {
    return INITIAL_WALLET_STATE;
  }
}

function saveWalletState(state: MockWalletState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockGetWalletSummary(): Promise<WalletSummaryDto> {
  await delay(180);
  const state = loadWalletState();
  return {
    availableBalance: state.availableBalance,
    escrowLockedBalance: state.escrowLockedBalance,
    depositBalance: state.depositBalance,
    minDeposit: state.minDeposit,
    isSuspended: state.isSuspended,
    suspendedReason: state.suspendedReason,
    depositGraceActive: state.depositGraceActive,
  };
}

export async function mockGetWalletBalances(): Promise<WalletBalancesDto> {
  await delay(150);
  const state = loadWalletState();
  return {
    available_balance: state.availableBalance,
    escrow_locked_balance: state.escrowLockedBalance,
    deposit_balance: state.depositBalance,
  };
}

export async function mockGetBankAccount(): Promise<BankAccountDto | null> {
  await delay(150);
  const state = loadWalletState();
  return state.bankAccount;
}

export async function mockGetWithdrawals(): Promise<WithdrawalDto[]> {
  await delay(200);
  const state = loadWalletState();
  return state.withdrawals;
}

export async function mockGetUpcomingSettlements(): Promise<UpcomingSettlementDto[]> {
  await delay(150);
  const state = loadWalletState();
  return state.upcomingSettlements;
}

export async function mockGetEarnings(range: 'week' | 'month'): Promise<{
  points: EarningsPointDto[];
  totalAmount: number;
  periodLabel: string;
}> {
  await delay(180);
  if (range === 'week') {
    const points: EarningsPointDto[] = [
      { label: 'T2', amount: 350000 },
      { label: 'T3', amount: 500000 },
      { label: 'T4', amount: 425000 },
      { label: 'T5', amount: 750000 },
      { label: 'T6', amount: 850000 },
      { label: 'T7', amount: 500000 },
      { label: 'CN', amount: 200000 },
    ];
    const totalAmount = points.reduce((acc, p) => acc + p.amount, 0);
    return {
      points,
      totalAmount,
      periodLabel: 'Tuần này',
    };
  }

  const points: EarningsPointDto[] = [
    { label: 'Tuần 1', amount: 2450000 },
    { label: 'Tuần 2', amount: 3200000 },
    { label: 'Tuần 3', amount: 2850000 },
    { label: 'Tuần 4', amount: 3575000 },
  ];
  const totalAmount = points.reduce((acc, p) => acc + p.amount, 0);
  return {
    points,
    totalAmount,
    periodLabel: 'Tháng 11/2026',
  };
}

export async function mockGetWalletTransactions(params?: {
  type?: string;
  cursor?: string;
  pageSize?: number;
}): Promise<Paged<WalletTransactionDto>> {
  await delay(200);
  const state = loadWalletState();
  const pageSize = params?.pageSize || 6;
  const startIndex = params?.cursor ? parseInt(params.cursor, 10) : 0;

  let filtered = state.transactions;
  if (params?.type && params.type !== 'ALL') {
    if (params.type === 'SETTLE') {
      filtered = filtered.filter(
        (tx) => tx.type === TxType.ESCROW_RELEASE || tx.type === TxType.DEPOSIT_WITHHOLD
      );
    } else if (params.type === 'PENALTY') {
      filtered = filtered.filter(
        (tx) => tx.type === TxType.PENALTY_DEDUCT || tx.type === TxType.PENALTY_REVERSAL
      );
    } else if (params.type === 'WITHDRAW') {
      filtered = filtered.filter((tx) => tx.type === TxType.WITHDRAW);
    } else if (params.type === 'DEPOSIT') {
      filtered = filtered.filter(
        (tx) =>
          tx.type === TxType.TOPUP ||
          tx.type === TxType.DEPOSIT_WITHHOLD ||
          tx.type === TxType.DEPOSIT_REFUND ||
          tx.type === TxType.PENALTY_DEDUCT ||
          tx.type === TxType.PENALTY_REVERSAL
      );
    } else {
      filtered = filtered.filter((tx) => tx.type === (params.type as TxType));
    }
  }

  const slice = filtered.slice(startIndex, startIndex + pageSize);
  const nextIndex = startIndex + pageSize;
  const nextCursor = nextIndex < filtered.length ? String(nextIndex) : null;

  return {
    items: slice,
    nextCursor,
  };
}

export async function mockRequestWithdrawal(
  amount: number,
  idempotencyKey?: string
): Promise<{ withdrawal_id: string }> {
  await delay(350);
  const state = loadWalletState();

  if (idempotencyKey && state.idempotencyKeys[idempotencyKey]) {
    return { withdrawal_id: state.idempotencyKeys[idempotencyKey] };
  }

  if (amount > state.availableBalance) {
    const error: any = new Error('Số dư khả dụng không đủ để thực hiện yêu cầu rút tiền');
    error.code = 'INSUFFICIENT_BALANCE';
    throw error;
  }

  if (amount <= 0 || !Number.isInteger(amount)) {
    const error: any = new Error('Số tiền rút phải là số nguyên dương hợp lệ');
    error.code = 'INVALID_AMOUNT';
    throw error;
  }

  const withdrawalId = `wd-${Date.now()}`;
  const newWithdrawal: WithdrawalDto = {
    id: withdrawalId,
    amount,
    status: WithdrawalStatus.WITHDRAW_REQUESTED,
    requestedAt: new Date().toISOString(),
  };

  const newTx: WalletTransactionDto = {
    id: `tx-${Date.now()}`,
    type: TxType.WITHDRAW,
    status: TxStatus.COMPLETED,
    balanceType: BalanceType.AVAILABLE,
    amount: -amount,
    description: `Rút tiền về ${state.bankAccount?.bankName || 'ngân hàng'} ${state.bankAccount?.accountMasked || ''}`,
    createdAt: new Date().toISOString(),
  };

  state.availableBalance -= amount;
  state.withdrawals = [newWithdrawal, ...state.withdrawals];
  state.transactions = [newTx, ...state.transactions];
  if (idempotencyKey) {
    state.idempotencyKeys[idempotencyKey] = withdrawalId;
  }

  saveWalletState(state);
  return { withdrawal_id: withdrawalId };
}

/** Mock helper to switch deposit scenario for manual testing (Test #2) */
export function mockSetDepositScenario(
  scenario: 'FULL' | 'SHORTFALL_180K' | 'GRACE_ACTIVE'
): void {
  const state = loadWalletState();
  if (scenario === 'SHORTFALL_180K') {
    state.depositBalance = 180000;
    state.depositGraceActive = false;
    state.isSuspended = false;
    state.suspendedReason = null;
  } else if (scenario === 'GRACE_ACTIVE') {
    state.depositBalance = 180000;
    state.depositGraceActive = true;
    state.isSuspended = false;
    state.suspendedReason = null;
  } else {
    state.depositBalance = 300000;
    state.depositGraceActive = false;
    state.isSuspended = false;
    state.suspendedReason = null;
  }
  saveWalletState(state);
}

export function mockResetWallet(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(INITIAL_WALLET_STATE));
}
