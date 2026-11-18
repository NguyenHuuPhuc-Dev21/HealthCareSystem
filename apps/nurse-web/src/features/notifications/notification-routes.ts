import type { NotificationDto, NurseNotificationType } from '@healthcare-system/shared';

/**
 * Điều hướng người dùng tới trang nghiệp vụ tương ứng khi bấm vào thông báo (W09).
 */
export function getNotificationRoute(notif: NotificationDto): string {
  const { type, data } = notif;

  switch (type) {
    // 1. Việc làm & Lời mời
    case 'NEW_JOB':
    case 'DIRECT_INVITE':
    case 'RADAR_URGENT':
      return data?.bookingId ? `/jobs/${data.bookingId}` : '/jobs';

    // 2. Ca trực & Thay đổi ca
    case 'BOOKING_CANCELLED':
    case 'SHIFT_REMINDER':
    case 'EXTENSION_REQUEST':
      return data?.bookingId ? `/shifts/${data.bookingId}` : '/shifts';

    // 3. Khiếu nại (W07)
    case 'DISPUTE_OPENED':
    case 'DISPUTE_RESOLVED':
      return data?.disputeId ? `/disputes/${data.disputeId}` : '/disputes';

    // 4. Hoa hồng ca tiền mặt (W03)
    case 'COMMISSION_DUE':
    case 'COMMISSION_OVERDUE':
      return '/wallet/commission';

    // 5. Ký quỹ & Hoàn tiền (W02 - ADR-0004)
    case 'DEPOSIT_LOW':
    case 'DEPOSIT_WITHHELD':
    case 'DEPOSIT_PENALTY':
    case 'PENALTY_REVERSED':
    case 'DEPOSIT_REFUND_STATUS':
      return '/wallet/deposit';

    // 6. Quyết toán & Rút tiền (W01, W05)
    case 'SETTLEMENT_DONE':
    case 'WITHDRAWAL_UPDATE':
      return '/wallet';

    // 7. Văn bằng chứng chỉ & GPHN
    case 'CREDENTIAL_REVIEWED':
    case 'GPHN_EXPIRING':
      return '/credentials';

    // 8. Tin nhắn từ khách (W08)
    case 'NEW_MESSAGE':
      return data?.bookingId ? `/shifts/${data.bookingId}?chat=1` : '/shifts';

    // 9. Đánh giá từ khách (W06)
    case 'REVIEW_RECEIVED':
      return '/trust-score';

    default:
      return '/';
  }
}

/**
 * Nhãn danh mục hiển thị cho filter hoặc badge
 */
export function getNotificationCategory(type: NurseNotificationType): {
  label: string;
  tagClass: string;
} {
  switch (type) {
    case 'NEW_JOB':
    case 'DIRECT_INVITE':
    case 'RADAR_URGENT':
      return { label: 'Việc mới', tagClass: 'badge-blue' };

    case 'BOOKING_CANCELLED':
    case 'SHIFT_REMINDER':
    case 'EXTENSION_REQUEST':
      return { label: 'Ca trực', tagClass: 'badge-teal' };

    case 'DISPUTE_OPENED':
    case 'DISPUTE_RESOLVED':
      return { label: 'Khiếu nại', tagClass: 'badge-rose' };

    case 'COMMISSION_DUE':
    case 'COMMISSION_OVERDUE':
      return { label: 'Hoa hồng', tagClass: 'badge-amber' };

    case 'DEPOSIT_LOW':
    case 'DEPOSIT_WITHHELD':
    case 'DEPOSIT_PENALTY':
    case 'PENALTY_REVERSED':
    case 'DEPOSIT_REFUND_STATUS':
      return { label: 'Ký quỹ', tagClass: 'badge-purple' };

    case 'SETTLEMENT_DONE':
    case 'WITHDRAWAL_UPDATE':
      return { label: 'Ví & Rút tiền', tagClass: 'badge-green' };

    case 'CREDENTIAL_REVIEWED':
    case 'GPHN_EXPIRING':
      return { label: 'Hồ sơ', tagClass: 'badge-indigo' };

    case 'NEW_MESSAGE':
      return { label: 'Tin nhắn', tagClass: 'badge-teal' };

    case 'REVIEW_RECEIVED':
      return { label: 'Đánh giá', tagClass: 'badge-amber' };

    default:
      return { label: 'Hệ thống', tagClass: 'badge-neutral' };
  }
}
