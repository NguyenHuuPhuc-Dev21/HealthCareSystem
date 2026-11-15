/**
 * Mock hồ sơ người bệnh (P13 + SH3).
 *   GET    /patients/profiles                     → danh sách tóm tắt (không có tiền sử bệnh)
 *   GET    /patients/profiles/:id                 → chi tiết (403 nếu đã rút đồng ý / đang chờ xoá)
 *   POST   /patients/profiles                     → thiếu data_consent_accepted=true → 400 CONSENT_REQUIRED (TC-PRIV-01)
 *   PATCH  /patients/profiles/:id
 *   POST   /patients/profiles/:id/consent         → đồng ý lại
 *   DELETE /patients/profiles/:id/consent         → rút đồng ý
 *   POST   /patients/profiles/:id/deletion-request
 *
 * Tài khoản 0905 123 456 có sẵn 2 hồ sơ mẫu (bà Hoa, ông Đức) giống thiết kế P13.
 */

import type {
  CreatePatientProfileRequest,
  PatientProfileDetail,
  PatientProfileDto,
} from '../features/patient-profiles/patient-profiles.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler, MockRequest, MockResult } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';

const SAMPLE: PatientProfileDetail[] = [
  {
    id: 'pp-hoa',
    full_name: 'Nguyễn Thị Hoa',
    relationship: 'MOTHER',
    birth_year: 1948,
    weight_kg: 52,
    mobility_status: 'PARTIAL',
    medical_history: 'Tăng huyết áp, đái tháo đường type 2. Đã thay khớp háng phải (3 tháng trước). Dị ứng Penicillin.',
    is_infectious: false,
    location_type: 'HOME',
    address_text: '25 Quang Trung, Hải Châu 1, Hải Châu, Đà Nẵng',
    lat: 16.0717,
    lng: 108.2208,
    data_consent_accepted: true,
    consent_timestamp: '2026-10-12T02:41:00Z',
    booking_count: 3,
    deletion_requested_at: null,
  },
  {
    id: 'pp-duc',
    full_name: 'Nguyễn Văn Đức',
    relationship: 'FATHER',
    birth_year: 1944,
    weight_kg: 61,
    mobility_status: 'NORMAL',
    medical_history: 'Thoái hóa khớp gối hai bên. Không dị ứng thuốc.',
    is_infectious: false,
    location_type: 'HOME',
    address_text: '25 Quang Trung, Hải Châu 1, Hải Châu, Đà Nẵng',
    lat: null,
    lng: null,
    data_consent_accepted: true,
    consent_timestamp: '2026-10-12T02:43:00Z',
    booking_count: 0,
    deletion_requested_at: null,
  },
];

const REQUIRED: Array<keyof CreatePatientProfileRequest> = [
  'relationship', 'full_name', 'birth_year', 'weight_kg', 'mobility_status',
  'medical_history', 'location_type', 'address_text',
];

function load(userId: string): PatientProfileDetail[] {
  return getUserData<PatientProfileDetail[]>(userId, 'profiles', userId === 'u-patient-verified' ? SAMPLE : []);
}

function save(userId: string, list: PatientProfileDetail[]) {
  setUserData(userId, 'profiles', list);
}

/** Bỏ dữ liệu sức khoẻ khỏi bản tóm tắt. */
function summary(p: PatientProfileDetail): PatientProfileDto {
  return {
    id: p.id,
    full_name: p.full_name,
    relationship: p.relationship,
    birth_year: p.birth_year,
    mobility_status: p.mobility_status,
    location_type: p.location_type,
    data_consent_accepted: p.data_consent_accepted,
    consent_timestamp: p.consent_timestamp,
    booking_count: p.booking_count,
    deletion_requested_at: p.deletion_requested_at,
  };
}

/** Bọc handler: kiểm tra đăng nhập + tìm hồ sơ theo :id. */
function withProfile(
  fn: (ctx: { userId: string; list: PatientProfileDetail[]; index: number; body: any }) => MockResult
): MockHandler {
  return (body, { headers, params }: MockRequest) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    const list = load(userId);
    const index = list.findIndex((p) => p.id === params.id);
    if (index < 0) return fail(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ');
    return fn({ userId, list, index, body });
  };
}

export const patientProfileHandlers: Record<string, MockHandler> = {
  'GET /api/v1/patients/profiles': (_body, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    return ok(load(userId).map(summary));
  },

  'GET /api/v1/patients/profiles/:id': withProfile(({ list, index }) => {
    const p = list[index];
    if (!p.data_consent_accepted || p.deletion_requested_at) {
      return fail(403, 'CONSENT_NOT_ACTIVE', 'Hồ sơ chưa có đồng ý xử lý dữ liệu.');
    }
    return ok(p);
  }),

  'POST /api/v1/patients/profiles': (body: Partial<CreatePatientProfileRequest>, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    if (body?.data_consent_accepted !== true) {
      return fail(400, 'CONSENT_REQUIRED', 'Cần đồng ý xử lý dữ liệu sức khỏe theo NĐ 13/2023 trước khi lưu hồ sơ.');
    }
    const missing = REQUIRED.filter((k) => body[k] === undefined || body[k] === '');
    if (missing.length) return fail(400, 'VALIDATION_ERROR', 'Thiếu thông tin bắt buộc.', { fields: missing });

    const profile: PatientProfileDetail = {
      ...(body as CreatePatientProfileRequest),
      id: `pp-${Date.now()}`,
      data_consent_accepted: true,
      consent_timestamp: new Date().toISOString(),
      booking_count: 0,
      deletion_requested_at: null,
    };
    save(userId, [...load(userId), profile]);
    console.info('[mock] Đã lưu hồ sơ + consent', { ...profile, medical_history: '(ẩn)' });
    return ok(profile);
  },

  'PATCH /api/v1/patients/profiles/:id': withProfile(({ userId, list, index, body }) => {
    const p = list[index];
    if (!p.data_consent_accepted || p.deletion_requested_at) {
      return fail(403, 'CONSENT_NOT_ACTIVE', 'Hồ sơ chưa có đồng ý xử lý dữ liệu.');
    }
    const next = { ...p, ...body, id: p.id, data_consent_accepted: p.data_consent_accepted };
    list[index] = next;
    save(userId, list);
    return ok(next);
  }),

  'POST /api/v1/patients/profiles/:id/consent': withProfile(({ userId, list, index }) => {
    list[index] = { ...list[index], data_consent_accepted: true, consent_timestamp: new Date().toISOString() };
    save(userId, list);
    return ok(summary(list[index]));
  }),

  'DELETE /api/v1/patients/profiles/:id/consent': withProfile(({ userId, list, index }) => {
    list[index] = { ...list[index], data_consent_accepted: false };
    save(userId, list);
    return ok(summary(list[index]));
  }),

  'POST /api/v1/patients/profiles/:id/deletion-request': withProfile(({ userId, list, index }) => {
    list[index] = { ...list[index], deletion_requested_at: new Date().toISOString() };
    save(userId, list);
    return ok(summary(list[index]));
  }),
};
