import {
  BalanceType,
  TxStatus,
  TxType,
  getDepositWarningResult,
  getTxTypeMeta,
  mapUpcomingSettlement,
  mapWalletSummary,
  mapWalletTransaction,
  type WalletSummaryDto,
} from '@healthcare-system/shared';
import {
  getEarnings,
  getPendingCommissionNotice,
  getUpcomingSettlements,
  getWalletSummary,
  getWalletTransactions,
  resetWalletMockState,
  setMockPendingCommission,
  setMockWalletSummary,
} from '../src/features/wallet/wallet.api';

describe('A09 — Wallet & Earnings Unit Tests (nurse-app)', () => {
  beforeEach(() => {
    resetWalletMockState();
    jest.clearAllMocks();
  });

  describe('1. DTO Mapping & Snake_case to CamelCase Unification', () => {
    it('correctly maps raw backend snake_case to camelCase WalletSummaryDto', () => {
      const raw = {
        available_balance: 3850000,
        escrow_locked_balance: 425000,
        deposit_balance: 300000,
        min_deposit: 300000,
        is_suspended: false,
        suspended_reason: null,
        deposit_grace_active: false,
      };

      const summary = mapWalletSummary(raw);
      expect(summary.availableBalance).toBe(3850000);
      expect(summary.escrowLockedBalance).toBe(425000);
      expect(summary.depositBalance).toBe(300000);
      expect(summary.minDeposit).toBe(300000);
      expect(summary.isSuspended).toBe(false);
      expect(summary.depositGraceActive).toBe(false);
    });

    it('correctly maps raw backend snake_case to WalletTransactionDto', () => {
      const raw = {
        id: 'tx-test-01',
        type: 'ESCROW_RELEASE',
        status: 'COMPLETED',
        balance_type: 'AVAILABLE',
        amount: 425000,
        booking_code: 'HC-2026-1048',
        description: 'Quyết toán ca HC-2026-1048',
        created_at: '2026-11-20T08:00:00.000Z',
      };

      const tx = mapWalletTransaction(raw);
      expect(tx.id).toBe('tx-test-01');
      expect(tx.type).toBe(TxType.ESCROW_RELEASE);
      expect(tx.balanceType).toBe(BalanceType.AVAILABLE);
      expect(tx.amount).toBe(425000);
      expect(tx.bookingCode).toBe('HC-2026-1048');
      expect(tx.description).toBe('Quyết toán ca HC-2026-1048');
    });

    it('correctly maps raw backend snake_case to UpcomingSettlementDto', () => {
      const raw = {
        booking_code: 'HC-2026-1048',
        service_name: 'Chăm sóc người cao tuổi (4 giờ)',
        gross_amount: 500000,
        commission_amount: 75000,
        net_amount: 425000,
        settle_at: '2026-11-20T17:12:00.000Z',
        dispute_open: false,
      };

      const settle = mapUpcomingSettlement(raw);
      expect(settle.bookingCode).toBe('HC-2026-1048');
      expect(settle.serviceName).toBe('Chăm sóc người cao tuổi (4 giờ)');
      expect(settle.grossAmount).toBe(500000);
      expect(settle.commissionAmount).toBe(75000);
      expect(settle.netAmount).toBe(425000);
      expect(settle.disputeOpen).toBe(false);
    });
  });

  describe('2. Vietnamese Labels for all TxType (W01 & A09 Spec)', () => {
    it('returns exact Vietnamese title and badge for ESCROW_RELEASE', () => {
      const meta = getTxTypeMeta(TxType.ESCROW_RELEASE, 'HC-2026-1039');
      expect(meta.title).toBe('Quyết toán ca HC-2026-1039');
      expect(meta.badgeLabel).toBe('Ví khả dụng');
      expect(meta.isNegative).toBe(false);
    });

    it('returns exact Vietnamese title and badge for DEPOSIT_WITHHOLD (ADR-0004)', () => {
      const meta = getTxTypeMeta(TxType.DEPOSIT_WITHHOLD, 'HC-2026-1042');
      expect(meta.title).toBe('Giữ lại vào ký quỹ (ân hạn) ca HC-2026-1042');
      expect(meta.badgeLabel).toBe('Ví ký quỹ');
      expect(meta.isNegative).toBe(false);
    });

    it('returns exact Vietnamese title and badge for WITHDRAW', () => {
      const meta = getTxTypeMeta(TxType.WITHDRAW);
      expect(meta.title).toBe('Rút tiền về ngân hàng');
      expect(meta.badgeLabel).toBe('Chuyển khoản');
      expect(meta.isNegative).toBe(true);
    });

    it('returns exact Vietnamese title and badge for COMMISSION_PAYMENT', () => {
      const meta = getTxTypeMeta(TxType.COMMISSION_PAYMENT, 'HC-2026-1035');
      expect(meta.title).toBe('Nộp hoa hồng ca tiền mặt HC-2026-1035');
      expect(meta.badgeLabel).toBe('Hoa hồng ca');
      expect(meta.isNegative).toBe(true);
    });

    it('returns exact Vietnamese title and badge for PENALTY_DEDUCT', () => {
      const meta = getTxTypeMeta(TxType.PENALTY_DEDUCT, 'HC-2026-1031');
      expect(meta.title).toBe('Phạt vi phạm SLA ca HC-2026-1031');
      expect(meta.badgeLabel).toBe('Trừ ký quỹ');
      expect(meta.isNegative).toBe(true);
    });

    it('returns exact Vietnamese title and badge for PENALTY_REVERSAL', () => {
      const meta = getTxTypeMeta(TxType.PENALTY_REVERSAL, 'HC-2026-1031');
      expect(meta.title).toBe('Hoàn lại khoản phạt ca HC-2026-1031');
      expect(meta.badgeLabel).toBe('Cộng ký quỹ');
      expect(meta.isNegative).toBe(false);
    });

    it('returns exact Vietnamese title and badge for TOPUP', () => {
      const meta = getTxTypeMeta(TxType.TOPUP);
      expect(meta.title).toBe('Nạp ký quỹ qua VietQR');
      expect(meta.badgeLabel).toBe('Ví ký quỹ');
      expect(meta.isNegative).toBe(false);
    });

    it('returns exact Vietnamese title and badge for DEPOSIT_REFUND', () => {
      const meta = getTxTypeMeta(TxType.DEPOSIT_REFUND);
      expect(meta.title).toBe('Hoàn ký quỹ khi đóng tài khoản');
      expect(meta.badgeLabel).toBe('Chi hoàn');
      expect(meta.isNegative).toBe(false);
    });
  });

  describe('3. Deposit Warning Decision Logic (ADR-0004 & APP-N4)', () => {
    it('decides FULL status when deposit balance >= minDeposit', () => {
      const summary: WalletSummaryDto = {
        availableBalance: 3850000,
        escrowLockedBalance: 425000,
        depositBalance: 300000,
        minDeposit: 300000,
        isSuspended: false,
        depositGraceActive: false,
      };

      const result = getDepositWarningResult(summary);
      expect(result.status).toBe('FULL');
      expect(result.isWarning).toBe(false);
      expect(result.message).toContain('Đã đủ mức yêu cầu');
    });

    it('decides BELOW_MIN status with action label when deposit < minDeposit and not grace', () => {
      const summary: WalletSummaryDto = {
        availableBalance: 3850000,
        escrowLockedBalance: 425000,
        depositBalance: 180000,
        minDeposit: 300000,
        isSuspended: false,
        depositGraceActive: false,
      };

      const result = getDepositWarningResult(summary);
      expect(result.status).toBe('BELOW_MIN');
      expect(result.isWarning).toBe(true);
      expect(result.actionLabel).toBe('Nạp ký quỹ');
      expect(result.message).toContain('dưới mức tối thiểu');
    });

    it('decides GRACE status when depositGraceActive is true regardless of balance', () => {
      const summary: WalletSummaryDto = {
        availableBalance: 3850000,
        escrowLockedBalance: 425000,
        depositBalance: 120000,
        minDeposit: 300000,
        isSuspended: false,
        depositGraceActive: true,
      };

      const result = getDepositWarningResult(summary);
      expect(result.status).toBe('GRACE');
      expect(result.isWarning).toBe(false);
      expect(result.message).toBe('Đang làm quen — chỉ nhận ca chuyển khoản');
    });
  });

  describe('4. Wallet API & Operations', () => {
    it('fetches wallet summary with 3 strictly segregated balances matching APP-N4', async () => {
      const res = await getWalletSummary();
      expect(res.success).toBe(true);
      expect(res.data.availableBalance).toBe(3850000);
      expect(res.data.escrowLockedBalance).toBe(425000);
      expect(res.data.depositBalance).toBe(300000);
    });

    it('allows updating mock deposit balance to 180.000đ for warning state testing', async () => {
      setMockWalletSummary({ depositBalance: 180000 });
      const res = await getWalletSummary();
      expect(res.data.depositBalance).toBe(180000);

      const warning = getDepositWarningResult(res.data);
      expect(warning.status).toBe('BELOW_MIN');
      expect(warning.isWarning).toBe(true);
    });

    it('fetches wallet transactions with pagination and cursor', async () => {
      const page1 = await getWalletTransactions({ limit: 4 });
      expect(page1.success).toBe(true);
      expect(page1.data.items.length).toBe(4);
      expect(page1.data.nextCursor).toBe('4');

      const page2 = await getWalletTransactions({ cursor: page1.data.nextCursor!, limit: 4 });
      expect(page2.success).toBe(true);
      expect(page2.data.items.length).toBe(4);
      expect(page2.data.items[0].id).not.toBe(page1.data.items[0].id);
    });

    it('filters transactions by type (SETTLE, PENALTY, WITHDRAW, DEPOSIT)', async () => {
      const penaltyRes = await getWalletTransactions({ type: 'PENALTY' });
      expect(penaltyRes.success).toBe(true);
      penaltyRes.data.items.forEach((tx) => {
        expect([TxType.PENALTY_DEDUCT, TxType.PENALTY_REVERSAL]).toContain(tx.type);
      });

      const withdrawRes = await getWalletTransactions({ type: 'WITHDRAW' });
      expect(withdrawRes.success).toBe(true);
      withdrawRes.data.items.forEach((tx) => {
        expect(tx.type).toBe(TxType.WITHDRAW);
      });
    });

    it('fetches 7-day earnings bar chart points with total', async () => {
      const res = await getEarnings('week');
      expect(res.success).toBe(true);
      expect(res.data.points.length).toBe(7);
      expect(res.data.points[0].label).toBe('T2');
      expect(res.data.totalAmount).toBeGreaterThan(0);
    });

    it('fetches upcoming settlements and detects disputeOpen flag', async () => {
      const res = await getUpcomingSettlements();
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
      expect(res.data[0].bookingCode).toBe('HC-2026-1048');
      expect(res.data[0].netAmount).toBe(425000);
      expect(res.data[0].disputeOpen).toBe(false);
    });

    it('detects pending commission for cash shift HC-2026-1057 (APP-N4)', async () => {
      const notice = await getPendingCommissionNotice();
      expect(notice.hasPendingCommission).toBe(true);
      expect(notice.bookingCode).toBe('HC-2026-1057');
      expect(notice.amount).toBe(75000);
    });

    it('allows clearing pending commission notice', async () => {
      setMockPendingCommission(false);
      const notice = await getPendingCommissionNotice();
      expect(notice.hasPendingCommission).toBe(false);
    });
  });
});
