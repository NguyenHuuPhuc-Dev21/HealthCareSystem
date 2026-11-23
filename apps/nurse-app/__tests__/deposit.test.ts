import {
  DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
  DEFAULT_DEPOSIT_WITHHOLD_RATE,
  DEFAULT_MIN_NURSE_DEPOSIT_VND,
  DepositRefundStatus,
  MoneyHelper,
  PENDING_REASON_LABELS,
  PENALTY_REASON_LABELS,
  PenaltyReason,
  REFUND_STATUS_LABELS,
  TxStatus,
  type DepositRefundPendingReason,
  type DepositRefundRequestDto,
  type DepositStatusDto,
} from '@healthcare-system/shared';
import { getDepositBannerMeta } from '../src/components/AppBanner';
import {
  appealPenalty,
  cancelRefundRequest,
  createDepositTopupLink,
  getDepositPenalties,
  getDepositStatus,
  getRefundRequest,
  getTopupStatus,
  requestAccountClosure,
} from '../src/features/wallet/deposit.api';
import {
  mockSetDepositScenario,
  patchMockDepositState,
  resetDepositMockState,
} from '../src/features/wallet/deposit.mock';
import { handleDepositNotificationNavigation } from '../src/lib/push';

describe('A10 — Nurse Deposit & Custody Hardening Unit Tests (nurse-app)', () => {
  beforeEach(() => {
    resetDepositMockState();
    jest.clearAllMocks();
  });

  describe('1. Shortfall Calculation & Topup Validation', () => {
    it('calculates shortfall correctly for partial balance', async () => {
      mockSetDepositScenario('expired'); // depositBalance = 255.000đ
      const res = await getDepositStatus();
      expect(res.success).toBe(true);
      expect(res.data.depositBalance).toBe(255000);
      expect(res.data.shortfall).toBe(45000);
    });

    it('blocks top-up amount exceeding the shortfall (TOPUP_EXCEEDS_SHORTFALL)', async () => {
      mockSetDepositScenario('expired'); // shortfall = 45.000đ
      const res = await createDepositTopupLink(50000); // 50k > 45k
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('TOPUP_EXCEEDS_SHORTFALL');
    });

    it('blocks top-up amount smaller than minimum 10.000đ (AMOUNT_TOO_SMALL)', async () => {
      mockSetDepositScenario('grace');
      const res = await createDepositTopupLink(5000);
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('AMOUNT_TOO_SMALL');
    });

    it('successfully generates topup link when amount <= shortfall', async () => {
      mockSetDepositScenario('expired'); // shortfall = 45.000đ
      const res = await createDepositTopupLink(45000);
      expect(res.success).toBe(true);
      expect(res.data.amount).toBe(45000);
      expect(res.data.bankName).toContain('BIDV');
      expect(res.data.transferContent).toContain('KQ NURSE123');
    });
  });

  describe('2. Banner Type Selection from DepositStatusDto (W02 step 8)', () => {
    it('selects danger (red) banner when deposit is below min and grace expired', () => {
      const status: DepositStatusDto = {
        depositBalance: 255000,
        minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
        shortfall: 45000,
        grace: {
          active: false,
          shiftsUsed: 3,
          maxShifts: DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
          expiresAt: null,
          withholdRate: DEFAULT_DEPOSIT_WITHHOLD_RATE,
        },
        canAcceptCash: false,
        canAcceptTransfer: false,
      };

      const meta = getDepositBannerMeta(status, null);
      expect(meta).not.toBeNull();
      expect(meta?.kind).toBe('danger');
      expect(meta?.title).toContain('Chưa đủ ký quỹ');
      expect(meta?.actionRoute).toBe('Deposit');
    });

    it('selects info (blue/jade) banner when in grace period', () => {
      const status: DepositStatusDto = {
        depositBalance: 127500,
        minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
        shortfall: 172500,
        grace: {
          active: true,
          shiftsUsed: 1,
          maxShifts: DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
          expiresAt: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
          withholdRate: DEFAULT_DEPOSIT_WITHHOLD_RATE,
        },
        canAcceptCash: false,
        canAcceptTransfer: true,
      };

      const meta = getDepositBannerMeta(status, null);
      expect(meta).not.toBeNull();
      expect(meta?.kind).toBe('info');
      expect(meta?.title).toContain('Đang làm quen');
      expect(meta?.actionRoute).toBe('Deposit');
    });

    it('selects neutral (gray) banner when account closure / refund is in progress', () => {
      const status: DepositStatusDto = {
        depositBalance: DEFAULT_MIN_NURSE_DEPOSIT_VND,
        minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
        shortfall: 0,
        grace: {
          active: false,
          shiftsUsed: 3,
          maxShifts: DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
          expiresAt: null,
          withholdRate: DEFAULT_DEPOSIT_WITHHOLD_RATE,
        },
        canAcceptCash: false,
        canAcceptTransfer: false,
      };

      const refundReq: DepositRefundRequestDto = {
        id: 'ref-1',
        status: DepositRefundStatus.WAITING_HOLD,
        pendingReasons: ['HOLD_DAYS'],
        eligibleAt: null,
        refundAmount: 300000,
        debtAmount: 0,
        bankAccount: { bankName: 'Vietcombank', accountMasked: '•••• 6899', accountHolder: 'MAI' },
        dueBy: null,
        requestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const meta = getDepositBannerMeta(status, refundReq);
      expect(meta).not.toBeNull();
      expect(meta?.kind).toBe('neutral');
      expect(meta?.title).toContain('Đang xử lý ngừng hợp tác');
      expect(meta?.actionRoute).toBe('AccountClosure');
    });

    it('returns null banner when deposit is full and compliant', () => {
      const status: DepositStatusDto = {
        depositBalance: DEFAULT_MIN_NURSE_DEPOSIT_VND,
        minDeposit: DEFAULT_MIN_NURSE_DEPOSIT_VND,
        shortfall: 0,
        grace: {
          active: false,
          shiftsUsed: 3,
          maxShifts: DEFAULT_DEPOSIT_GRACE_MAX_SHIFTS,
          expiresAt: null,
          withholdRate: DEFAULT_DEPOSIT_WITHHOLD_RATE,
        },
        canAcceptCash: true,
        canAcceptTransfer: true,
      };

      const meta = getDepositBannerMeta(status, null);
      expect(meta).toBeNull();
    });
  });

  describe('3. Vietnamese Labels for all PenaltyReason, DepositRefundStatus, DepositRefundPendingReason', () => {
    it('has complete non-empty Vietnamese labels for all PenaltyReason keys', () => {
      const allReasons = Object.values(PenaltyReason);
      expect(allReasons.length).toBeGreaterThan(0);
      for (const reason of allReasons) {
        const label = PENALTY_REASON_LABELS[reason];
        expect(typeof label).toBe('string');
        expect(label.trim().length).toBeGreaterThan(0);
      }
    });

    it('has complete non-empty Vietnamese labels for all DepositRefundStatus keys', () => {
      const allStatuses = Object.values(DepositRefundStatus);
      expect(allStatuses.length).toBeGreaterThan(0);
      for (const st of allStatuses) {
        const label = REFUND_STATUS_LABELS[st];
        expect(typeof label).toBe('string');
        expect(label.trim().length).toBeGreaterThan(0);
      }
    });

    it('has complete non-empty Vietnamese labels for all DepositRefundPendingReason keys', () => {
      const expectedReasons: DepositRefundPendingReason[] = [
        'ACTIVE_BOOKING',
        'HOLD_DAYS',
        'OPEN_DISPUTE',
        'UNPAID_COMMISSION',
      ];
      for (const reason of expectedReasons) {
        const label = PENDING_REASON_LABELS[reason];
        expect(typeof label).toBe('string');
        expect(label.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('4. Appeal Button State by appealDeadline and reversed', () => {
    it('allows appeal when appealDeadline is in future and not reversed', async () => {
      mockSetDepositScenario('full');
      const penaltiesRes = await getDepositPenalties();
      const pen = penaltiesRes.data.find((p) => p.transactionId === 'pen-tx-002');
      expect(pen).toBeDefined();

      const res = await appealPenalty('pen-tx-002', {
        reason: 'Xe máy bị thủng lốp trên đường đi trực nên không kịp đến ca.',
      });
      expect(res.success).toBe(true);
      expect(res.data.disputeId).toMatch(/^disp-/);
    });

    it('rejects appeal when reason is shorter than 20 characters (INVALID_REASON)', async () => {
      mockSetDepositScenario('full');
      const res = await appealPenalty('pen-tx-002', {
        reason: 'Xe hỏng',
      });
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('INVALID_REASON');
    });

    it('rejects appeal when deadline is null (NOT_APPEALABLE)', async () => {
      mockSetDepositScenario('full');
      const res = await appealPenalty('pen-tx-001', {
        reason: 'Tôi muốn khiếu nại khoản phạt này vì có việc đột xuất.',
      });
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('NOT_APPEALABLE');
    });

    it('rejects appeal when deadline has expired (APPEAL_WINDOW_CLOSED)', async () => {
      mockSetDepositScenario('full');
      // Set deadline to past
      patchMockDepositState({
        penalties: [
          {
            transactionId: 'pen-tx-expired',
            amount: 50000,
            reason: PenaltyReason.NURSE_LATE_CANCEL,
            slaRuleRef: 'SRS §5.2',
            createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
            appealDeadline: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
            reversed: false,
          },
        ],
      });

      const res = await appealPenalty('pen-tx-expired', {
        reason: 'Tôi muốn khiếu nại khoản phạt này vì có việc đột xuất.',
      });
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('APPEAL_WINDOW_CLOSED');
    });
  });

  describe('5. Topup Status Polling & Balance Settlement', () => {
    it('transitions topup status from PENDING to COMPLETED after 3 checks and credits deposit', async () => {
      mockSetDepositScenario('expired'); // balance = 255.000đ, shortfall = 45.000đ
      const linkRes = await createDepositTopupLink(45000);
      const topupId = linkRes.data.topupId;

      // Check 1: PENDING
      const c1 = await getTopupStatus(topupId);
      expect(c1.data.status).toBe(TxStatus.PENDING);

      // Check 2: PENDING
      const c2 = await getTopupStatus(topupId);
      expect(c2.data.status).toBe(TxStatus.PENDING);

      // Check 3: COMPLETED
      const c3 = await getTopupStatus(topupId);
      expect(c3.data.status).toBe(TxStatus.COMPLETED);

      // Deposit balance is now credited to full 300.000đ
      const st = await getDepositStatus();
      expect(st.data.depositBalance).toBe(300000);
      expect(st.data.canAcceptCash).toBe(true);
      expect(st.data.canAcceptTransfer).toBe(true);
    });
  });

  describe('6. Grace-Period Deposit Withholding Math (MoneyHelper.calculateDepositWithhold for 3 shifts)', () => {
    it('calculates 3-shift grace progression: 127.500đ → 127.500đ → 45.000đ reaching exactly 300.000đ', () => {
      const netPayout = 425000; // 500k booking - 15% platform commission
      const minDeposit = 300000;
      const rate = 0.3;

      // Ca 1: Số dư đầu = 0đ
      const shift1 = MoneyHelper.calculateDepositWithhold(netPayout, 0, minDeposit, rate);
      expect(shift1.withhold).toBe(127500);
      expect(shift1.payout).toBe(297500);
      const balanceAfter1 = 0 + shift1.withhold;
      expect(balanceAfter1).toBe(127500);

      // Ca 2: Số dư đầu = 127.500đ
      const shift2 = MoneyHelper.calculateDepositWithhold(netPayout, balanceAfter1, minDeposit, rate);
      expect(shift2.withhold).toBe(127500);
      expect(shift2.payout).toBe(297500);
      const balanceAfter2 = balanceAfter1 + shift2.withhold;
      expect(balanceAfter2).toBe(255000);

      // Ca 3: Số dư đầu = 255.000đ -> còn thiếu đúng 45.000đ
      const shift3 = MoneyHelper.calculateDepositWithhold(netPayout, balanceAfter2, minDeposit, rate);
      expect(shift3.withhold).toBe(45000); // capped at shortfall
      expect(shift3.payout).toBe(380000);
      const balanceAfter3 = balanceAfter2 + shift3.withhold;
      expect(balanceAfter3).toBe(300000); // Đã đủ ký quỹ 100%!
    });
  });

  describe('7. Push Notification Routing Handler (ADR-0004 & A10)', () => {
    const navigateMock = jest.fn();

    beforeEach(() => {
      navigateMock.mockClear();
    });

    it('routes DEPOSIT_WITHHELD to Deposit screen', () => {
      const handled = handleDepositNotificationNavigation(
        { type: 'DEPOSIT_WITHHELD' },
        navigateMock
      );
      expect(handled).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('Deposit');
    });

    it('routes DEPOSIT_PENALTY to PenaltyDetail screen when transactionId is provided', () => {
      const handled = handleDepositNotificationNavigation(
        { type: 'DEPOSIT_PENALTY', transactionId: 'tx-pen-99' },
        navigateMock
      );
      expect(handled).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('PenaltyDetail', { transactionId: 'tx-pen-99' });
    });

    it('routes PENALTY_REVERSED to PenaltyDetail screen', () => {
      const handled = handleDepositNotificationNavigation(
        { type: 'PENALTY_REVERSED', transactionId: 'tx-pen-88' },
        navigateMock
      );
      expect(handled).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('PenaltyDetail', { transactionId: 'tx-pen-88' });
    });

    it('routes DEPOSIT_REFUND_STATUS to AccountClosure screen', () => {
      const handled = handleDepositNotificationNavigation(
        { type: 'DEPOSIT_REFUND_STATUS' },
        navigateMock
      );
      expect(handled).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('AccountClosure');
    });

    it('ignores unknown notification types', () => {
      const handled = handleDepositNotificationNavigation(
        { type: 'UNKNOWN_TYPE' },
        navigateMock
      );
      expect(handled).toBe(false);
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  describe('8. Account Closure & Refund Lifecycle', () => {
    it('creates refund request and updates status to WAITING_HOLD', async () => {
      mockSetDepositScenario('full');
      const res = await requestAccountClosure();
      expect(res.success).toBe(true);
      expect(res.data.status).toBe(DepositRefundStatus.WAITING_HOLD);
      expect(res.data.refundAmount).toBe(300000);

      const statusRes = await getDepositStatus();
      expect(statusRes.data.canAcceptCash).toBe(false);
      expect(statusRes.data.canAcceptTransfer).toBe(false);
    });

    it('blocks duplicate account closure request when one is already open', async () => {
      mockSetDepositScenario('closing');
      const res = await requestAccountClosure();
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('REFUND_REQUEST_OPEN');
    });

    it('cancels pending refund request successfully and restores nurse state', async () => {
      mockSetDepositScenario('closing');
      const initialReq = await getRefundRequest();
      expect(initialReq.data).not.toBeNull();

      const cancelRes = await cancelRefundRequest(initialReq.data!.id);
      expect(cancelRes.success).toBe(true);

      const postReq = await getRefundRequest();
      expect(postReq.data).toBeNull();
    });
  });
});
