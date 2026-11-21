import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type {
  CreatePatientProfileRequest,
  PatientProfileDetail,
  PatientProfileDto,
  Relationship,
  UpdatePatientProfileRequest,
} from './patient-profiles.types';

export type { PatientProfileDto } from './patient-profiles.types';

/*
 * Lớp chuyển đổi giữa dữ liệu của giao diện (snake_case) và contract backend thật
 * (camelCase, docs/api/patient-profiles.api.md + privacy-consent.api.md).
 *
 * Khác biệt cần biết:
 *  - Backend lưu `dob` (ngày), giao diện chỉ hỏi năm sinh → gửi `YYYY-01-01`.
 *  - Backend chưa có cột `relationship` → lưu tạm ở localStorage của trình duyệt (không phải dữ liệu y tế).
 *  - Đồng ý lại sau khi rút: backend CHƯA có endpoint → trả lỗi CONSENT_REGRANT_UNSUPPORTED.
 */

/* ----- Dạng dữ liệu backend ----- */

interface BackendProfile {
  id: string;
  fullName: string;
  dob: string | null;
  weightKg: number | null;
  mobilityStatus: PatientProfileDetail['mobility_status'];
  medicalHistory?: string | null;
  isInfectious: boolean;
  addressText: string | null;
  locationType: PatientProfileDetail['location_type'];
  lat: number | null;
  lng: number | null;
  consent: { accepted: boolean; acceptedAt: string | null; withdrawnAt: string | null };
}

interface BackendPrivacyRequest {
  patientProfileId: string;
  requestType: 'DELETE' | 'ANONYMIZE';
  status: 'PENDING' | 'DONE' | 'REJECTED';
  createdAt: string;
}

/* ----- Relationship (chỉ lưu phía client) ----- */

const REL_KEY = (id: string) => `pp-relationship:${id}`;

function readRelationship(id: string): Relationship {
  try {
    return (localStorage.getItem(REL_KEY(id)) as Relationship | null) ?? 'OTHER';
  } catch {
    return 'OTHER';
  }
}

function writeRelationship(id: string, rel: Relationship) {
  try {
    localStorage.setItem(REL_KEY(id), rel);
  } catch {
    /* localStorage bị chặn — bỏ qua */
  }
}

/* ----- Chuyển đổi ----- */

const birthYearOf = (dob: string | null) => (dob ? Number(dob.slice(0, 4)) : 0);

function toDto(p: BackendProfile, pendingDeletionAt: string | null = null): PatientProfileDto {
  return {
    id: p.id,
    full_name: p.fullName,
    data_consent_accepted: p.consent.accepted,
    location_type: p.locationType,
    relationship: readRelationship(p.id),
    birth_year: birthYearOf(p.dob) || undefined,
    mobility_status: p.mobilityStatus,
    consent_timestamp: p.consent.acceptedAt,
    deletion_requested_at: pendingDeletionAt,
  };
}

function toDetail(p: BackendProfile): PatientProfileDetail {
  return {
    ...toDto(p),
    relationship: readRelationship(p.id),
    birth_year: birthYearOf(p.dob),
    weight_kg: p.weightKg ?? 0,
    mobility_status: p.mobilityStatus,
    medical_history: p.medicalHistory ?? '',
    is_infectious: p.isInfectious,
    address_text: p.addressText ?? '',
    lat: p.lat,
    lng: p.lng,
  };
}

function mapData<A, B>(res: ApiResponse<A>, fn: (data: A) => B): ApiResponse<B> {
  return res.success ? { success: true, data: fn(res.data) } : { success: false, data: null as unknown as B, error: res.error };
}

/** Body tạo/sửa theo contract backend (camelCase). lat/lng bắt buộc — form đã chặn nếu chưa ghim vị trí. */
function toBackendFields(r: UpdatePatientProfileRequest) {
  return {
    fullName: r.full_name,
    dob: `${r.birth_year}-01-01`,
    weightKg: r.weight_kg,
    mobilityStatus: r.mobility_status,
    medicalHistory: r.medical_history,
    isInfectious: r.is_infectious,
    addressText: r.address_text,
    locationType: r.location_type,
    lat: r.lat as number,
    lng: r.lng as number,
  };
}

