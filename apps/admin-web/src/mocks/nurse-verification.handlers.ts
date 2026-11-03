/**
 * Mock duyệt hồ sơ điều dưỡng — dữ liệu mẫu đúng như thiết kế A2/A3:
 *   Phạm Thu Hà (mới, GPHN còn hạn → gợi ý Cấp 2) · Trần Thị Mai (gia hạn GPHN)
 *   Lê Văn Đức (mới, chưa có GPHN → Cấp 1) · Đỗ Thị Lan (mới, GPHN hết hạn + hưu trí → Cấp 1)
 * Trạng thái lưu localStorage 'mock_db' (xoá: localStorage.removeItem('mock_db')).
 */

import type {
  CredentialDocType,
  NurseReviewDetail,
  NurseTier,
  QueueItem,
  VerifyNurseRequest,
} from '../features/nurse-verification/nurse-verification.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler, MockRequest } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';

const HOUR = 3600_000;
const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

type Seed = NurseReviewDetail & { subtitle: string; suggestion_note: string };

function creds(nurseId: string, types: CredentialDocType[]) {
  return types.map((t) => ({ id: `${nurseId}-${t}`, doc_type: t, verification_status: 'PENDING' as const }));
}

const SEED: Seed[] = [
  {
    nurse_id: 'n-ha', full_name: 'Phạm Thu Hà', phone_masked: '0905 ••• 214', subtitle: 'Đà Nẵng · 6 năm kinh nghiệm',
    address: 'Hải Châu, Đà Nẵng', years_of_exp: 6, cccd_number_masked: '048192 ••• •37',
    request_type: 'NEW', submitted_at: ago(2), review_status: 'PENDING', current_tier: null,
    suggested_tier: 'TIER_2_SPECIALIST', suggestion_reason: 'có GPHN còn hạn',
    suggestion_note: 'GPHN 01284/GPHN-ĐN · còn hạn tới 15/05/2027',
    gphn: { number: '01284/GPHN-ĐN', issuer: 'Sở Y tế TP. Đà Nẵng', issued_date: '2020-05-15', expiry_date: '2027-05-15', scope_of_practice: 'Điều dưỡng đa khoa', is_valid: true, days_remaining: 193, identity_match: true },
    degree: { title: 'Cao đẳng Điều dưỡng', year: 2019 }, retirement_submitted: false,
    credentials: creds('n-ha', ['CCCD_FRONT', 'CCCD_BACK', 'DEGREE', 'GPHN', 'SELFIE']),
  },
  {
    nurse_id: 'n-mai', full_name: 'Trần Thị Mai', phone_masked: '0905 ••• 123', subtitle: 'Đà Nẵng · đang hoạt động Cấp 2',
    address: 'Thanh Khê, Đà Nẵng', years_of_exp: 31, cccd_number_masked: '048165 ••• •02',
    request_type: 'RENEWAL', submitted_at: ago(3), review_status: 'PENDING', current_tier: 'TIER_2_SPECIALIST',
    suggested_tier: 'TIER_2_SPECIALIST', suggestion_reason: 'GPHN mới còn hạn',
    suggestion_note: 'GPHN hiện tại 00976/GPHN-ĐN hết hạn 12/04/2027',
    gphn: { number: '00976-GH/GPHN-ĐN', issuer: 'Sở Y tế TP. Đà Nẵng', issued_date: '2026-10-20', expiry_date: '2031-10-20', scope_of_practice: 'Điều dưỡng đa khoa', is_valid: true, days_remaining: 1812, identity_match: true },
    degree: { title: 'Đại học Điều dưỡng', year: 1993 }, retirement_submitted: true,
    credentials: creds('n-mai', ['GPHN', 'CCCD_FRONT', 'CCCD_BACK', 'DEGREE', 'RETIREMENT_DECISION', 'SELFIE']),
  },
  {
    nurse_id: 'n-duc', full_name: 'Lê Văn Đức', phone_masked: '0914 ••• 876', subtitle: 'Quảng Nam · sinh viên mới tốt nghiệp',
    address: 'Tam Kỳ, Quảng Nam', years_of_exp: 0, cccd_number_masked: '049201 ••• •55',
    request_type: 'NEW', submitted_at: ago(19), review_status: 'PENDING', current_tier: null,
    suggested_tier: 'TIER_1_BASIC', suggestion_reason: 'chưa có GPHN',
    suggestion_note: 'Chưa có GPHN — chỉ nhận ca không xâm lấn',
    gphn: null, degree: { title: 'Cao đẳng Điều dưỡng', year: 2026 }, retirement_submitted: false,
    credentials: creds('n-duc', ['CCCD_FRONT', 'CCCD_BACK', 'DEGREE', 'SELFIE']),
  },
  {
    nurse_id: 'n-lan', full_name: 'Đỗ Thị Lan', phone_masked: '0935 ••• 402', subtitle: 'Đà Nẵng · nhân viên y tế đã nghỉ hưu',
    address: 'Sơn Trà, Đà Nẵng', years_of_exp: 28, cccd_number_masked: '048161 ••• •19',
    request_type: 'NEW', submitted_at: ago(26), review_status: 'PENDING', current_tier: null,
    suggested_tier: 'TIER_1_BASIC', suggestion_reason: 'GPHN đã hết hạn',
    suggestion_note: 'GPHN đã hết hạn 30/06/2026 — hưu trí chỉ gắn huy hiệu',
    gphn: { number: '00412/GPHN-ĐN', issuer: 'Sở Y tế TP. Đà Nẵng', issued_date: '2016-06-30', expiry_date: '2026-06-30', scope_of_practice: 'Điều dưỡng đa khoa', is_valid: false, days_remaining: null, identity_match: true },
    degree: { title: 'Trung cấp Điều dưỡng', year: 1990 }, retirement_submitted: true,
    credentials: creds('n-lan', ['CCCD_FRONT', 'CCCD_BACK', 'DEGREE', 'GPHN', 'RETIREMENT_DECISION', 'SELFIE']),
  },
];

