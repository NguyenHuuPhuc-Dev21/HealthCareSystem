import { apiClient } from '../../lib/api-client';

/**
 * Liên kết thanh toán của đơn chuyển khoản (FR-PAY-01).
 * ⚠️ Contract đề xuất — backend chưa có tài liệu cho endpoint này; cần BE-2 xác nhận.
 */
export interface PaymentLink {
  /** Trang thanh toán của cổng (PayOS/VNPay…); null nếu cổng chỉ trả mã QR */
  checkoutUrl: string | null;
  /** Ảnh VietQR để quét bằng app ngân hàng; null nếu chưa có */
  qrImageUrl: string | null;
  /** Hạn thanh toán (tạo ca + 15 phút) */
  expiresAt: string;
}

/** GET /bookings/:id/payment-link */
export function getPaymentLink(bookingId: string) {
  return apiClient<PaymentLink>(`/bookings/${bookingId}/payment-link`);
}
