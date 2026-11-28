/**
 * Mock khiếu nại của khách — khớp docs/api/disputes.api.md, thêm 1 endpoint ĐỀ XUẤT để tải bằng chứng trước khi mở khiếu nại:
 *   POST /bookings/:id/disputes/evidence-upload-urls   ← chưa có ở backend (xem disputes.api.ts)
 *   POST /bookings/:id/disputes                        ← cửa sổ: IN_PROGRESS hoặc COMPLETED chưa quyết toán; mỗi ca 1 khiếu nại; ≤ 5 bằng chứng
 *   POST /disputes/:id/evidence-upload-urls · GET /patient/disputes · GET /disputes/:id
 * Sau ~25 giây điều dưỡng "phản hồi" → UNDER_REVIEW + thông báo DISPUTE_UPDATED (để thử trung tâm thông báo).
 */

import type { Dispute, DisputeCategory, PresignedUploadUrl } from '../features/disputes/disputes.types';
import { MAX_EVIDENCE_FILES } from '../features/disputes/disputes.types';
import { loadMockBookings, saveMockBookings, unauthorized } from './booking.handlers';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';
import { pushMockNotification, registerMockTick } from './notifications.handlers';

const REBUTTAL_AFTER_MS = 25_000;
const REBUTTAL_HOURS = 24;
const OK_EXT = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
const iso = (ms: number) => new Date(ms).toISOString();

const ago = (min: number) => iso(Date.now() - min * 60_000);

