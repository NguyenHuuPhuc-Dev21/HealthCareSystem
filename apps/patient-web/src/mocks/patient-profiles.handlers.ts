/**
 * Mock hồ sơ người bệnh — mô phỏng contract backend (patient-profiles + privacy-consent).
 *   GET   /patient-profiles                        → { items } tóm tắt (không có medicalHistory)
 *   GET   /patient-profiles/:id                    → chi tiết
 *   POST  /patient-profiles                        → thiếu dataConsentAccepted=true → 400 CONSENT_REQUIRED (TC-PRIV-01)
 *   PATCH /patient-profiles/:id
 *   POST  /patient-profiles/:id/consent/withdraw   → 409 CONSENT_ALREADY_WITHDRAWN nếu đã rút
 *   POST  /privacy-requests · GET /privacy-requests
 *
 * Tài khoản 0905 123 456 có sẵn 2 hồ sơ mẫu (bà Hoa, ông Đức) giống thiết kế P13.
 */

import { fail, ok } from './mock-fetch';
import type { MockHandler, MockRequest, MockResult } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';

export interface MockProfile {
  id: string;
  fullName: string;
  dob: string | null;
  gender: string | null;
  weightKg: number | null;
  mobilityStatus: 'NORMAL' | 'PARTIAL' | 'BEDRIDDEN';
  medicalHistory: string | null;
  isInfectious: boolean;
  addressText: string;
  locationType: 'HOME' | 'HOSPITAL';
  lat: number;
  lng: number;
  consent: { accepted: boolean; acceptedAt: string | null; withdrawnAt: string | null };
  createdAt: string;
}

interface MockPrivacyRequest {
  requestId: string;
  patientProfileId: string;
  requestType: 'DELETE' | 'ANONYMIZE';
  status: 'PENDING' | 'DONE' | 'REJECTED';
  createdAt: string;
  processedAt: string | null;
}

const SAMPLE: MockProfile[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    fullName: 'Nguyễn Thị Hoa',
    dob: '1948-01-01',
    gender: 'FEMALE',
    weightKg: 52,
    mobilityStatus: 'PARTIAL',
    medicalHistory: 'Tăng huyết áp, đái tháo đường type 2. Đã thay khớp háng phải (3 tháng trước). Dị ứng Penicillin.',
    isInfectious: false,
    addressText: '25 Quang Trung, Hải Châu 1, Hải Châu, Đà Nẵng',
    locationType: 'HOME',
    lat: 16.0717,
    lng: 108.2208,
    consent: { accepted: true, acceptedAt: '2026-10-12T02:41:00Z', withdrawnAt: null },
    createdAt: '2026-10-12T02:41:00Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    fullName: 'Nguyễn Văn Đức',
    dob: '1944-01-01',
    gender: 'MALE',
    weightKg: 61,
    mobilityStatus: 'NORMAL',
    medicalHistory: 'Thoái hóa khớp gối hai bên. Không dị ứng thuốc.',
    isInfectious: false,
    addressText: '25 Quang Trung, Hải Châu 1, Hải Châu, Đà Nẵng',
    locationType: 'HOME',
    lat: 16.0717,
    lng: 108.2208,
    consent: { accepted: true, acceptedAt: '2026-10-12T02:43:00Z', withdrawnAt: null },
    createdAt: '2026-10-12T02:43:00Z',
  },
];

export const loadMockProfiles = (userId: string) =>
  getUserData<MockProfile[]>(userId, 'profiles', userId === 'u-patient-verified' ? SAMPLE : []);
const save = (userId: string, list: MockProfile[]) => setUserData(userId, 'profiles', list);
const loadRequests = (userId: string) => getUserData<MockPrivacyRequest[]>(userId, 'privacy-requests', []);

const summary = ({ medicalHistory: _m, ...rest }: MockProfile) => rest;

const REQUIRED: Array<keyof MockProfile> = ['fullName', 'addressText', 'locationType', 'lat', 'lng'];

