/**
 * Mock bàn điều tra khiếu nại (Admin) — khớp docs/api/disputes.api.md + chat.api.md:
 *   GET   /admin/disputes?status=              → Dispute[] (mở trước, cũ nhất trước)
 *   GET   /disputes/:id
 *   PATCH /admin/disputes/:id/resolve { resolution, notes ≥ 10, depositDeduction? }
 *         → { updated, outcome, refunded, released, trustScoreDelta, depositDeducted, penaltyReversed }
 *         lỗi: 400 VALIDATION_ERROR · 404 DISPUTE_NOT_FOUND · 409 DISPUTE_CLOSED
 *   GET   /admin/bookings/:id/conversation     → toàn bộ chat (mỗi lần đọc ghi nhật ký VIEW_CHAT_HISTORY — mock đếm lần đọc)
 */

import type { AdminConversation, Dispute, DisputeStatus } from '../features/disputes/disputes.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData } from './mock-db';

const hours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const placeholder = (label: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240"><rect width="360" height="240" fill="#e4f2ec"/><text x="180" y="125" font-family="sans-serif" font-size="16" fill="#166b58" text-anchor="middle">${label}</text></svg>`,
  )}`;

function seed(): Dispute[] {
  return [
    {
      id: 'disp-a1', bookingId: 'bk-a1', bookingCode: 'HC-261124-AB12CD', openedBy: 'PATIENT', category: 'PREMATURE_ABANDONMENT', kind: 'BOOKING',
      description: 'Điều dưỡng rời đi sau 3 giờ trong ca 8 giờ, nói có việc gấp, không báo trước và không có người thay. Gia đình phải tự chăm bà suốt đêm.',
      status: 'OPEN', evidences: [{ id: 'e1', url: placeholder('tin-nhan-roi-ca.png'), kind: 'IMAGE', uploadedBy: 'PATIENT', fileName: 'tin-nhan-roi-ca.png', fileSizeBytes: 312_000 }],
      nurseRebuttal: null, rebuttalDueAt: hours(18), resolution: null, createdAt: hours(-6),
    },
    {
      id: 'disp-a2', bookingId: 'bk-a2', bookingCode: 'HC-261122-QW98ER', openedBy: 'PATIENT', category: 'CLINICAL_PROTOCOL_VIOLATION', kind: 'BOOKING',
      description: 'Điều dưỡng thay băng không rửa tay và dùng lại gạc đã mở trước đó; vết mổ đỏ lên sau đó.',
      status: 'UNDER_REVIEW', evidences: [
        { id: 'e2', url: placeholder('vet-mo-do.jpg'), kind: 'IMAGE', uploadedBy: 'PATIENT', fileName: 'vet-mo-do.jpg', fileSizeBytes: 540_000 },
        { id: 'e3', url: placeholder('gac-da-mo.jpg'), kind: 'IMAGE', uploadedBy: 'PATIENT', fileName: 'gac-da-mo.jpg', fileSizeBytes: 410_000 },
      ],
      nurseRebuttal: { content: 'Tôi sát khuẩn tay trước khi thao tác và dùng gạc mới theo đúng quy trình. Gạc trong ảnh là gạc dự phòng chưa dùng. Vết đỏ là phản ứng thông thường sau mổ ngày thứ 5.', submittedAt: hours(-20),
        evidences: [{ id: 'e4', url: placeholder('nhat-ky-ca.jpg'), kind: 'IMAGE', uploadedBy: 'NURSE', fileName: 'nhat-ky-ca.jpg', fileSizeBytes: 280_000 }] },
      rebuttalDueAt: hours(-10), resolution: null, createdAt: hours(-40),
    },
    {
      id: 'disp-a3', bookingId: 'bk-a3', bookingCode: 'HC-261120-ZX45CV', openedBy: 'NURSE', category: 'FALSE_CLINICAL_DECLARATION', kind: 'BOOKING',
      description: 'Hồ sơ khai người bệnh đi lại bình thường nhưng thực tế nằm liệt giường, cân nặng khoảng 90 kg; không thể thực hiện chăm sóc một mình.',
      status: 'UNDER_REVIEW', evidences: [], nurseRebuttal: null, rebuttalDueAt: hours(-30), resolution: null, createdAt: hours(-60),
    },
    {
      id: 'disp-a4', bookingId: 'bk-a4', bookingCode: 'HC-261118-LK77PO', openedBy: 'NURSE', category: 'UNPROFESSIONAL_CONDUCT', kind: 'PENALTY_APPEAL',
      description: 'Tôi bị trừ 50.000 ₫ vì "không đến" nhưng đã có mặt trước cửa đúng giờ; gia đình không mở cửa và không nghe máy.',
      status: 'OPEN', evidences: [{ id: 'e5', url: placeholder('anh-truoc-cua.jpg'), kind: 'IMAGE', uploadedBy: 'NURSE', fileName: 'anh-truoc-cua.jpg', fileSizeBytes: 350_000 }],
      nurseRebuttal: null, penaltyAmount: 50_000, penaltyReason: 'NO_SHOW_PENALTY', resolution: null, createdAt: hours(-30),
    },
    {
      id: 'disp-a5', bookingId: 'bk-a5', bookingCode: 'HC-261110-MN32BV', openedBy: 'PATIENT', category: 'UNPROFESSIONAL_CONDUCT', kind: 'BOOKING',
      description: 'Điều dưỡng đòi thêm tiền mặt ngoài hệ thống để "chăm kỹ hơn".', status: 'RESOLVED_CUSTOMER', evidences: [],
      nurseRebuttal: { content: 'Đây là hiểu lầm, tôi chỉ nói về phụ phí đi lại.', submittedAt: hours(-24 * 8) }, rebuttalDueAt: hours(-24 * 8),
      resolution: { outcome: 'RESOLVED_CUSTOMER', note: 'Lịch sử chat xác nhận điều dưỡng đề nghị nhận tiền ngoài hệ thống. Hoàn 100% cho khách, trừ TrustScore và nhắc nhở điều dưỡng.', trustScoreDelta: -25, depositDeducted: 0, resolvedAt: hours(-24 * 7), refundedToPatient: true },
      createdAt: hours(-24 * 9),
    },
  ];
}

const load = () => getUserData<Dispute[]>('admin', 'disputes', seed());
const save = (l: Dispute[]) => setUserData('admin', 'disputes', l);
const hasToken = (h: Headers) => (h.get('Authorization') ?? '').startsWith('Bearer ');
const unauthorized = () => fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');

const isOpenState = (s: DisputeStatus) => s === 'OPEN' || s === 'UNDER_REVIEW';

function conversation(d: Dispute): AdminConversation {
  const t = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const base = { callDurationSec: null, flagReasons: [] as never[] };
  const messages: AdminConversation['messages'] = [
    { id: 'c1', senderRole: 'NURSE', senderName: 'Điều dưỡng', receiverRole: 'PATIENT', type: 'TEXT', content: 'Chào gia đình, tôi sẽ có mặt đúng giờ ạ.', createdAt: t(600), ...base },
    { id: 'c2', senderRole: 'PATIENT', senderName: 'Khách hàng', receiverRole: 'NURSE', type: 'TEXT', content: 'Cảm ơn chị, bà bị dị ứng penicillin chị lưu ý giúp nhé.', createdAt: t(590), ...base },
  ];
  if (d.id === 'disp-a5') {
    messages.push({ id: 'c3', senderRole: 'NURSE', senderName: 'Điều dưỡng', receiverRole: 'PATIENT', type: 'TEXT', content: 'Anh chuyển khoản riêng cho em 200k, em chăm kỹ hơn cho.', flagged: true, flagReasons: ['OFF_PLATFORM_PAYMENT'], callDurationSec: null, createdAt: t(420) });
  }
  if (d.id === 'disp-a1') {
    messages.push({ id: 'c4', senderRole: 'NURSE', senderName: 'Điều dưỡng', receiverRole: 'PATIENT', type: 'TEXT', content: 'Em có việc gấp phải về, xin lỗi gia đình.', createdAt: t(300), ...base });
    messages.push({ id: 'c5', senderRole: 'PATIENT', senderName: 'Khách hàng', receiverRole: 'NURSE', type: 'VOICE_CALL_LOG', content: 'Cuộc gọi trong ứng dụng · 1 phút 05 giây', createdAt: t(298), flagReasons: [], callDurationSec: 65 });
  }
  return {
    bookingId: d.bookingId, bookingCode: d.bookingCode, executionStatus: d.status === 'OPEN' ? 'IN_PROGRESS' : 'COMPLETED',
    customerName: 'Nguyễn Văn An', nurseName: 'Trần Thị Mai', messages, flaggedCount: messages.filter((m) => m.flagged).length,
  };
}

export const adminDisputeHandlers: Record<string, MockHandler> = {
  'GET /api/v1/admin/disputes': (_b, { headers, query }) => {
    if (!hasToken(headers)) return unauthorized();
    const status = query.get('status');
    const all = load().filter((d) => !status || d.status === status);
    const open = all.filter((d) => isOpenState(d.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const done = all.filter((d) => !isOpenState(d.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok([...open, ...done]);
  },

  'GET /api/v1/disputes/:id': (_b, { headers, params }) => {
    if (!hasToken(headers)) return unauthorized();
    const d = load().find((x) => x.id === params.id);
    return d ? ok(d) : fail(404, 'DISPUTE_NOT_FOUND', 'Không tìm thấy khiếu nại.');
  },

  'PATCH /api/v1/admin/disputes/:id/resolve': (body: { resolution?: string; notes?: string; depositDeduction?: number }, { headers, params }) => {
    if (!hasToken(headers)) return unauthorized();
    const list = load();
    const i = list.findIndex((x) => x.id === params.id);
    if (i < 0) return fail(404, 'DISPUTE_NOT_FOUND', 'Không tìm thấy khiếu nại.');
    const d = list[i];
    const notes = (body?.notes ?? '').trim();
    if (!['RESOLVED_CUSTOMER', 'RESOLVED_NURSE'].includes(body?.resolution ?? '') || notes.length < 10 || notes.length > 2000) {
      return fail(400, 'VALIDATION_ERROR', 'Cần chọn quyết định và nhập ghi chú từ 10 đến 2000 ký tự.');
    }
    if (body.depositDeduction !== undefined && (!Number.isInteger(body.depositDeduction) || body.depositDeduction < 0)) {
      return fail(400, 'VALIDATION_ERROR', 'Số tiền trừ ký quỹ phải là số nguyên không âm.');
    }
    if (!isOpenState(d.status)) return fail(409, 'DISPUTE_CLOSED', 'Khiếu nại này đã được xử lý.');

    const resolution = body.resolution as 'RESOLVED_CUSTOMER' | 'RESOLVED_NURSE';
    const appeal = d.kind === 'PENALTY_APPEAL';
    const result = {
      updated: true, outcome: resolution,
      refunded: !appeal && resolution === 'RESOLVED_CUSTOMER' ? 180_000 : 0,
      released: !appeal && resolution === 'RESOLVED_NURSE' ? 153_000 : 0,
      trustScoreDelta: !appeal && resolution === 'RESOLVED_CUSTOMER' ? -25 : 0,
      depositDeducted: !appeal && resolution === 'RESOLVED_CUSTOMER' ? body.depositDeduction ?? 0 : 0,
      penaltyReversed: appeal && resolution === 'RESOLVED_NURSE' ? d.penaltyAmount ?? 0 : 0,
    };
    list[i] = {
      ...d, status: resolution, updatedAt: new Date().toISOString(),
      resolution: {
        outcome: resolution, note: notes, trustScoreDelta: result.trustScoreDelta, depositDeducted: result.depositDeducted, resolvedAt: new Date().toISOString(),
        refundedToPatient: result.refunded > 0, releasedToNurse: result.released > 0 || result.penaltyReversed > 0,
      },
    };
    save(list);
    return ok(result);
  },

  'GET /api/v1/admin/bookings/:id/conversation': (_b, { headers, params }) => {
    if (!hasToken(headers)) return unauthorized();
    const d = load().find((x) => x.bookingId === params.id);
    if (!d) return fail(404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.');
    const reads = getUserData<number>('admin', 'chat-reads', 0) + 1;
    setUserData('admin', 'chat-reads', reads);
    console.info(`[mock] audit_logs VIEW_CHAT_HISTORY · booking ${d.bookingCode} · lần đọc thứ ${reads}`);
    return ok(conversation(d));
  },
};
