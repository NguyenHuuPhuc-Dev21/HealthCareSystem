import { apiClient } from '../../lib/api-client';
import type { AdminUserDetail, ChangeStatusResult, ChangeableStatus, UserList, UserSearchParams } from './users.types';

/** GET /admin/users?q&role&status&limit&offset → `{ items, total, limit, offset }`, mới nhất trước. */
export function searchUsers(params: UserSearchParams = {}) {
  const q = new URLSearchParams();
  if (params.q?.trim()) q.set('q', params.q.trim());
  if (params.role) q.set('role', params.role);
  if (params.status) q.set('status', params.status);
  q.set('limit', String(params.limit ?? 20));
  q.set('offset', String(params.offset ?? 0));
  return apiClient<UserList>(`/admin/users?${q.toString()}`);
}

/** GET /admin/users/:id — chi tiết kèm lịch sử đổi trạng thái; 404 USER_NOT_FOUND (kể cả tài khoản Admin). */
export function getUser(id: string) {
  return apiClient<AdminUserDetail>(`/admin/users/${id}`);
}

/**
 * PATCH /admin/users/:id/status — `reason` 5–500 ký tự và được GỬI CHO NGƯỜI DÙNG, nên phải viết cho họ đọc được.
 * `waiveTrustScore`: chỉ khi kích hoạt lại điều dưỡng mà rào cản duy nhất là TrustScore (đã đào tạo lại, Admin đã xem xét) — được ghi nhật ký kiểm toán.
 */
export function updateUserStatus(id: string, body: { status: ChangeableStatus; reason: string; waiveTrustScore?: boolean }) {
  return apiClient<ChangeStatusResult>(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) });
}