function withProfile(
  fn: (ctx: { userId: string; list: MockProfile[]; index: number; body: any }) => MockResult,
): MockHandler {
  return (body, { headers, params }: MockRequest) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    const list = loadMockProfiles(userId);
    const index = list.findIndex((p) => p.id === params.id);
    if (index < 0) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập hồ sơ này');
    return fn({ userId, list, index, body });
  };
}

export const patientProfileHandlers: Record<string, MockHandler> = {
  'GET /api/v1/patient-profiles': (_body, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    return ok({ items: loadMockProfiles(userId).map(summary) });
  },

  'GET /api/v1/patient-profiles/:id': withProfile(({ list, index }) => ok(list[index])),

  'POST /api/v1/patient-profiles': (body: Record<string, any>, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    if (body?.dataConsentAccepted !== true) {
      return fail(400, 'CONSENT_REQUIRED', 'Cần đồng ý xử lý dữ liệu sức khỏe theo NĐ 13/2023 trước khi lưu hồ sơ.');
    }
    const missing = REQUIRED.filter((k) => body[k] === undefined || body[k] === null || body[k] === '');
    if (missing.length) return fail(400, 'VALIDATION_ERROR', 'Thiếu thông tin bắt buộc.', { fields: missing });

    const now = new Date().toISOString();
    const { dataConsentAccepted: _c, ...fields } = body;
    const profile: MockProfile = {
      gender: null,
      dob: null,
      weightKg: null,
      medicalHistory: null,
      isInfectious: false,
      mobilityStatus: 'NORMAL',
      ...fields,
      id: crypto.randomUUID(),
      consent: { accepted: true, acceptedAt: now, withdrawnAt: null },
      createdAt: now,
    } as MockProfile;
    save(userId, [...loadMockProfiles(userId), profile]);
    console.info('[mock] Đã lưu hồ sơ + consent', { ...profile, medicalHistory: '(ẩn)' });
    return { status: 201, body: { success: true, data: profile } };
  },

  'PATCH /api/v1/patient-profiles/:id': withProfile(({ userId, list, index, body }) => {
    if (!body || Object.keys(body).length === 0) return fail(400, 'VALIDATION_ERROR', 'Cần ít nhất một trường để sửa.');
    list[index] = { ...list[index], ...body, id: list[index].id, consent: list[index].consent };
    save(userId, list);
    return ok(list[index]);
  }),

  'POST /api/v1/patient-profiles/:id/consent/withdraw': withProfile(({ userId, list, index }) => {
    if (!list[index].consent.accepted) return fail(409, 'CONSENT_ALREADY_WITHDRAWN', 'Đã rút đồng ý trước đó.');
    const withdrawnAt = new Date().toISOString();
    list[index] = { ...list[index], consent: { ...list[index].consent, accepted: false, withdrawnAt } };
    save(userId, list);
    return ok({ consent: 'WITHDRAWN', withdrawnAt });
  }),

  'GET /api/v1/privacy-requests': (_body, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    return ok(loadRequests(userId));
  },

  'POST /api/v1/privacy-requests': (body: { patientProfileId?: string; requestType?: string }, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    if (!loadMockProfiles(userId).some((p) => p.id === body?.patientProfileId)) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập hồ sơ này');
    if (body.requestType !== 'DELETE' && body.requestType !== 'ANONYMIZE') {
      return fail(400, 'VALIDATION_ERROR', 'Loại yêu cầu không hợp lệ.');
    }
    const requests = loadRequests(userId);
    if (requests.some((r) => r.patientProfileId === body.patientProfileId && r.status === 'PENDING')) {
      return fail(409, 'REQUEST_ALREADY_PENDING', 'Đã có yêu cầu đang chờ xử lý.');
    }
    const created: MockPrivacyRequest = {
      requestId: crypto.randomUUID(),
      patientProfileId: body.patientProfileId!,
      requestType: body.requestType,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      processedAt: null,
    };
    setUserData(userId, 'privacy-requests', [created, ...requests]);
    return { status: 201, body: { success: true, data: { requestId: created.requestId, status: 'PENDING' } } };
  },
};
