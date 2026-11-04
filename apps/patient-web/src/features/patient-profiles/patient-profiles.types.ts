/**
 * Hồ sơ người được chăm sóc (FR-AUTH-03) + đồng ý xử lý dữ liệu sức khoẻ (FR-PRIV-01, NĐ 13/2023).
 *
 * TODO: MobilityStatus, LocationType là enum của DB (§7 patient_profiles) → chuyển sang
 * import từ '@healthcare-system/shared' khi BE export.
 * ⚠️ Relationship CHƯA có trong schema SRS — thiết kế SH3 có trường này, cần BE-2 thêm cột.
 */

export type MobilityStatus = 'NORMAL' | 'PARTIAL' | 'BEDRIDDEN';
export type LocationType = 'HOME' | 'HOSPITAL';
export type Relationship = 'SELF' | 'FATHER' | 'MOTHER' | 'SPOUSE' | 'CHILD' | 'OTHER';

/** Dữ liệu form ở Bước 2 — giữ ở client, chỉ gửi đi ở Bước 3 kèm đồng ý. */
export interface PatientProfileDraft {
  relationship: Relationship | null;
  full_name: string;
  birth_year: string;
  weight_kg: string;
  mobility_status: MobilityStatus | null;
  medical_history: string;
  is_infectious: boolean;
  location_type: LocationType | null;
  address_text: string;
  lat: number | null;
  lng: number | null;
}

export const EMPTY_DRAFT: PatientProfileDraft = {
  relationship: null,
  full_name: '',
  birth_year: '',
  weight_kg: '',
  mobility_status: null,
  medical_history: '',
  is_infectious: false,
  location_type: null,
  address_text: '',
  lat: null,
  lng: null,
};

/** POST /patients/profiles — contract đề xuất, cần BE-2 xác nhận. */
export interface CreatePatientProfileRequest {
  relationship: Relationship;
  full_name: string;
  birth_year: number; // ⚠️ SRS lưu dob (DATE) nhưng thiết kế chỉ hỏi năm sinh — cần chốt
  weight_kg: number;
  mobility_status: MobilityStatus;
  medical_history: string;
  is_infectious: boolean;
  location_type: LocationType;
  address_text: string;
  lat: number | null; // null → backend tự geocode từ address_text (SRS §9)
  lng: number | null;
  /** Bắt buộc true — backend tự ghi consent_timestamp, IP, thiết bị (FR-PRIV-01) */
  data_consent_accepted: true;
}

/** Bản tóm tắt dùng cho danh sách (GET /patients/profiles) — không chứa dữ liệu sức khoẻ chi tiết. */
export interface PatientProfileDto {
  id: string;
  full_name: string;
  data_consent_accepted: boolean;
  location_type: LocationType;
  relationship?: Relationship;
  birth_year?: number;
  mobility_status?: MobilityStatus;
  consent_timestamp?: string | null;
  booking_count?: number;
  /** Đã gửi yêu cầu xoá/ẩn danh hoá (NĐ 13) — hồ sơ chuyển sang chỉ đọc */
  deletion_requested_at?: string | null;
}

/** Bản chi tiết (GET /patients/profiles/:id) — chỉ tải khi mở form sửa. */
export interface PatientProfileDetail extends PatientProfileDto {
  relationship: Relationship;
  birth_year: number;
  weight_kg: number;
  mobility_status: MobilityStatus;
  medical_history: string;
  is_infectious: boolean;
  address_text: string;
  lat: number | null;
  lng: number | null;
}

/** PATCH /patients/profiles/:id — đồng ý được quản lý bằng API riêng. */
export type UpdatePatientProfileRequest = Omit<CreatePatientProfileRequest, 'data_consent_accepted'>;

/* ----- Nhãn hiển thị ----- */

export const RELATIONSHIP_OPTIONS: Array<{ value: Relationship; label: string }> = [
  { value: 'SELF', label: 'Bản thân' },
  { value: 'FATHER', label: 'Bố' },
  { value: 'MOTHER', label: 'Mẹ' },
  { value: 'SPOUSE', label: 'Vợ / Chồng' },
  { value: 'CHILD', label: 'Con' },
  { value: 'OTHER', label: 'Khác' },
];

export const MOBILITY_OPTIONS: Array<{ value: MobilityStatus; icon: string; title: string; description: string }> = [
  { value: 'NORMAL', icon: '🚶', title: 'Tự đi lại', description: 'Tự sinh hoạt, đi lại bình thường, không cần hỗ trợ.' },
  { value: 'PARTIAL', icon: '🧑‍🦯', title: 'Hỗ trợ di chuyển', description: 'Cần người dìu, dùng gậy hoặc khung tập đi. Nguy cơ té ngã nhẹ.' },
  {
    value: 'BEDRIDDEN',
    icon: '🛏️',
    title: 'Nằm tại giường',
    // Không ghi số % ở FE — mức phụ phí lấy từ system_configs và hiển thị ở bước đặt lịch
    description: 'Không thể rời giường. Cần xoay trở chống loét tỳ đè (có áp dụng phụ phí bệnh nhân nặng).',
  },
];

export const LOCATION_OPTIONS: Array<{ value: LocationType; label: string }> = [
  { value: 'HOME', label: '🏠 Tại nhà riêng' },
  { value: 'HOSPITAL', label: '🏥 Tại bệnh viện' },
];
