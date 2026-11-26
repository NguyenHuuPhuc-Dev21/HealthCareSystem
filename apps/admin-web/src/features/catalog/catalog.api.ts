import { apiClient } from '../../lib/api-client';
import type { ServiceCategory, ServiceInput } from './catalog.types';

/*
 * ⚠️ Contract ĐỀ XUẤT — backend `admin-catalog` chưa công bố (xem catalog.types.ts).
 * Mọi thay đổi phải ghi `audit_logs` (người thực hiện, giá trị cũ/mới); không có xoá cứng — chỉ ẩn (`isActive = false`).
 */

/** GET /admin/services/categories → { items } (gồm cả dịch vụ đã ẩn và dịch vụ cấm). */
export function getServiceCategories() {
  return apiClient<{ items: ServiceCategory[] }>('/admin/services/categories');
}

/** POST /admin/services/categories — 409 CODE_EXISTS; 400 INVALID_TIER_FOR_INVASIVE khi `isInvasive` mà `requiredTier` ≠ TIER_2_SPECIALIST. */
export function createServiceCategory(input: ServiceInput) {
  return apiClient<ServiceCategory>('/admin/services/categories', { method: 'POST', body: JSON.stringify(input) });
}

/** PATCH /admin/services/categories/:id — gửi các trường thay đổi (không đổi được `code`). Giá mới chỉ áp cho ca đặt SAU đó (đặt chỗ cũ giữ giá đã chụp). */
export function updateServiceCategory(id: string, patch: Partial<Omit<ServiceInput, 'code'>>) {
  return apiClient<ServiceCategory>(`/admin/services/categories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}
