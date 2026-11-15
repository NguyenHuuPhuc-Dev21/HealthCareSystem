/**
 * Tìm kiếm điều dưỡng (FR-SEARCH-01 · BR-13 §2 · BR-21 · BR-01 §2.3).
 *
 * ⚠️ Backend `nurse-search` (BE-3) chưa có tài liệu contract — hình dạng dưới đây là ĐỀ XUẤT,
 * viết theo camelCase như các module BE đã có; cần BE-3 xác nhận trước khi nối backend thật.
 */

export type NurseTier = 'TIER_1_BASIC' | 'TIER_2_SPECIALIST';
export type NurseGender = 'MALE' | 'FEMALE';

/** Nhóm dịch vụ (BR-15 §2.1). Nhóm 3 (cấm) không bao giờ xuất hiện ở bộ lọc. */
export type ServiceGroup = 'NON_INVASIVE' | 'INVASIVE';

export interface ServiceCategory {
  /** PER_HOUR: ca theo giờ (chọn 4/8/12/24 giờ) · PER_TIME: tính theo lượt, thời lượng cố định */
  unit: 'PER_HOUR' | 'PER_TIME';
  code: string;
  label: string;
  group: ServiceGroup;
}

/**
 * TODO: lấy từ API danh mục dịch vụ (`service_categories`) khi backend có endpoint.
 * Hiện dùng danh sách cố định theo ví dụ ở BR-15 để bộ lọc chạy được.
 */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { code: 'BEDSIDE_CARE', unit: 'PER_HOUR', label: 'Chăm sóc tại giường (ca 4–24 giờ)', group: 'NON_INVASIVE' },
  { code: 'HYGIENE_FEEDING', unit: 'PER_HOUR', label: 'Vệ sinh, hỗ trợ ăn uống', group: 'NON_INVASIVE' },
  { code: 'VITAL_SIGNS', unit: 'PER_TIME', label: 'Theo dõi sinh hiệu', group: 'NON_INVASIVE' },
  { code: 'INJECTION', unit: 'PER_TIME', label: 'Tiêm bắp / dưới da theo y lệnh', group: 'INVASIVE' },
  { code: 'IV_INFUSION', unit: 'PER_TIME', label: 'Truyền dịch duy trì theo y lệnh', group: 'INVASIVE' },
  { code: 'WOUND_DRESSING', unit: 'PER_TIME', label: 'Thay băng, cắt chỉ', group: 'INVASIVE' },
  { code: 'CATHETER_CARE', unit: 'PER_TIME', label: 'Chăm sóc ống thông', group: 'INVASIVE' },
];

/** Quận/huyện — TODO: lấy từ API khi có danh mục địa bàn phục vụ. */
export const DISTRICTS = ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu', 'Cẩm Lệ', 'Hòa Vang'];

/** Ca làm việc chuẩn (BR-03 §2.1). */
export const SHIFT_HOURS = [4, 8, 12, 24] as const;

export interface NurseSearchFilters {
  /** Mã dịch vụ — chọn dịch vụ xâm lấn thì chỉ còn Tier 2 phù hợp (BR-15). */
  service: string;
  district: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  startTime: string;
  durationHours: number | null;
  tier: NurseTier | '';
  gender: NurseGender | '';
}

export const EMPTY_FILTERS: NurseSearchFilters = {
  service: '',
  district: '',
  date: '',
  startTime: '',
  durationHours: null,
  tier: '',
  gender: '',
};

/** Một dòng kết quả — thông tin công khai, KHÔNG gồm số điện thoại/CCCD/GPHN. */
export interface NurseSummary {
  nurseId: string;
  fullName: string;
  avatarUrl: string | null;
  gender: NurseGender;
  tier: NurseTier;
  /** 0–100, khởi điểm 100; dưới 60 thì bị tạm khoá nên không hiển thị ở đây. */
  trustScore: number;
  ratingAvg: number | null;
  ratingCount: number;
  completedShifts: number;
  yearsExperience: number;
  /** Huy hiệu "Chuyên gia hưu trí giàu kinh nghiệm" (BR-21) — không liên quan đến Tier. */
  isRetiredStaff: boolean;
  districts: string[];
  services: string[];
  bio: string;
  /** Khoảng cách tới địa chỉ khách (km), có khi khách đã chọn hồ sơ có toạ độ. */
  distanceKm?: number | null;
}

export interface NurseSearchResult {
  items: NurseSummary[];
  total: number;
  limit: number;
  offset: number;
}
