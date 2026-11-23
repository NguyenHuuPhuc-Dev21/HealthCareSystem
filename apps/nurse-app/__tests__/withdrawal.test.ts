import {
  WithdrawalStatus,
  type BankAccountDto,
  type WithdrawalDto,
} from '@healthcare-system/shared';
import {
  formatThousandsDot,
  parseAmount,
} from '../src/features/wallet/components/AmountKeypadInput';
import {
  getWalletSummary,
  resetWalletMockState,
  setMockWalletSummary,
} from '../src/features/wallet/wallet.api';
import {
  generateUUID,
  getBankAccount,
  getMockWithdrawals,
  getWithdrawals,
  requestWithdrawal,
  resetWithdrawalMockState,
  setMockBankAccount,
  setMockWithdrawals,
  validateWithdrawalAmount,
} from '../src/features/wallet/withdrawal.api';

describe('A12 — Earnings Withdrawal Unit Tests (nurse-app)', () => {
  beforeEach(() => {
    resetWalletMockState();
    resetWithdrawalMockState();
    jest.clearAllMocks();
  });

  describe('1. Amount Validation & Keypad Formatting (N12 Spec)', () => {
    const availableBalance = 3850000;

    it('rejects amounts <= 0 with appropriate error message', () => {
      expect(validateWithdrawalAmount(0, availableBalance)).toBe(
        'Vui lòng nhập số tiền lớn hơn 0đ'
      );
      expect(validateWithdrawalAmount(-50000, availableBalance)).toBe(
        'Vui lòng nhập số tiền lớn hơn 0đ'
      );
    });

    it('rejects non-integer floating point amounts', () => {
      expect(validateWithdrawalAmount(100000.5, availableBalance)).toBe(
        'Số tiền rút phải là số nguyên'
      );
    });

    it('rejects amounts exceeding available balance (Test #1)', () => {
      const error = validateWithdrawalAmount(4000000, availableBalance);
      expect(error).not.toBeNull();
      expect(error).toContain('vượt quá số dư khả dụng');
      expect(error).toContain('3.850.000');
    });

    it('accepts valid amounts less than or equal to available balance', () => {
      expect(validateWithdrawalAmount(1000000, availableBalance)).toBeNull();
      expect(validateWithdrawalAmount(3850000, availableBalance)).toBeNull();
      expect(validateWithdrawalAmount(10000, availableBalance)).toBeNull();
    });

    it('formats thousands dot notation correctly for Vietnamese currency display', () => {
      expect(formatThousandsDot(1000000)).toBe('1.000.000');
      expect(formatThousandsDot(3850000)).toBe('3.850.000');
      expect(formatThousandsDot(50000)).toBe('50.000');
      expect(formatThousandsDot(0)).toBe('');
    });

    it('parses input text with thousand separators into clean integer', () => {
      expect(parseAmount('1.000.000')).toBe(1000000);
      expect(parseAmount('3.850.000đ')).toBe(3850000);
      expect(parseAmount('50,000')).toBe(50000);
      expect(parseAmount('')).toBe(0);
      expect(parseAmount('abc')).toBe(0);
    });
  });

  describe('2. Idempotency Key Generation (RFC 4122 v4)', () => {
    it('generates valid RFC 4122 UUID v4 strings', () => {
      const key = generateUUID();
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(key).toMatch(uuidV4Regex);
    });

    it('generates unique keys on successive calls', () => {
      const key1 = generateUUID();
      const key2 = generateUUID();
      const key3 = generateUUID();
      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });
  });

  describe('3. Bank Account & Withdrawal API Operations', () => {
    it('fetches registered bank account with masked number', async () => {
      const res = await getBankAccount();
      expect(res.success).toBe(true);
      expect(res.data).not.toBeNull();
      expect(res.data?.bankName).toBe('Vietcombank');
      expect(res.data?.accountMasked).toBe('•••• 6899');
      expect(res.data?.accountHolder).toBe('TRAN THI MAI');
    });

    it('handles empty bank account state when nurse has not registered one (Test #5)', async () => {
      setMockBankAccount(null);
      const res = await getBankAccount();
      expect(res.success).toBe(true);
      expect(res.data).toBeNull();
    });

    it('fetches existing withdrawal history with proper statuses', async () => {
      const res = await getWithdrawals();
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(3);

      const requested = res.data.find(
        (w) => w.status === WithdrawalStatus.WITHDRAW_REQUESTED
      );
      expect(requested).toBeDefined();
      expect(requested?.amount).toBe(1000000);

      const withdrawn = res.data.find(
        (w) => w.status === WithdrawalStatus.WITHDRAWN
      );
      expect(withdrawn).toBeDefined();
      expect(withdrawn?.amount).toBe(2000000);

      const rejected = res.data.find(
        (w) => w.status === WithdrawalStatus.REJECTED
      );
      expect(rejected).toBeDefined();
      expect(rejected?.amount).toBe(500000);
      expect(rejected?.rejectReason).toContain('chưa khớp hồ sơ');
    });
  });

  describe('4. Withdrawal Request & Balance Deduction (FR-PAY-04)', () => {
    it('blocks withdrawal request when amount exceeds available balance (INSUFFICIENT_BALANCE)', async () => {
      const initialSummary = await getWalletSummary();
      const available = initialSummary.data.availableBalance; // 3.850.000

      const res = await requestWithdrawal(available + 100000);
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INSUFFICIENT_BALANCE');

      // Balance remains untouched
      const summaryAfter = await getWalletSummary();
      expect(summaryAfter.data.availableBalance).toBe(available);
    });

    it('blocks withdrawal request when amount is zero or negative (INVALID_AMOUNT)', async () => {
      const resZero = await requestWithdrawal(0);
      expect(resZero.success).toBe(false);
      expect(resZero.error?.code).toBe('INVALID_AMOUNT');

      const resNegative = await requestWithdrawal(-50000);
      expect(resNegative.success).toBe(false);
      expect(resNegative.error?.code).toBe('INVALID_AMOUNT');
    });

    it('successfully creates withdrawal request, updates available balance, and adds WITHDRAW_REQUESTED item', async () => {
      const withdrawAmount = 1000000;
      const initialSummary = await getWalletSummary();
      const initialAvailable = initialSummary.data.availableBalance; // 3.850.000

      const res = await requestWithdrawal(withdrawAmount, generateUUID());
      expect(res.success).toBe(true);
      expect(res.data.withdrawal_id).toBeDefined();

      // Available balance is decremented
      const summaryAfter = await getWalletSummary();
      expect(summaryAfter.data.availableBalance).toBe(initialAvailable - withdrawAmount);

      // New withdrawal record is added to history
      const withdrawalsRes = await getWithdrawals();
      const latest = withdrawalsRes.data[0];
      expect(latest.id).toBe(res.data.withdrawal_id);
      expect(latest.amount).toBe(withdrawAmount);
      expect(latest.status).toBe(WithdrawalStatus.WITHDRAW_REQUESTED);
    });
  });

  describe('5. Idempotency Guard: Prevent Duplicate Submissions (Test #3)', () => {
    it('returns the same withdrawal_id and does not double-deduct balance when called with same idempotencyKey', async () => {
      const fixedKey = generateUUID();
      const withdrawAmount = 500000;

      const initialSummary = await getWalletSummary();
      const initialAvailable = initialSummary.data.availableBalance;
      const initialHistoryLength = (await getWithdrawals()).data.length;

      // First call
      const res1 = await requestWithdrawal(withdrawAmount, fixedKey);
      expect(res1.success).toBe(true);
      const withdrawalId = res1.data.withdrawal_id;

      // Second call with same idempotency key (e.g. nurse double tapped quickly)
      const res2 = await requestWithdrawal(withdrawAmount, fixedKey);
      expect(res2.success).toBe(true);
      expect(res2.data.withdrawal_id).toBe(withdrawalId);

      // Third call
      const res3 = await requestWithdrawal(withdrawAmount, fixedKey);
      expect(res3.success).toBe(true);
      expect(res3.data.withdrawal_id).toBe(withdrawalId);

      // Balance was only deducted ONCE
      const summaryAfter = await getWalletSummary();
      expect(summaryAfter.data.availableBalance).toBe(initialAvailable - withdrawAmount);

      // History only contains ONE new record
      const historyAfter = await getWithdrawals();
      expect(historyAfter.data.length).toBe(initialHistoryLength + 1);
    });
  });

  describe('6. Withdraw All ("Tất cả") Action (Test #2)', () => {
    it('withdraws entire available balance and leaves balance at 0 with pending request', async () => {
      const initialSummary = await getWalletSummary();
      const fullAvailable = initialSummary.data.availableBalance;
      expect(fullAvailable).toBeGreaterThan(0);

      const res = await requestWithdrawal(fullAvailable, generateUUID());
      expect(res.success).toBe(true);

      const summaryAfter = await getWalletSummary();
      expect(summaryAfter.data.availableBalance).toBe(0);

      const history = await getWithdrawals();
      expect(history.data[0].amount).toBe(fullAvailable);
      expect(history.data[0].status).toBe(WithdrawalStatus.WITHDRAW_REQUESTED);
    });
  });

  describe('7. Rejection Reason Handling (Test #4)', () => {
    it('accurately maintains rejectReason when withdrawal is rejected', async () => {
      const customRejected: WithdrawalDto = {
        id: 'wd-rejected-custom',
        amount: 800000,
        status: WithdrawalStatus.REJECTED,
        rejectReason: 'Tài khoản ngân hàng đang bị tạm khóa chiều nhận',
        requestedAt: new Date().toISOString(),
      };

      setMockWithdrawals([customRejected]);
      const res = await getWithdrawals();
      expect(res.success).toBe(true);
      expect(res.data[0].status).toBe(WithdrawalStatus.REJECTED);
      expect(res.data[0].rejectReason).toBe(
        'Tài khoản ngân hàng đang bị tạm khóa chiều nhận'
      );
    });
  });
});