/* ----- API ----- */

/** GET /patient-profiles — danh sách tóm tắt (không có tiền sử bệnh). */
export async function getPatientProfiles(): Promise<ApiResponse<PatientProfileDto[]>> {
  const [list, requests] = await Promise.all([
    apiClient<{ items: BackendProfile[] }>('/patient-profiles'),
    apiClient<BackendPrivacyRequest[]>('/privacy-requests'),
  ]);
  if (!list.success) return { success: false, data: [], error: list.error };

  const pending = new Map<string, string>();
  if (requests.success) {
    for (const r of requests.data) if (r.status === 'PENDING') pending.set(r.patientProfileId, r.createdAt);
  }
  return { success: true, data: list.data.items.map((p) => toDto(p, pending.get(p.id) ?? null)) };
}

/** GET /patient-profiles/:id — chi tiết, chỉ gọi khi mở form sửa. */
export async function getPatientProfile(id: string) {
  return mapData(await apiClient<BackendProfile>(`/patient-profiles/${id}`), toDetail);
}

/**
 * POST /patient-profiles — tạo hồ sơ kèm đồng ý NĐ 13 trong cùng 1 request
 * (thiếu `dataConsentAccepted: true` → backend trả 400 CONSENT_REQUIRED).
 */
export async function createPatientProfile(payload: CreatePatientProfileRequest) {
  const res = await apiClient<BackendProfile>('/patient-profiles', {
    method: 'POST',
    body: JSON.stringify({ ...toBackendFields(payload), dataConsentAccepted: payload.data_consent_accepted }),
  });
  if (res.success) writeRelationship(res.data.id, payload.relationship);
  return mapData(res, toDetail);
}

/** PATCH /patient-profiles/:id — đồng ý do privacy-consent quản lý, không sửa ở đây. */
export async function updatePatientProfile(id: string, payload: UpdatePatientProfileRequest) {
  const res = await apiClient<BackendProfile>(`/patient-profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(toBackendFields(payload)),
  });
  if (res.success) writeRelationship(id, payload.relationship);
  return mapData(res, toDetail);
}

/** Đồng ý lại sau khi đã rút — backend chưa có endpoint (contract §6-3 mới chỉ mô tả ở mức DB). */
export async function grantConsent(_id: string): Promise<ApiResponse<PatientProfileDto>> {
  return {
    success: false,
    data: null as unknown as PatientProfileDto,
    error: {
      code: 'CONSENT_REGRANT_UNSUPPORTED',
      message: 'Hiện chưa thể đồng ý lại trực tiếp. Vui lòng tạo hồ sơ mới hoặc liên hệ hỗ trợ.',
    },
  };
}

/** POST /patient-profiles/:id/consent/withdraw — rút lại đồng ý (FR-PRIV-01). */
export async function withdrawConsent(id: string): Promise<ApiResponse<PatientProfileDto>> {
  const res = await apiClient<{ consent: 'WITHDRAWN'; withdrawnAt: string }>(`/patient-profiles/${id}/consent/withdraw`, {
    method: 'POST',
  });
  if (!res.success) return { success: false, data: null as unknown as PatientProfileDto, error: res.error };
  // Danh sách sẽ được tải lại ngay sau đó; trả bản tối thiểu để khớp kiểu.
  return { success: true, data: { id, full_name: '', data_consent_accepted: false, location_type: 'HOME' } };
}

/** POST /privacy-requests — yêu cầu xoá dữ liệu cá nhân của hồ sơ (FR-PRIV-01 mục 3). */
export async function requestProfileDeletion(id: string): Promise<ApiResponse<PatientProfileDto>> {
  const res = await apiClient<{ requestId: string; status: string }>('/privacy-requests', {
    method: 'POST',
    body: JSON.stringify({ patientProfileId: id, requestType: 'DELETE' }),
  });
  if (!res.success) return { success: false, data: null as unknown as PatientProfileDto, error: res.error };
  return {
    success: true,
    data: {
      id,
      full_name: '',
      data_consent_accepted: true,
      location_type: 'HOME',
      deletion_requested_at: new Date().toISOString(),
    },
  };
}
