import { apiClient } from '../../lib/api-client';
import type { BookingTracking, ExtendQuote, ShiftExtension, SosAlert } from './booking-tracking.types';

/** GET /bookings/:id/tracking — trạng thái ca, selfie check-in, sinh hiệu, nhật ký chăm sóc, gia hạn, SOS. */
export function getBookingTracking(bookingId: string) {
  return apiClient<BookingTracking>(`/bookings/${bookingId}/tracking`);
}

/** POST /bookings/:id/extend/quote — giá gia hạn do backend tính (cùng công thức đặt ca, BR-15 §2.5). */
export function quoteExtension(bookingId: string, hours: number) {
  return apiClient<ExtendQuote>(`/bookings/${bookingId}/extend/quote`, { method: 'POST', body: JSON.stringify({ hours }) });
}

/**
 * POST /bookings/:id/extend — chỉ có hiệu lực khi điều dưỡng đồng ý và không vướng ca kế tiếp.
 * Chuyển khoản: tiền gia hạn nạp thêm vào escrow ngay; tiền mặt: cộng vào hoá đơn cuối ca.
 */
export function requestExtension(bookingId: string, hours: number) {
  return apiClient<ShiftExtension>(`/bookings/${bookingId}/extend`, { method: 'POST', body: JSON.stringify({ hours }) });
}

/** POST /bookings/:id/sos — gia đình bấm SOS tại hiện trường (điều dưỡng cũng bấm được ở app của họ). */
export function raiseSos(bookingId: string, location?: { lat: number; lng: number }) {
  return apiClient<SosAlert>(`/bookings/${bookingId}/sos`, { method: 'POST', body: JSON.stringify(location ?? {}) });
}

/** GET /sos-alerts?status=ACTIVE — cảnh báo khẩn cấp còn mở của các ca thuộc tài khoản gia đình này. */
export function getOpenSosAlerts() {
  return apiClient<{ items: SosAlert[] }>('/sos-alerts?status=OPEN');
}

/** POST /sos-alerts/:id/acknowledge — gia đình xác nhận đã nhận tin (dừng gửi SMS dự phòng). */
export function acknowledgeSos(alertId: string) {
  return apiClient<SosAlert>(`/sos-alerts/${alertId}/acknowledge`, { method: 'POST' });
}

/** Chỉ dùng khi chạy mock: giả lập cổng thanh toán nhận tiền nạp thêm cho gia hạn. */
export function simulateExtensionPaymentForMock(bookingId: string, extensionId: string) {
  return apiClient<ShiftExtension>(`/mock/bookings/${bookingId}/extensions/${extensionId}/simulate-payment`, { method: 'POST' });
}

/** Chỉ dùng khi chạy mock: giả lập Admin đóng cảnh báo SOS. */
export function closeSosForMock(alertId: string) {
  return apiClient<SosAlert>(`/mock/sos-alerts/${alertId}/close`, { method: 'POST' });
}