const DB_USER = 'admin-shared';

function loadAll(): Seed[] {
  return getUserData<Seed[]>(DB_USER, 'nurse_reviews', SEED);
}
function saveAll(list: Seed[]) {
  setUserData(DB_USER, 'nurse_reviews', list);
}

function toQueueItem(s: Seed): QueueItem {
  const has = (t: CredentialDocType) => s.credentials.some((c) => c.doc_type === t);
  return {
    nurse_id: s.nurse_id,
    full_name: s.full_name,
    phone_masked: s.phone_masked,
    subtitle: s.subtitle,
    request_type: s.request_type,
    submitted_at: s.submitted_at,
    documents: {
      cccd: has('CCCD_FRONT') && has('CCCD_BACK'),
      degree: has('DEGREE'),
      gphn: !s.gphn ? 'NONE' : s.request_type === 'RENEWAL' ? 'NEW_SUBMITTED' : s.gphn.is_valid ? 'VALID' : 'EXPIRED',
      retirement: s.retirement_submitted,
    },
    current_tier: s.current_tier,
    suggested_tier: s.suggested_tier,
    suggestion_note: s.suggestion_note,
    review_status: s.review_status,
    assigned_tier: s.assigned_tier ?? null,
    reviewed_by_name: s.reviewed_by_name ?? null,
    reviewed_at: s.reviewed_at ?? null,
  };
}

function requireAdmin(headers: Headers) {
  const id = userIdFromHeaders(headers);
  if (!id) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
  if (id !== 'u-admin') return fail(403, 'FORBIDDEN', 'Chỉ Admin được truy cập');
  return null;
}

