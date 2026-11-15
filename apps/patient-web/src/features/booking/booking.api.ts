import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type { Booking, BookingSlot, CreateBookingRequest, PricingQuote, QuoteRequest } from './booking.types';

/** Ghép ngày + giờ + số giờ thành khoảng thời gian ISO (giờ địa phương của trình duyệt). */
export function toWindow(slot: BookingSlot): { startAt: string; endAt: string } | null {
  if (!slot.date || !slot.startTime || !slot.durationHours) return null;
  const start = new Date(`${slot.date}T${slot.startTime}:00`);
  if (Number.isNaN(start.getTime())) return null;
  return {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + slot.durationHours * 3_600_000).toISOString(),
  };
}

const fail = <T>(code: string, message: string): ApiResponse<T> => ({
  success: false,
  data: null as unknown as T,
  error: { code, message },
});

/** POST /bookings/quote — bảng giá do backend tính từ `service_categories` + `system_configs`. */
export function quoteBooking(req: QuoteRequest) {
  return apiClient<PricingQuote>('/bookings/quote', { method: 'POST', body: JSON.stringify(req) });
}

/**
 * Tải ảnh y lệnh: xin link riêng tư (10 phút) → PUT ảnh → trả object key.
 * Cùng mô hình với eKYC; ảnh không đi qua API.
 */
export async function uploadPrescription(file: File): Promise<ApiResponse<{ imageKey: string }>> {
  const urls = await apiClient<{ objectKey: string; uploadUrl: string; contentType: string }>(
    '/bookings/prescription/upload-url',
    { method: 'POST', body: JSON.stringify({ contentType: file.type }) },
  );
  if (!urls.success) return { success: false, data: null as unknown as { imageKey: string }, error: urls.error };
  try {
    const put = await fetch(urls.data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': urls.data.contentType },
      body: file,
    });
    if (!put.ok) return fail('PRESCRIPTION_UPLOAD_FAILED', 'Tải ảnh y lệnh chưa thành công. Vui lòng thử lại.');
  } catch {
    return fail('NETWORK_ERROR', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  }
  return { success: true, data: { imageKey: urls.data.objectKey } };
}

/** POST /bookings — tạo ca ở trạng thái DRAFT (chuyển khoản, giữ 15 phút) hoặc MATCHING (tiền mặt). */
export function createBooking(req: CreateBookingRequest) {
  return apiClient<Booking>('/bookings', { method: 'POST', body: JSON.stringify(req) });
}

export function getBookings() {
  return apiClient<{ items: Booking[] }>('/bookings');
}

export function getBooking(id: string) {
  return apiClient<Booking>(`/bookings/${id}`);
}

/** Chỉ dùng khi chạy mock: giả lập webhook cổng thanh toán xác nhận đã nhận tiền. */
export function simulatePaymentForMock(id: string) {
  return apiClient<Booking>(`/mock/bookings/${id}/simulate-payment`, { method: 'POST' });
}
