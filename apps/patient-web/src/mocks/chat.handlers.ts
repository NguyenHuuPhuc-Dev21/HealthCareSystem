/**
 * Mock chat — khớp docs/api/chat.api.md.
 *   GET  /bookings/:id/conversation                 → hội thoại (id = id ca); mở khi CONFIRMED / IN_PROGRESS, còn lại chỉ đọc
 *   POST /bookings/:id/messages                     → TEXT { content } hoặc IMAGE { type, imageKey }; tin bị quét trúng vẫn gửi, kèm `warning`
 *   POST /bookings/:id/messages/image-upload-url    → link tải ảnh (PUT /mock-upload/:key đã có ở ekyc.handlers)
 *   POST /conversations/:id/read { lastMessageId }
 * Điều dưỡng "trả lời" tự động sau ~3,5 giây (xử lý trễ khi tải lại hội thoại) — mock không có WebSocket.
 */

import type { ChatMessage, Conversation, OffPlatformReason } from '../features/chat/chat.types';
import { CHAT_IMAGE_TYPES, CHAT_TEXT_MAX } from '../features/chat/chat.types';
import { loadMockBookings, unauthorized } from './booking.handlers';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';
import { NURSES } from './nurse-search.handlers';

const REPLY_AFTER_MS = 3_500;
const iso = (ms: number) => new Date(ms).toISOString();

interface Stored {
  messages: ChatMessage[];
  /** Hạn trả lời của "điều dưỡng" cho tin vừa gửi */
  replyDueAt: number | null;
  replies: number;
}

const NURSE_REPLIES = [
  'Dạ vâng ạ, tôi đã nhận được tin nhắn của gia đình.',
  'Tôi sẽ lưu ý điều đó khi chăm sóc, gia đình cứ yên tâm nhé.',
  'Vâng, nếu có thay đổi gì tôi sẽ báo ngay cho gia đình.',
];