/** Ảnh giấy tờ giả (SVG) — thay cho presigned URL S3. */
function fakeDocImage(nurse: Seed, type: CredentialDocType): string {
  const titles: Record<CredentialDocType, string> = {
    CCCD_FRONT: 'CĂN CƯỚC CÔNG DÂN — MẶT TRƯỚC',
    CCCD_BACK: 'CĂN CƯỚC CÔNG DÂN — MẶT SAU',
    DEGREE: 'BẰNG TỐT NGHIỆP',
    GPHN: 'GIẤY PHÉP HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH',
    SELFIE: 'ẢNH CHÂN DUNG TRỰC TIẾP',
    RETIREMENT_DECISION: 'QUYẾT ĐỊNH NGHỈ HƯU',
  };
  const line2 = type === 'GPHN' ? `Số: ${nurse.gphn?.number ?? '—'}` : type.startsWith('CCCD') ? `Số: ${nurse.cccd_number_masked}` : type === 'DEGREE' ? nurse.degree?.title ?? '' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
    <rect width="900" height="600" rx="24" fill="#F7FBF9"/><rect x="24" y="24" width="852" height="552" rx="16" fill="none" stroke="#166B58" stroke-width="4" stroke-dasharray="${type === 'SELFIE' ? '0' : '12 8'}"/>
    <text x="450" y="120" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="#143F34">${titles[type]}</text>
    <text x="450" y="200" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="800" fill="#166B58">${nurse.full_name}</text>
    <text x="450" y="260" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#46645B">${line2}</text>
    <text x="450" y="540" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#77948A">ẢNH MẪU (MOCK) — presigned URL 10 phút</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const nurseVerificationHandlers: Record<string, MockHandler> = {
  'GET /api/v1/admin/nurses/verification-queue/summary': (_b, { headers }) => {
    const denied = requireAdmin(headers);
    if (denied) return denied;
    const pending = loadAll().filter((s) => s.review_status === 'PENDING');
    return ok({ NEW: pending.filter((s) => s.request_type === 'NEW').length, RENEWAL: pending.filter((s) => s.request_type === 'RENEWAL').length });
  },

  'GET /api/v1/admin/nurses/verification-queue': (_b, { headers, query }: MockRequest) => {
    const denied = requireAdmin(headers);
    if (denied) return denied;
    const tab = query.get('tab') ?? 'NEW';
    const q = (query.get('q') ?? '').toLowerCase();
    const submitted = query.get('submitted');
    const docs = query.get('docs');
    let list = loadAll();
    list = tab === 'PROCESSED' ? list.filter((s) => s.review_status !== 'PENDING') : list.filter((s) => s.review_status === 'PENDING' && s.request_type === tab);
    if (q) {
      const digits = q.replace(/\D/g, '');
      list = list.filter((s) => s.full_name.toLowerCase().includes(q) || (digits.length > 0 && s.phone_masked.replace(/\D/g, '').includes(digits)));
    }
    if (submitted === 'TODAY') list = list.filter((s) => Date.now() - new Date(s.submitted_at).getTime() < 24 * HOUR && new Date(s.submitted_at).getDate() === new Date().getDate());
    if (submitted === 'OVER_24H') list = list.filter((s) => Date.now() - new Date(s.submitted_at).getTime() >= 24 * HOUR);
    if (docs === 'HAS_GPHN') list = list.filter((s) => !!s.gphn);
    if (docs === 'DEGREE_ONLY') list = list.filter((s) => !s.gphn && !!s.degree);
    if (docs === 'HAS_RETIREMENT') list = list.filter((s) => s.retirement_submitted);
    return ok(list.map(toQueueItem));
  },

  'GET /api/v1/admin/nurses/:id/verification': (_b, { headers, params }) => {
    const denied = requireAdmin(headers);
    if (denied) return denied;
    const found = loadAll().find((s) => s.nurse_id === params.id);
    return found ? ok(found) : fail(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ');
  },

  'GET /api/v1/admin/nurses/:id/credentials/:credId/url': (_b, { headers, params }) => {
    const denied = requireAdmin(headers);
    if (denied) return denied;
    const nurse = loadAll().find((s) => s.nurse_id === params.id);
    const cred = nurse?.credentials.find((c) => c.id === params.credId);
    if (!nurse || !cred) return fail(404, 'NOT_FOUND', 'Không tìm thấy giấy tờ');
    return ok({ url: fakeDocImage(nurse, cred.doc_type), expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
  },

  'PATCH /api/v1/admin/nurses/:id/verify': (body: VerifyNurseRequest, { headers, params }) => {
    const denied = requireAdmin(headers);
    if (denied) return denied;
    const list = loadAll();
    const i = list.findIndex((s) => s.nurse_id === params.id);
    if (i < 0) return fail(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ');
    const s = list[i];
    if (s.review_status !== 'PENDING') return fail(409, 'ALREADY_REVIEWED', 'Hồ sơ đã được xử lý bởi Admin khác.');
    if (body.decision === 'REJECTED' && !body.rejection_reason?.trim()) {
      return fail(400, 'REJECTION_REASON_REQUIRED', 'Cần nhập lý do từ chối.');
    }
    let tier: NurseTier | null = null;
    if (body.decision === 'APPROVED') {
      tier = s.request_type === 'RENEWAL' ? 'TIER_2_SPECIALIST' : body.tier ?? null;
      if (!tier) return fail(400, 'TIER_REQUIRED', 'Cần chọn cấp khi duyệt.');
      // Backend là nơi chặn thật (FR-AUTH-02): Cấp 2 bắt buộc GPHN còn hạn
      if (tier === 'TIER_2_SPECIALIST' && !s.gphn?.is_valid) {
        return fail(422, 'TIER2_REQUIRES_VALID_GPHN', 'Không thể gán Cấp 2 khi chưa có GPHN còn hạn.');
      }
    }
    const status = body.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    list[i] = {
      ...s,
      review_status: status,
      assigned_tier: tier,
      rejection_reason: body.rejection_reason ?? null,
      reviewed_by_name: 'Admin vận hành',
      reviewed_at: new Date().toISOString(),
      credentials: s.credentials.map((c) => ({ ...c, verification_status: status })),
    };
    saveAll(list);
    console.info('[mock] audit_logs: APPROVE_GPHN', { nurse: s.nurse_id, decision: body.decision, tier });
    return ok(list[i]);
  },
};
