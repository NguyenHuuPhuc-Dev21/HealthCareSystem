import { apiClient } from '../../lib/api-client';
import type { ConfigItem } from './configs.types';

/*
 * ⚠️ Contract ĐỀ XUẤT — backend `admin-configs` chưa công bố (xem configs.types.ts).
 * Mọi lần đổi ghi `audit_logs` (người thực hiện = `updated_by`, giá trị cũ/mới, ghi chú) và có hiệu lực ngay, không cần triển khai lại.
 */

/** GET /admin/configs → { items } mọi tham số kèm kiểu dữ liệu, mô tả, người/giờ sửa gần nhất. */
export function getSystemConfigs() {
  return apiClient<{ items: ConfigItem[] }>('/admin/configs');
}

/** PATCH /admin/configs/:key { value, note? } → tham số đã cập nhật. 400 INVALID_CONFIG_VALUE (sai kiểu/ngoài khoảng); 404 CONFIG_NOT_FOUND. */
export function updateSystemConfig(key: string, value: string, note?: string) {
  return apiClient<ConfigItem>(`/admin/configs/${encodeURIComponent(key)}`, { method: 'PATCH', body: JSON.stringify({ value, ...(note ? { note } : {}) }) });
}
