/**
 * Danh mục dịch vụ (FR-ADMIN-01, bảng `service_categories` — db/migrations/0001_initial_schema.sql, BR-15 §2.1).
 *
 * ⚠️ Backend `admin-catalog` (BE-1, Phase 7) CHƯA có tài liệu contract — hình dạng dưới đây là ĐỀ XUẤT (camelCase, bám các
 * cột của bảng) và cần BE-1 xác nhận trước khi nối backend thật.
 */

export type ServiceType = 'TASK_BASED' | 'SHIFT_BASED' | 'CONTRACT';
export type ServiceUnit = 'PER_TIME' | 'PER_HOUR' | 'PER_SHIFT';
export type RequiredTier = 'TIER_1_BASIC' | 'TIER_2_SPECIALIST';

export interface ServiceCategory {
  id: string;
  /** Mã ổn định dùng khi đặt ca (vd. SRV_WOUND_CARE); không đổi sau khi tạo */
  code: string;
  name: string;
  serviceType: ServiceType;
  /** Thủ thuật xâm lấn: chỉ Cấp 2 (có GPHN) làm được và bắt buộc y lệnh */
  isInvasive: boolean;
  /** Dịch vụ cấm (Nhóm 3): không ai đặt được; tồn tại để chặn ở đường đặt ca */
  isProhibited: boolean;
  requiredTier: RequiredTier;
  /** VNĐ nguyên, ≥ 0 */
  basePrice: number;
  unit: ServiceUnit;
  /** Hiển thị/cho đặt hay không. Không có xoá cứng (đặt ca cũ còn tham chiếu) → dùng ẩn */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ServiceInput = Omit<ServiceCategory, 'id' | 'createdAt' | 'updatedAt'>;

export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,49}$/;

export const TYPE_LABEL: Record<ServiceType, string> = { TASK_BASED: 'Theo thủ thuật', SHIFT_BASED: 'Theo ca', CONTRACT: 'Hợp đồng dài hạn' };
export const UNIT_LABEL: Record<ServiceUnit, string> = { PER_TIME: 'lượt', PER_HOUR: 'giờ', PER_SHIFT: 'ca' };
export const TIER_LABEL: Record<RequiredTier, string> = { TIER_1_BASIC: 'Cấp 1 · Cơ bản', TIER_2_SPECIALIST: 'Cấp 2 · Chuyên môn' };

/** 3 nhóm dịch vụ theo BR-15 §2.1 */
export type ServiceGroup = 'NON_INVASIVE' | 'INVASIVE' | 'PROHIBITED';
export const groupOf = (s: Pick<ServiceCategory, 'isInvasive' | 'isProhibited'>): ServiceGroup => (s.isProhibited ? 'PROHIBITED' : s.isInvasive ? 'INVASIVE' : 'NON_INVASIVE');

export const GROUP_INFO: Record<ServiceGroup, { title: string; description: string; tone: '' | 'amber' | 'red' }> = {
  NON_INVASIVE: { title: 'Nhóm 1 · Chăm sóc không xâm lấn', description: 'Cấp 1 và Cấp 2 đều làm được (chăm sóc theo ca, vệ sinh, theo dõi sinh hiệu…).', tone: '' },
  INVASIVE: { title: 'Nhóm 2 · Thủ thuật xâm lấn có điều kiện', description: 'Chỉ Cấp 2 (GPHN còn hạn, đúng phạm vi) và bắt buộc y lệnh bác sĩ ≤ 7 ngày.', tone: 'amber' },
  PROHIBITED: { title: 'Nhóm 3 · Cấm tuyệt đối', description: 'Không thể đặt dưới bất kỳ hình thức nào (kể cả qua công cụ Admin). Dùng để chặn các dịch vụ rủi ro cao tại nhà.', tone: 'red' },
};
