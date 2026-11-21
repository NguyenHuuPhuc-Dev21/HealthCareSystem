import { apiClient } from '../../lib/api-client';
import type { Booking } from '../booking/booking.types';
import type { CancelPreview, RefundRecord } from './refunds.types';

/** GET /refunds — các khoản hoàn tiền của khách, mới nhất trước. */
export function getRefunds() {
  return apiClient<{ items: RefundRecord[] }>('/refunds');
}

/** GET /bookings/:id/cancel-preview — xem trước phí huỷ và số tiền được hoàn theo thời điểm hiện tại (§5.2). */
export function getCancelPreview(bookingId: string) {
  return apiClient<CancelPreview>(`/bookings/${bookingId}/cancel-preview`);
}

/** POST /bookings/:id/cancel — huỷ ca (khách). Backend áp ma trận §5.2 và tạo khoản hoàn tiền nếu là đơn chuyển khoản. */
export function cancelBooking(bookingId: string) {
  return apiClient<{ booking: Booking; refund: RefundRecord | null }>(`/bookings/${bookingId}/cancel`, { method: 'POST' });
}
