import notifee, { TriggerType } from '@notifee/react-native';
import type { CommissionDebtDto } from '@healthcare-system/shared';
import {
  calculateCommissionAmount,
  calculateReminderTimestamp,
  scheduleCommissionReminder,
  cancelCommissionReminder,
  syncAllCommissionReminders,
  COMMISSION_REMINDER_NOTIFICATION_PREFIX,
} from '../src/lib/local-reminders';
import {
  mockGetCommissionDebts,
  mockGetCommissionPaymentLink,
  mockConfirmCommissionPayment,
  mockResetCommissionDebts,
  mockClearAllCommissionDebts,
  mockAddCashCommissionDebt,
  sortDebts,
  getInitialCommissionDebts,
} from '../src/features/commission-payment/commission-payment.mock';
import {
  getCommissionDebts,
  getCommissionPaymentLink,
  getCommissionPaymentStatus,
  confirmCommissionPayment,
} from '../src/features/commission-payment/commission-payment.api';
import { computeCountdown } from '../src/features/commission-payment/components/CommissionDebtItem';
import { getCommissionBannerMeta } from '../src/components/AppBanner';
import { handleCommissionNotificationNavigation } from '../src/lib/push';

describe('A11 — Nurse Cash Booking Commission Payment (nurse-app)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await mockResetCommissionDebts();
  });

  describe('1. Commission Amount Math (FR-PAY-01, BR-05: 15% Platform Fee)', () => {
    it('calculates 15% commission correctly for standard bookings (e.g. 500.000đ → 75.000đ)', () => {
      expect(calculateCommissionAmount(500_000)).toBe(75_000);
      expect(calculateCommissionAmount(600_000)).toBe(90_000);
      expect(calculateCommissionAmount(400_000)).toBe(60_000);
    });

    it('calculates 15% commission correctly for smaller bookings (e.g. 150.000đ → 22.500đ)', () => {
      expect(calculateCommissionAmount(150_000)).toBe(22_500);
    });

    it('handles zero or negative amounts cleanly without error', () => {
      expect(calculateCommissionAmount(0)).toBe(0);
      expect(calculateCommissionAmount(-100_000)).toBe(0);
    });
  });

  describe('2. Debt Sorting Order: OVERDUE → UNPAID → PAID (N11 UI Hierarchy)', () => {
    it('sorts debts by priority: OVERDUE (0), UNPAID (1), PAID (2)', () => {
      const now = Date.now();
      const rawDebts: CommissionDebtDto[] = [
        {
          bookingId: 'paid-1',
          bookingCode: 'HC-PAID-1',
          serviceName: 'Ca đã trả',
          bookingAmount: 400_000,
          commissionAmount: 60_000,
          dueAt: new Date(now - 10 * 3600 * 1000).toISOString(),
          status: 'PAID',
          paidAt: new Date(now - 5 * 3600 * 1000).toISOString(),
        },
        {
          bookingId: 'unpaid-later',
          bookingCode: 'HC-UNPAID-2',
          serviceName: 'Ca chưa nộp (còn 10h)',
          bookingAmount: 500_000,
          commissionAmount: 75_000,
          dueAt: new Date(now + 10 * 3600 * 1000).toISOString(),
          status: 'UNPAID',
        },
        {
          bookingId: 'overdue-1',
          bookingCode: 'HC-OVERDUE-1',
          serviceName: 'Ca quá hạn',
          bookingAmount: 500_000,
          commissionAmount: 75_000,
          dueAt: new Date(now - 2 * 3600 * 1000).toISOString(),
          status: 'OVERDUE',
        },
        {
          bookingId: 'unpaid-sooner',
          bookingCode: 'HC-UNPAID-1',
          serviceName: 'Ca chưa nộp (còn 2h)',
          bookingAmount: 600_000,
          commissionAmount: 90_000,
          dueAt: new Date(now + 2 * 3600 * 1000).toISOString(),
          status: 'UNPAID',
        },
      ];

      const sorted = sortDebts(rawDebts);
      expect(sorted[0].bookingId).toBe('overdue-1');
      expect(sorted[1].bookingId).toBe('unpaid-sooner');
      expect(sorted[2].bookingId).toBe('unpaid-later');
      expect(sorted[3].bookingId).toBe('paid-1');
    });

    it('sorts PAID debts with most recently paid first', () => {
      const now = Date.now();
      const paidDebts: CommissionDebtDto[] = [
        {
          bookingId: 'paid-older',
          bookingCode: 'HC-PAID-OLD',
          serviceName: 'Ca cũ',
          bookingAmount: 400_000,
          commissionAmount: 60_000,
          dueAt: new Date(now - 20 * 3600 * 1000).toISOString(),
          status: 'PAID',
          paidAt: new Date(now - 10 * 3600 * 1000).toISOString(),
        },
        {
          bookingId: 'paid-newer',
          bookingCode: 'HC-PAID-NEW',
          serviceName: 'Ca mới',
          bookingAmount: 500_000,
          commissionAmount: 75_000,
          dueAt: new Date(now - 15 * 3600 * 1000).toISOString(),
          status: 'PAID',
          paidAt: new Date(now - 1 * 3600 * 1000).toISOString(),
        },
      ];

      const sorted = sortDebts(paidDebts);
      expect(sorted[0].bookingId).toBe('paid-newer');
      expect(sorted[1].bookingId).toBe('paid-older');
    });
  });

  describe('3. Countdown & Time Computation (computeCountdown)', () => {
    it('returns overdue status and format when time has passed', () => {
      const now = Date.now();
      const pastDue = new Date(now - (3 * 3600 + 15 * 60) * 1000).toISOString();
      const countdown = computeCountdown(pastDue, 'OVERDUE', now);

      expect(countdown.isOverdue).toBe(true);
      expect(countdown.isUrgent).toBe(true);
      expect(countdown.text).toBe('3h 15m');
    });

    it('returns urgent status when less than 2 hours remaining', () => {
      const now = Date.now();
      const soonDue = new Date(now + (1 * 3600 + 30 * 60) * 1000).toISOString();
      const countdown = computeCountdown(soonDue, 'UNPAID', now);

      expect(countdown.isOverdue).toBe(false);
      expect(countdown.isUrgent).toBe(true);
      expect(countdown.text).toBe('01:30:00');
    });

    it('returns normal status when more than 2 hours remaining', () => {
      const now = Date.now();
      const laterDue = new Date(now + (20 * 3600 + 14 * 60 + 5) * 1000).toISOString();
      const countdown = computeCountdown(laterDue, 'UNPAID', now);

      expect(countdown.isOverdue).toBe(false);
      expect(countdown.isUrgent).toBe(false);
      expect(countdown.text).toBe('20:14:05');
    });
  });

  describe('4. Local Reminders Scheduling & Cancellation (Notifee Trigger at dueAt - 2h)', () => {
    it('calculates reminder timestamp exactly 2 hours before dueAt', () => {
      const dueTime = '2026-11-25T14:00:00.000Z';
      const expectedReminder = new Date('2026-11-25T12:00:00.000Z').getTime();

      expect(calculateReminderTimestamp(dueTime, 2)).toBe(expectedReminder);
    });

    it('schedules trigger notification for UNPAID debt due in the future', async () => {
      const now = Date.now();
      const futureDue = new Date(now + 6 * 3600 * 1000).toISOString();
      const debt: CommissionDebtDto = {
        bookingId: 'test-reminder-1',
        bookingCode: 'HC-TEST-REMIND',
        serviceName: 'Dịch vụ chăm sóc',
        bookingAmount: 500_000,
        commissionAmount: 75_000,
        dueAt: futureDue,
        status: 'UNPAID',
      };

      const scheduled = await scheduleCommissionReminder(debt, now);
      expect(scheduled).toBe(true);
      expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          id: `${COMMISSION_REMINDER_NOTIFICATION_PREFIX}test-reminder-1`,
          title: expect.stringContaining('HC-TEST-REMIND'),
          body: expect.stringContaining('75.000'),
          data: expect.objectContaining({
            type: 'COMMISSION_DUE',
            bookingId: 'test-reminder-1',
          }),
        }),
        expect.objectContaining({
          type: TriggerType.TIMESTAMP,
          timestamp: new Date(futureDue).getTime() - 2 * 3600 * 1000,
        })
      );
    });

    it('does not schedule reminder for PAID or OVERDUE debts', async () => {
      const debtPaid: CommissionDebtDto = {
        bookingId: 'test-paid',
        bookingCode: 'HC-PAID',
        serviceName: 'Ca đã trả',
        bookingAmount: 500_000,
        commissionAmount: 75_000,
        dueAt: new Date().toISOString(),
        status: 'PAID',
      };
      const debtOverdue: CommissionDebtDto = {
        bookingId: 'test-overdue',
        bookingCode: 'HC-OVERDUE',
        serviceName: 'Ca quá hạn',
        bookingAmount: 500_000,
        commissionAmount: 75_000,
        dueAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        status: 'OVERDUE',
      };

      expect(await scheduleCommissionReminder(debtPaid)).toBe(false);
      expect(await scheduleCommissionReminder(debtOverdue)).toBe(false);
    });

    it('cancels reminder notification when payment is made', async () => {
      await cancelCommissionReminder('bk-cash-1057');
      expect(notifee.cancelNotification).toHaveBeenCalledWith(
        `${COMMISSION_REMINDER_NOTIFICATION_PREFIX}bk-cash-1057`
      );
    });

    it('syncAllCommissionReminders schedules active UNPAID and cancels PAID/OVERDUE', async () => {
      const debts = await mockGetCommissionDebts();
      const res = await syncAllCommissionReminders(debts);

      expect(res.scheduled).toBeGreaterThanOrEqual(1);
      expect(res.cancelled).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. VietQR Payment Link Generation (FR-PAY-02)', () => {
    it('generates VietQR payment link with booking code in transfer content', async () => {
      const res = await getCommissionPaymentLink('bk-cash-1058');
      expect(res.success).toBe(true);
      expect(res.data.amount).toBe(90_000);
      expect(res.data.transferContent).toContain('HC20261058');
      expect(res.data.qrCode).toContain('api.vietqr.io');
      expect(res.data.bankName).toContain('MB Bank');
      expect(res.data.accountNumber).toBe('0388998899');
    });

    it('throws error when booking ID is not found', async () => {
      const res = await getCommissionPaymentLink('non-existent-id');
      expect(res.success).toBe(false);
      expect(res.error?.code).toBeDefined();
    });
  });

  describe('6. Commission Overdue Banner Logic (getCommissionBannerMeta)', () => {
    it('returns danger (red) banner when at least one debt is OVERDUE', async () => {
      const debts = await mockGetCommissionDebts();
      const banner = getCommissionBannerMeta(debts);

      expect(banner).not.toBeNull();
      expect(banner?.kind).toBe('danger');
      expect(banner?.title).toBe('Quá hạn nộp hoa hồng — Tạm khóa nhận ca');
      expect(banner?.actionLabel).toBe('Nộp ngay');
      expect(banner?.actionRoute).toBe('CommissionPayment');
      expect(banner?.message).toContain('HC-2026-1057');
    });

    it('returns null when there are no overdue debts', () => {
      const onlyUnpaid: CommissionDebtDto[] = [
        {
          bookingId: 'unpaid-1',
          bookingCode: 'HC-UNPAID-1',
          serviceName: 'Ca hợp lệ',
          bookingAmount: 500_000,
          commissionAmount: 75_000,
          dueAt: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
          status: 'UNPAID',
        },
      ];
      expect(getCommissionBannerMeta(onlyUnpaid)).toBeNull();
      expect(getCommissionBannerMeta([])).toBeNull();
      expect(getCommissionBannerMeta(null)).toBeNull();
    });
  });

  describe('7. Payment Status Transition & Settlement', () => {
    it('transitions debt from OVERDUE/UNPAID to PAID upon confirmation', async () => {
      const confirmRes = await confirmCommissionPayment('bk-cash-1057');
      expect(confirmRes.success).toBe(true);
      expect(confirmRes.data.paidAt).toBeDefined();

      const statusRes = await getCommissionPaymentStatus('bk-cash-1057');
      expect(statusRes.success).toBe(true);
      expect(statusRes.data.status).toBe('PAID');

      // Check debts list
      const debtsRes = await getCommissionDebts();
      const updatedDebt = debtsRes.data?.find((d) => d.bookingId === 'bk-cash-1057');
      expect(updatedDebt?.status).toBe('PAID');
    });

    it('supports adding a new cash booking commission after checkout', async () => {
      const newDebt = await mockAddCashCommissionDebt(
        'bk-cash-9999',
        'HC-2026-9999',
        'Chăm sóc bệnh nhân ICU tại nhà',
        1_000_000
      );

      expect(newDebt.bookingId).toBe('bk-cash-9999');
      expect(newDebt.commissionAmount).toBe(150_000);
      expect(newDebt.status).toBe('UNPAID');

      const allDebts = await mockGetCommissionDebts();
      const found = allDebts.find((d) => d.bookingId === 'bk-cash-9999');
      expect(found).toBeDefined();
    });
  });

  describe('8. Push Notification Routing Handler (FR-NOTIF-01, A11)', () => {
    it('routes COMMISSION_DUE to CommissionPayment screen with bookingId', () => {
      const navigateMock = jest.fn();
      const handled = handleCommissionNotificationNavigation(
        { type: 'COMMISSION_DUE', bookingId: 'bk-cash-1058' },
        navigateMock
      );

      expect(handled).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('CommissionPayment', {
        bookingId: 'bk-cash-1058',
      });
    });

    it('routes COMMISSION_OVERDUE to CommissionPayment screen', () => {
      const navigateMock = jest.fn();
      const handled = handleCommissionNotificationNavigation(
        { type: 'COMMISSION_OVERDUE', bookingId: 'bk-cash-1057' },
        navigateMock
      );

      expect(handled).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('CommissionPayment', {
        bookingId: 'bk-cash-1057',
      });
    });

    it('returns false for unrelated notification types', () => {
      const navigateMock = jest.fn();
      const handled = handleCommissionNotificationNavigation(
        { type: 'RADAR_URGENT', bookingId: 'bk-radar-1' },
        navigateMock
      );

      expect(handled).toBe(false);
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });
});
