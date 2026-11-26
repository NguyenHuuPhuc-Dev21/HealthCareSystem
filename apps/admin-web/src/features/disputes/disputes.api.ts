import { apiClient } from '../../lib/api-client';
import type { AdminConversation, Dispute, DisputeStatus, ResolveBody, ResolveResult } from './disputes.types';

/** GET /admin/disputes?status= — khiếu nại mở xếp trước (cũ nhất trước), không có `status` = tất cả. */
export function listDisputes(status?: DisputeStatus) {
  return apiClient<Dispute[]>(`/admin/disputes${status ? `?status=${status}` : ''}`);
}

/** GET /disputes/:id — chi tiết, bằng chứng kèm link tải tạm thời (presigned). */
export function getDispute(id: string) {
  return apiClient<Dispute>(`/disputes/${id}`);
}

/**
 * PATCH /admin/disputes/:id/resolve — quyết định CUỐI (409 DISPUTE_CLOSED nếu đã xử lý), ghi `audit_logs` RESOLVE_DISPUTE.
 *  - RESOLVED_NURSE: bác bỏ → gỡ đóng băng, giải ngân phần thu nhập của điều dưỡng; khiếu nại phạt ký quỹ → hoàn khoản phạt.
 *  - RESOLVED_CUSTOMER: chấp nhận → hoàn 100% số tiền đang giữ cho khách, trừ TrustScore điều dưỡng; tuỳ chọn trừ ký quỹ.
 */
export function resolveDispute(id: string, body: ResolveBody) {
  return apiClient<ResolveResult>(`/admin/disputes/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(body) });
}

/** GET /admin/bookings/:id/conversation — toàn bộ chat làm bằng chứng. MỖI LẦN ĐỌC ghi `audit_logs` VIEW_CHAT_HISTORY. */
export function getBookingConversation(bookingId: string) {
  return apiClient<AdminConversation>(`/admin/bookings/${bookingId}/conversation`);
}