const placeholder = (label: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240"><rect width="360" height="240" fill="#e4f2ec"/><text x="180" y="125" font-family="sans-serif" font-size="16" fill="#166b58" text-anchor="middle">${label}</text></svg>`,
  )}`;

/** Quét nội dung giống bộ phát hiện dùng chung của backend (mô phỏng): số điện thoại, link ngoài, thanh toán ngoài hệ thống. */
function detect(text: string): OffPlatformReason[] {
  const reasons: OffPlatformReason[] = [];
  if (/(?:\+?84|0)[\s.\-]?\d(?:[\s.\-]?\d){8}/.test(text)) reasons.push('PHONE_NUMBER');
  if (/(https?:\/\/|www\.|zalo|facebook|fb\.com|telegram|t\.me)/i.test(text)) reasons.push('EXTERNAL_LINK');
  if (/(chuyển khoản riêng|ck riêng|trả (?:tiền )?ngoài|thanh toán ngoài|không qua (?:app|ứng dụng))/i.test(text)) reasons.push('OFF_PLATFORM_PAYMENT');
  return reasons;
}

function loadStored(userId: string, bookingId: string): Stored {
  const existing = getUserData<Stored | null>(userId, `chat:${bookingId}`, null);
  if (existing) return existing;
  const seed: ChatMessage[] =
    bookingId === 'b-live' || bookingId === 'b-1050'
      ? [
          { id: `${bookingId}-m1`, conversationId: bookingId, senderRole: 'NURSE', type: 'TEXT', content: 'Chào gia đình, tôi là điều dưỡng được phân công, tôi sẽ có mặt đúng giờ ạ.', createdAt: iso(Date.now() - 6 * 3_600_000), readAt: iso(Date.now() - 5.9 * 3_600_000) },
          { id: `${bookingId}-m2`, conversationId: bookingId, senderRole: 'PATIENT', type: 'TEXT', content: 'Cảm ơn chị. Bà bị dị ứng penicillin, chị lưu ý giúp nhé.', createdAt: iso(Date.now() - 5.8 * 3_600_000), readAt: iso(Date.now() - 5.7 * 3_600_000) },
        ]
      : [];
  return { messages: seed, replyDueAt: null, replies: 0 };
}

const saveStored = (userId: string, bookingId: string, s: Stored) => setUserData(userId, `chat:${bookingId}`, s);

/** Điều dưỡng trả lời khi đến hạn, đánh dấu các tin khách đã được đọc. */
function settle(userId: string, bookingId: string, s: Stored): Stored {
  if (s.replyDueAt && Date.now() >= s.replyDueAt) {
    const now = Date.now();
    const read = s.messages.map((m) => (m.senderRole === 'PATIENT' && !m.readAt ? { ...m, readAt: iso(now) } : m));
    const reply: ChatMessage = { id: `r-${now}`, conversationId: bookingId, senderRole: 'NURSE', type: 'TEXT', content: NURSE_REPLIES[s.replies % NURSE_REPLIES.length], createdAt: iso(now), readAt: null };
    s = { messages: [...read, reply], replyDueAt: null, replies: s.replies + 1 };
    saveStored(userId, bookingId, s);
  }
  return s;
}

const SYSTEM = (bookingId: string, text: string): ChatMessage => ({
  id: `system:${bookingId}:open`, conversationId: bookingId, senderRole: 'SYSTEM', type: 'SYSTEM_ALERT', content: text, createdAt: iso(0),
});

function context(userId: string, bookingId: string) {
  const b = loadMockBookings(userId).find((x) => x.id === bookingId);
  if (!b) return null;
  const open = b.executionStatus === 'CONFIRMED' || b.executionStatus === 'IN_PROGRESS';
  const nurse = b.invitedNurse ? NURSES.find((n) => n.nurseId === b.invitedNurse!.nurseId) : NURSES[0];
  const hasNurse = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.executionStatus);
  return { b, open, nurseName: hasNurse ? nurse?.fullName ?? 'Điều dưỡng' : 'Chưa có điều dưỡng' };
}

export const chatHandlers: Record<string, MockHandler> = {
  'GET /api/v1/bookings/:id/conversation': (_b, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const ctx = context(userId, params.id);
    if (!ctx) return fail(404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.');
    const s = settle(userId, params.id, loadStored(userId, params.id));
    const banner = ctx.open
      ? '🔒 Kênh chat an toàn: số điện thoại được ẩn hoàn toàn, mọi trao đổi được lưu lại làm bằng chứng khi có tranh chấp.'
      : ctx.b.executionStatus === 'COMPLETED' ? 'Ca đã kết thúc — cuộc trò chuyện chỉ còn để xem lại.' : 'Chat chỉ mở sau khi có điều dưỡng xác nhận ca.';
    const data: Conversation = {
      id: params.id, bookingId: params.id, bookingCode: ctx.b.code, counterpartName: ctx.nurseName, counterpartPhoneMasked: '•••• ••• •••', isOpen: ctx.open,
      messages: [SYSTEM(params.id, banner), ...s.messages],
    };
    return ok(data);
  },

  'POST /api/v1/bookings/:id/messages/image-upload-url': (body: { contentType?: string }, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const ctx = context(userId, params.id);
    if (!ctx) return fail(404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.');
    if (!ctx.open) return fail(409, 'CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.', { executionStatus: ctx.b.executionStatus });
    if (!CHAT_IMAGE_TYPES.includes(body?.contentType ?? '')) return fail(400, 'VALIDATION_ERROR', 'Chỉ nhận ảnh JPG, PNG hoặc WebP.');
    const objectKey = `chat/${userId}/${crypto.randomUUID()}`;
    return { status: 201, body: { success: true, data: { objectKey, uploadUrl: `/api/v1/mock-upload/${encodeURIComponent(objectKey)}`, expiresInSeconds: 600, contentType: body.contentType } } };
  },

  'POST /api/v1/bookings/:id/messages': (body: { content?: string; type?: string; imageKey?: string }, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    const ctx = context(userId, params.id);
    if (!ctx) return fail(404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.');
    if (!ctx.open) return fail(409, 'CONVERSATION_CLOSED', 'Cuộc trò chuyện đã đóng.', { executionStatus: ctx.b.executionStatus });

    const s = settle(userId, params.id, loadStored(userId, params.id));
    const now = Date.now();
    let msg: ChatMessage;
    let warning: { reasons: OffPlatformReason[]; message: string } | null = null;

    if (body?.type === 'IMAGE') {
      if (!body.imageKey?.startsWith(`chat/${userId}/`)) return fail(400, 'IMAGE_KEY_INVALID', 'Ảnh không hợp lệ.');
      msg = { id: `m-${now}`, conversationId: params.id, senderRole: 'PATIENT', type: 'IMAGE', content: '📷 Hình ảnh', imageUrl: placeholder('Ảnh đã gửi (mô phỏng)'), createdAt: iso(now), readAt: null };
    } else {
      const content = (body?.content ?? '').trim();
      if (!content || content.length > CHAT_TEXT_MAX) return fail(400, 'VALIDATION_ERROR', `Tin nhắn từ 1 đến ${CHAT_TEXT_MAX} ký tự.`);
      const reasons = detect(content);
      if (reasons.length) {
        warning = { reasons, message: 'Phát hiện số điện thoại cá nhân, liên kết ngoài hoặc đề nghị thanh toán ngoài hệ thống. Để được bảo vệ khi có tranh chấp, hãy giữ mọi trao đổi và thanh toán trong ứng dụng.' };
      }
      msg = { id: `m-${now}`, conversationId: params.id, senderRole: 'PATIENT', type: 'TEXT', content, flagged: reasons.length > 0, createdAt: iso(now), readAt: null };
    }
    saveStored(userId, params.id, { ...s, messages: [...s.messages, msg], replyDueAt: now + REPLY_AFTER_MS });
    return { status: 201, body: { success: true, data: { ...msg, warning } } };
  },

  'POST /api/v1/conversations/:id/read': (body: { lastMessageId?: string }, { headers, params }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return unauthorized();
    if (!context(userId, params.id)) return fail(404, 'CONVERSATION_NOT_FOUND', 'Không tìm thấy cuộc trò chuyện.');
    const s = loadStored(userId, params.id);
    const idx = s.messages.findIndex((m) => m.id === body?.lastMessageId);
    if (idx < 0) return fail(404, 'MESSAGE_NOT_FOUND', 'Không tìm thấy tin nhắn.');
    const t = iso(Date.now());
    saveStored(userId, params.id, { ...s, messages: s.messages.map((m, i) => (i <= idx && m.senderRole === 'NURSE' && !m.readAt ? { ...m, readAt: t } : m)) });
    return ok({ success: true });
  },
};
