import type { NotificationPriority } from '../enums';

export type NurseNotificationType =
  | 'NEW_JOB'
  | 'DIRECT_INVITE'
  | 'RADAR_URGENT'
  | 'BOOKING_CANCELLED'
  | 'SHIFT_REMINDER'
  | 'EXTENSION_REQUEST'
  | 'CONDITION_SURCHARGE_ANSWERED' // family answered the condition-mismatch surcharge (FR-SHIFT-02)
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED'
  | 'COMMISSION_DUE'
  | 'COMMISSION_OVERDUE'
  | 'DEPOSIT_LOW'
  | 'SETTLEMENT_DONE'
  | 'WITHDRAWAL_UPDATE'
  | 'DEPOSIT_WITHHELD'
  | 'DEPOSIT_PENALTY'
  | 'PENALTY_REVERSED'
  | 'DEPOSIT_REFUND_STATUS' // ADR-0004: mọi khoản giữ lại, trừ, hoàn lại, đổi trạng thái hoàn ký quỹ đều có thông báo
  | 'CREDENTIAL_REVIEWED'
  | 'GPHN_EXPIRING'
  | 'NEW_MESSAGE'
  | 'REVIEW_RECEIVED';

export interface NotificationDto {
  id: string;
  type: NurseNotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  data?: {
    bookingId?: string;
    bookingCode?: string;
    disputeId?: string;
    conversationId?: string;
    commissionId?: string;
    withdrawalId?: string;
    [key: string]: any;
  };
  readAt: string | null;
  createdAt: string;
}

export interface GetNotificationsQuery {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
}

export interface NotificationsListResponse {
  items: NotificationDto[];
  nextCursor?: string | null;
  totalUnread: number;
}
