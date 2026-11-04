import type {
  CreatePatientProfileRequest,
  PatientProfileDetail,
  PatientProfileDraft,
  UpdatePatientProfileRequest,
} from './patient-profiles.types';

export type DraftErrors = Partial<Record<keyof PatientProfileDraft, string>>;

const MIN_BIRTH_YEAR = 1900;
const MAX_WEIGHT_KG = 300; // chặn lỗi gõ nhầm, không phải quy tắc nghiệp vụ

export function ageFromBirthYear(birthYear: string): number | null {
  const year = Number(birthYear);
  if (!/^\d{4}$/.test(birthYear)) return null;
  const age = new Date().getFullYear() - year;
  return age >= 0 ? age : null;
}

/** Kiểm tra form Bước 2. Trả về object rỗng nếu hợp lệ. */
export function validateDraft(d: PatientProfileDraft): DraftErrors {
  const e: DraftErrors = {};
  const currentYear = new Date().getFullYear();

  if (!d.relationship) e.relationship = 'Vui lòng chọn mối quan hệ.';

  const name = d.full_name.trim();
  if (!name) e.full_name = 'Vui lòng nhập họ và tên.';
  else if (name.length < 2) e.full_name = 'Họ và tên quá ngắn.';

  const year = Number(d.birth_year);
  if (!d.birth_year) e.birth_year = 'Vui lòng nhập năm sinh.';
  else if (!/^\d{4}$/.test(d.birth_year) || year < MIN_BIRTH_YEAR || year > currentYear)
    e.birth_year = `Năm sinh từ ${MIN_BIRTH_YEAR} đến ${currentYear}.`;

  const weight = Number(d.weight_kg.replace(',', '.'));
  if (!d.weight_kg) e.weight_kg = 'Vui lòng nhập cân nặng.';
  else if (!Number.isFinite(weight) || weight <= 0 || weight > MAX_WEIGHT_KG) e.weight_kg = 'Cân nặng không hợp lệ.';

  if (!d.mobility_status) e.mobility_status = 'Vui lòng chọn mức độ vận động.';

  if (!d.medical_history.trim())
    e.medical_history = 'Vui lòng ghi tiền sử bệnh & dị ứng (nếu không có, ghi "Không có").';

  if (!d.location_type) e.location_type = 'Vui lòng chọn nơi chăm sóc.';
  if (!d.address_text.trim()) e.address_text = 'Vui lòng nhập địa chỉ nơi chăm sóc.';

  return e;
}

/** Chuyển draft đã hợp lệ thành body gửi API (gọi sau validateDraft). */
export function toCreateRequest(d: PatientProfileDraft): CreatePatientProfileRequest {
  return {
    relationship: d.relationship!,
    full_name: d.full_name.trim(),
    birth_year: Number(d.birth_year),
    weight_kg: Number(d.weight_kg.replace(',', '.')),
    mobility_status: d.mobility_status!,
    medical_history: d.medical_history.trim(),
    is_infectious: d.is_infectious,
    location_type: d.location_type!,
    address_text: d.address_text.trim(),
    lat: d.lat,
    lng: d.lng,
    data_consent_accepted: true,
  };
}

export function toUpdateRequest(d: PatientProfileDraft): UpdatePatientProfileRequest {
  const full: Partial<CreatePatientProfileRequest> = toCreateRequest(d);
  delete full.data_consent_accepted;
  return full as UpdatePatientProfileRequest;
}

/** Đổ dữ liệu chi tiết từ API vào form. */
export function toDraft(p: PatientProfileDetail): PatientProfileDraft {
  return {
    relationship: p.relationship,
    full_name: p.full_name,
    birth_year: String(p.birth_year),
    weight_kg: String(p.weight_kg),
    mobility_status: p.mobility_status,
    medical_history: p.medical_history,
    is_infectious: p.is_infectious,
    location_type: p.location_type,
    address_text: p.address_text,
    lat: p.lat,
    lng: p.lng,
  };
}
