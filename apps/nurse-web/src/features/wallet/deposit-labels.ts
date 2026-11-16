import {
  DepositRefundStatus,
  PenaltyReason,
} from '@healthcare-system/shared';
import type { DepositRefundPendingReason } from '@healthcare-system/shared';

export const PENALTY_REASON_LABELS: Record<PenaltyReason, string> = {
  [PenaltyReason.NURSE_LATE_CANCEL]: 'Hủy ca muộn (≤ 12 giờ)',
  [PenaltyReason.NURSE_NO_SHOW]: 'Không đến ca (No-show)',
  [PenaltyReason.DISPUTE_UPHELD]: 'Khiếu nại của khách được chấp nhận',
};

export const REFUND_STATUS_LABELS: Record<DepositRefundStatus, string> = {
  [DepositRefundStatus.REQUESTED]: 'Đã gửi yêu cầu',
  [DepositRefundStatus.WAITING_HOLD]: 'Đang chờ đủ điều kiện',
  [DepositRefundStatus.READY]: 'Sẵn sàng hoàn tiền',
  [DepositRefundStatus.REFUNDED]: 'Đã chi hoàn ký quỹ',
  [DepositRefundStatus.REJECTED]: 'Bị từ chối',
  [DepositRefundStatus.CANCELLED]: 'Đã hủy yêu cầu',
};

export const PENDING_REASON_LABELS: Record<DepositRefundPendingReason, string> = {
  ACTIVE_BOOKING: 'Còn ca đã nhận chưa hoàn thành',
  HOLD_DAYS: 'Chưa đủ 7 ngày kể từ ca hoàn thành cuối cùng',
  OPEN_DISPUTE: 'Còn khiếu nại đang chờ xử lý',
  UNPAID_COMMISSION: 'Còn hoa hồng ca tiền mặt chưa nộp',
};
