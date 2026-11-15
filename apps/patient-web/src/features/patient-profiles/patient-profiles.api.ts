import { apiClient } from '../../lib/api-client';
import type {
  CreatePatientProfileRequest,
  PatientProfileDetail,
  PatientProfileDto,
  UpdatePatientProfileRequest,
} from './patient-profiles.types';

export type { PatientProfileDto } from './patient-profiles.types';

/*
 * ⚠️ Ngoài GET danh sách đã có sẵn, các endpoint dưới đây là đề xuất — SRS §8 chưa liệt kê,
 * cần BE-2 (patient-profiles) và BE-3 (privacy-consent) xác nhận.
 */

/** Danh sách hồ sơ (bản tóm tắt, không có tiền sử bệnh). */
export async function getPatientProfiles() {
  return apiClient<PatientProfileDto[]>('/patients/profiles');
}

/** Chi tiết 1 hồ sơ — chỉ gọi khi mở form sửa. */
export async function getPatientProfile(id: string) {
  return apiClient<PatientProfileDetail>(`/patients/profiles/${id}`);
}

/** Tạo hồ sơ người bệnh kèm đồng ý NĐ 13 trong cùng 1 request (thiếu đồng ý → backend trả 400). */
export async function createPatientProfile(payload: CreatePatientProfileRequest) {
  return apiClient<PatientProfileDetail>('/patients/profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePatientProfile(id: string, payload: UpdatePatientProfileRequest) {
  return apiClient<PatientProfileDetail>(`/patients/profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Đồng ý lại sau khi đã rút (backend ghi thời điểm, IP, thiết bị). */
export async function grantConsent(id: string) {
  return apiClient<PatientProfileDto>(`/patients/profiles/${id}/consent`, { method: 'POST' });
}

/** Rút lại đồng ý xử lý dữ liệu sức khoẻ (FR-PRIV-01). */
export async function withdrawConsent(id: string) {
  return apiClient<PatientProfileDto>(`/patients/profiles/${id}/consent`, { method: 'DELETE' });
}

/** Yêu cầu xoá/ẩn danh hoá dữ liệu cá nhân của hồ sơ (FR-PRIV-01 mục 3). */
export async function requestProfileDeletion(id: string) {
  return apiClient<PatientProfileDto>(`/patients/profiles/${id}/deletion-request`, { method: 'POST' });
}
