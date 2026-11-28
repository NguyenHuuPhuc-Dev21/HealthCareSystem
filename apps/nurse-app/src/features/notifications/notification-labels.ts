import type { NurseNotificationType } from '@healthcare-system/shared';

export const NOTIFICATION_CONFIG = {
  PAGE_SIZE: 10,
  MOCK_DELAY_MS: 80,
  WS_HEARTBEAT_INTERVAL_MS: 30000,
  WS_MAX_RECONNECT_ATTEMPTS: 5,
  WS_RECONNECT_BASE_MS: 1000,
  WS_RECONNECT_MAX_MS: 16000,
} as const;

export const NOTIFICATION_LABELS = {
  screenTitle: 'Thông báo',
  markAllRead: 'Đánh dấu đã đọc tất cả',
  sectionToday: 'Hôm nay',
  sectionEarlier: 'Trước đó',
  emptyTitle: 'Chưa có thông báo nào',
  emptyMessage:
    'Các cập nhật về ca trực, lời mời, hoa hồng, ký quỹ và tin nhắn sẽ hiển thị tại đây.',
  loadingTitle: 'Đang tải thông báo...',
  errorLoadFallback: 'Không thể tải danh sách thông báo',
  loadMoreText: 'Đang tải thêm...',
  bellAccessibility: 'Mở trung tâm thông báo',
  backAccessibility: 'Quay lại',
  accountSettingsTitle: 'Cài đặt thông báo',
  accountSettingsSub: 'Mở cài đặt thông báo của hệ điều hành',
  highPriorityChannelName: 'Thông báo quan trọng',
} as const;

export function getNotificationCategoryLabel(type: NurseNotificationType): string {
  switch (type) {
    case 'NEW_JOB':
    case 'DIRECT_INVITE':
    case 'RADAR_URGENT':
      return 'Việc mới';
    case 'BOOKING_CANCELLED':
    case 'SHIFT_REMINDER':
    case 'EXTENSION_REQUEST':
      return 'Ca trực';
    case 'DISPUTE_OPENED':
    case 'DISPUTE_RESOLVED':
      return 'Khiếu nại';
    case 'COMMISSION_DUE':
    case 'COMMISSION_OVERDUE':
      return 'Hoa hồng';
    case 'DEPOSIT_LOW':
    case 'DEPOSIT_WITHHELD':
    case 'DEPOSIT_PENALTY':
    case 'PENALTY_REVERSED':
    case 'DEPOSIT_REFUND_STATUS':
      return 'Ký quỹ';
    case 'SETTLEMENT_DONE':
    case 'WITHDRAWAL_UPDATE':
      return 'Ví & Rút tiền';
    case 'CREDENTIAL_REVIEWED':
    case 'GPHN_EXPIRING':
      return 'Hồ sơ';
    case 'NEW_MESSAGE':
      return 'Tin nhắn';
    case 'REVIEW_RECEIVED':
      return 'Đánh giá';
    default:
      return 'Hệ thống';
  }
}
