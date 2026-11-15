import { WithdrawalStatus } from '@healthcare-system/shared';
import type { BankAccountDto, WithdrawalDto } from '@healthcare-system/shared';
import type { WalletBalancesDto } from './wallet.api';

const WALLET_STORAGE_KEY = 'carenest_mock_wallet_v1';

interface MockWalletState {
  balances: WalletBalancesDto;
  bankAccount: BankAccountDto | null;
  withdrawals: WithdrawalDto[];
  idempotencyKeys: Record<string, string>; // idempotencyKey -> withdrawal_id
}

const INITIAL_WALLET_STATE: MockWalletState = {
  balances: {
    available_balance: 3850000,
    escrow_locked_balance: 500000,
    deposit_balance: 300000,
  },
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

export async function mockGetWalletBalances(): Promise<WalletBalancesDto> {
  await delay(180);
  const state = loadWalletState();
  return state.balances;
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

export async function mockRequestWithdrawal(
  amount: number,
  idempotencyKey?: string
): Promise<{ withdrawal_id: string }> {
  await delay(350);
  const state = loadWalletState();

  // Check idempotency key to prevent double submissions
  if (idempotencyKey && state.idempotencyKeys[idempotencyKey]) {
    return { withdrawal_id: state.idempotencyKeys[idempotencyKey] };
  }

  // Validate balance
  if (amount > state.balances.available_balance) {
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

  state.balances.available_balance -= amount;
  state.withdrawals = [newWithdrawal, ...state.withdrawals];
  if (idempotencyKey) {
    state.idempotencyKeys[idempotencyKey] = withdrawalId;
  }

  saveWalletState(state);
  return { withdrawal_id: withdrawalId };
}

export function mockResetWallet(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(INITIAL_WALLET_STATE));
}