const placeholder = (label: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220"><rect width="320" height="220" fill="#e4f2ec"/><text x="160" y="110" font-family="sans-serif" font-size="15" fill="#166b58" text-anchor="middle">${label.replace(/[<&>]/g, '')}</text></svg>`,
  )}`;

function seed(): Dispute[] {
  return [
    {
      id: 'disp-seed-1', bookingId: 'b-1042', bookingCode: 'HC-2026-1042', openedBy: 'PATIENT', category: 'CLINICAL_PROTOCOL_VIOLATION',
      description: 'Điều dưỡng thay băng không rửa tay và dùng lại gạc đã mở trước đó.', status: 'UNDER_REVIEW', kind: 'BOOKING',
      evidences: [{ id: 'e1', url: placeholder('anh-thay-bang.jpg'), kind: 'IMAGE', uploadedBy: 'PATIENT', fileName: 'anh-thay-bang.jpg', fileSizeBytes: 482_000 }],
      nurseRebuttal: { content: 'Tôi đã sát khuẩn tay trước khi thao tác và dùng gạc mới theo đúng quy trình; gạc trong ảnh là gạc dự phòng chưa dùng.', submittedAt: ago(25) },
      rebuttalDueAt: iso(Date.now() + 20 * 3_600_000), resolution: null, createdAt: ago(60 * 5),
    },
    {
      id: 'disp-seed-2', bookingId: 'b-0990', bookingCode: 'HC-2026-0990', openedBy: 'PATIENT', category: 'PREMATURE_ABANDONMENT',
      description: 'Điều dưỡng rời đi sau 3 giờ trong ca 8 giờ, không báo trước.', status: 'RESOLVED_CUSTOMER', kind: 'BOOKING', evidences: [],
      nurseRebuttal: null, rebuttalDueAt: ago(60 * 24 * 5),
      resolution: { outcome: 'RESOLVED_CUSTOMER', note: 'Đối chiếu nhật ký GPS và giờ check-out cho thấy điều dưỡng rời ca sớm. Hoàn 100% tiền đang tạm giữ cho khách.', resolvedAt: ago(60 * 72), refundedToPatient: true },
      createdAt: ago(60 * 24 * 6),
    },
  ];
}

const load = (userId: string): Dispute[] => {
  const list = getUserData<Dispute[]>(userId, 'disputes', userId === 'u-patient-verified' ? seed() : []);
  let changed = false;
  const now = Date.now();
  const next = list.map((d) => {
    if (d.id.startsWith('disp-seed')) return d;
    if (d.status === 'OPEN' && now - Date.parse(d.createdAt) >= REBUTTAL_AFTER_MS) {
      changed = true;
      pushMockNotification(userId, {
        type: 'DISPUTE_UPDATED', title: 'Điều dưỡng đã phản hồi khiếu nại',
        body: `Điều dưỡng gửi giải trình cho khiếu nại ca ${d.bookingCode}. Admin sẽ xem xét.`,
        data: { disputeId: d.id, bookingId: d.bookingId, bookingCode: d.bookingCode },
      });
      return {
        ...d, status: 'UNDER_REVIEW' as const, updatedAt: iso(now),
        nurseRebuttal: { content: 'Tôi đã thực hiện đúng quy trình và y lệnh của bác sĩ. Xin Admin đối chiếu nhật ký ca.', submittedAt: iso(now) },
      };
    }
    return d;
  });
  if (changed) setUserData(userId, 'disputes', next);
  return next;
};

registerMockTick((userId) => {
  load(userId);
});

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

function issueUrls(userId: string, names: string[]): PresignedUploadUrl[] {
  const meta = getUserData<Record<string, { name: string; kind: 'IMAGE' | 'VIDEO'; size: number }>>(userId, 'evidence-meta', {});
  const out = names.map((fileName) => {
    const key = `dispute-evidence/${userId}/${crypto.randomUUID()}.${extOf(fileName)}`;
    meta[key] = { name: fileName, kind: 'IMAGE', size: 0 };
    return { fileId: key, fileName, uploadUrl: `/api/v1/mock-upload/${encodeURIComponent(key)}`, publicUrl: key };
  });
  setUserData(userId, 'evidence-meta', meta);
  return out;
}

function validateNames(body: { file_names?: unknown }) {
  const names = body?.file_names;
  if (!Array.isArray(names) || names.length < 1 || names.length > MAX_EVIDENCE_FILES) return fail(400, 'VALIDATION_ERROR', `Chọn từ 1 đến ${MAX_EVIDENCE_FILES} tệp.`);
  const bad = (names as string[]).find((n) => !OK_EXT.includes(extOf(String(n))));
  if (bad) return fail(400, 'UNSUPPORTED_FILE_TYPE', `Chỉ nhận JPG, PNG, WEBP hoặc PDF: ${bad}`);
  return null;
}

export const disputeHandlers: Record<string, MockHandler> = {
  'POST /api/v1/bookings/:id/disputes/evidence-upload-urls': (body: { file_names?: string[] }, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    if (!loadMockBookings(userId).some((b) => b.id === params.id)) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
    return validateNames(body) ?? ok(issueUrls(userId, body.file_names!));
  },

  'POST /api/v1/disputes/:id/evidence-upload-urls': (body: { file_names?: string[] }, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const d = load(userId).find((x) => x.id === params.id);
    if (!d) return fail(404, 'DISPUTE_NOT_FOUND', 'Không tìm thấy khiếu nại.');
    if (d.status !== 'OPEN' && d.status !== 'UNDER_REVIEW') return fail(409, 'DISPUTE_CLOSED', 'Khiếu nại này đã được xử lý.');
    return validateNames(body) ?? ok(issueUrls(userId, body.file_names!));
  },

  'POST /api/v1/bookings/:id/disputes': (
    body: { category?: DisputeCategory; description?: string; reason?: string; evidenceUrls?: string[] },
    { headers, params },
  ) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const list = loadMockBookings(userId);
    const i = list.findIndex((b) => b.id === params.id);
    if (i < 0) return fail(403, 'FORBIDDEN', 'Không có quyền truy cập ca này.');
    const b = list[i];

    const description = (body?.description ?? body?.reason ?? '').trim();
    if (description.length < 10) return fail(400, 'VALIDATION_ERROR', 'Hãy mô tả vấn đề (ít nhất 10 ký tự).');
    const keys = body?.evidenceUrls ?? [];
    if (keys.length > MAX_EVIDENCE_FILES) return fail(400, 'VALIDATION_ERROR', `Tối đa ${MAX_EVIDENCE_FILES} tệp bằng chứng.`);
    if (keys.some((k) => !k.startsWith(`dispute-evidence/${userId}/`))) return fail(400, 'INVALID_EVIDENCE', 'Bằng chứng phải được tải lên qua liên kết do hệ thống cấp.');

    if (b.disputeStatus !== 'NONE') return fail(409, 'DISPUTE_EXISTS', 'Ca này đã có khiếu nại đang mở.');
    const inWindow = b.executionStatus === 'IN_PROGRESS' || (b.executionStatus === 'COMPLETED' && b.paymentStatus !== 'SETTLED' && b.paymentStatus !== 'REFUNDED');
    if (!inWindow) return fail(409, 'DISPUTE_WINDOW_CLOSED', 'Đã quá thời hạn khiếu nại (trong ca hoặc 24 giờ sau khi kết thúc).');

    const meta = getUserData<Record<string, { name: string; kind: 'IMAGE' | 'VIDEO'; size: number }>>(userId, 'evidence-meta', {});
    const now = Date.now();
    const dispute: Dispute = {
      id: `disp-${now}`, bookingId: b.id, bookingCode: b.code, openedBy: 'PATIENT', category: body?.category ?? 'UNPROFESSIONAL_CONDUCT', description,
      status: 'OPEN', kind: 'BOOKING', nurseRebuttal: null, resolution: null, rebuttalDueAt: iso(now + REBUTTAL_HOURS * 3_600_000), createdAt: iso(now),
      evidences: keys.map((k, n) => ({
        id: `ev-${now}-${n}`, kind: 'IMAGE', uploadedBy: 'PATIENT', fileName: meta[k]?.name ?? 'bang-chung', url: placeholder(meta[k]?.name ?? 'bang-chung'),
      })),
    };
    // Mở khiếu nại đóng băng escrow (FR-DISP-01): dispute_status = OPEN
    list[i] = { ...b, disputeStatus: 'OPEN', escrow: b.escrow ? { ...b.escrow, frozenByDispute: true } : b.escrow };
    saveMockBookings(userId, list);
    setUserData(userId, 'disputes', [dispute, ...load(userId)]);
    return { status: 201, body: { success: true, data: { dispute_id: dispute.id } } };
  },

  'GET /api/v1/patient/disputes': (_b, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    return ok(load(userId));
  },

  'GET /api/v1/disputes/:id': (_b, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const d = load(userId).find((x) => x.id === params.id);
    return d ? ok(d) : fail(404, 'DISPUTE_NOT_FOUND', 'Không tìm thấy khiếu nại.');
  },
};
