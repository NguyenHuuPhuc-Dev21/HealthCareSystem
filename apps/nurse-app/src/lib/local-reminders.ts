import notifee, {
  AndroidImportance,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
} from '@healthcare-system/shared';
import type { CommissionDebtDto } from '@healthcare-system/shared';
import { PUSH_CHANNEL_GENERAL } from './push';

export const COMMISSION_REMINDER_NOTIFICATION_PREFIX = 'commission-reminder-';

/**
 * Tính số tiền hoa hồng 15% nền tảng cho ca tiền mặt (làm tròn xuống số nguyên đồng)
 * BR-05, FR-PAY-01: floor(bookingAmount × 0.15)
 */
export function calculateCommissionAmount(bookingAmount: number): number {
  if (bookingAmount <= 0) return 0;
  return Math.floor(bookingAmount * DEFAULT_PLATFORM_COMMISSION_RATE);
}

/**
 * Tính thời điểm nhắc hẹn thông báo (mặc định trước hạn 2 giờ)
 * @param dueAt Hạn nộp hoa hồng (ISO string hoặc Date)
 * @param hoursBefore Số giờ trước hạn cần nhắc (mặc định 2 giờ)
 * @returns Timestamp epoch ms của thời điểm nhắc
 */
export function calculateReminderTimestamp(
  dueAt: string | Date,
  hoursBefore: number = 2
): number {
  const dueMs = typeof dueAt === 'string' ? new Date(dueAt).getTime() : dueAt.getTime();
  return dueMs - hoursBefore * 3600 * 1000;
}

/**
 * Lên lịch nhắc nhở cục bộ bằng Notifee khi còn 2 giờ trước hạn nộp hoa hồng
 * @returns true nếu lên lịch thành công, false nếu không hợp lệ (đã quá hạn hoặc đã thanh toán)
 */
export async function scheduleCommissionReminder(
  debt: CommissionDebtDto,
  nowMs: number = Date.now()
): Promise<boolean> {
  if (debt.status !== 'UNPAID') {
    return false;
  }

  const dueMs = new Date(debt.dueAt).getTime();
  if (Number.isNaN(dueMs) || dueMs <= nowMs) {
    // Đã quá hạn nộp, không đặt lịch nhắc 2 giờ trước hạn
    return false;
  }

  const reminderTargetMs = calculateReminderTimestamp(debt.dueAt, 2);
  // Nếu đã qua mốc 2h trước hạn nhưng vẫn còn hạn (còn dưới 2 giờ), đặt lịch kích hoạt sau 10 giây
  const triggerTimestamp = reminderTargetMs > nowMs ? reminderTargetMs : nowMs + 10_000;

  const notificationId = `${COMMISSION_REMINDER_NOTIFICATION_PREFIX}${debt.bookingId}`;

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerTimestamp,
  };

  try {
    await notifee.createTriggerNotification(
      {
        id: notificationId,
        title: `Sắp hết hạn nộp hoa hồng ca ${debt.bookingCode}`,
        body: `Còn 2 giờ để nộp ${debt.commissionAmount.toLocaleString(
          'vi-VN'
        )}đ hoa hồng ca ${debt.bookingCode}. Vui lòng nộp qua VietQR để tránh tạm khóa tài khoản.`,
        android: {
          channelId: PUSH_CHANNEL_GENERAL,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
        },
        data: {
          type: 'COMMISSION_DUE',
          bookingId: debt.bookingId,
          bookingCode: debt.bookingCode,
        },
      },
      trigger
    );
    return true;
  } catch (err) {
    // Catch transient notifee error in mock / testing environments
    return false;
  }
}

/**
 * Hủy lịch nhắc nhở cục bộ khi khoản nợ đã được thanh toán
 */
export async function cancelCommissionReminder(bookingId: string): Promise<void> {
  const notificationId = `${COMMISSION_REMINDER_NOTIFICATION_PREFIX}${bookingId}`;
  try {
    await notifee.cancelNotification(notificationId);
    if (typeof (notifee as any).cancelTriggerNotification === 'function') {
      await (notifee as any).cancelTriggerNotification(notificationId);
    }
  } catch {
    // Ignore error
  }
}

/**
 * Đồng bộ lịch nhắc nhở cho tất cả các khoản hoa hồng
 * - Đặt lịch cho các khoản UNPAID
 * - Hủy lịch cho các khoản PAID hoặc OVERDUE
 */
export async function syncAllCommissionReminders(
  debts: CommissionDebtDto[],
  nowMs: number = Date.now()
): Promise<{ scheduled: number; cancelled: number }> {
  let scheduled = 0;
  let cancelled = 0;

  for (const debt of debts) {
    if (debt.status === 'UNPAID') {
      const ok = await scheduleCommissionReminder(debt, nowMs);
      if (ok) scheduled++;
    } else {
      await cancelCommissionReminder(debt.bookingId);
      cancelled++;
    }
  }

  return { scheduled, cancelled };
}
