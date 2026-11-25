/**
 * chat — pure rules (BE-2 · Phase 6 · FR-CHAT-01 · RISK-06).
 */
import {
  ExecutionStatus,
  MessageType,
  detectOffPlatformContact,
  type ChatMessageDto,
  type ConversationDto,
  type OffPlatformReason,
} from '@healthcare-system/shared';
import type { ChatBookingRow, ChatRole, ChatViewer, MessageRow } from './chat.types';

/** FR-CHAT-01: chat opens once the booking is CONFIRMED and closes when the shift ends (or is cancelled / expired). */
export function isChatOpen(executionStatus: string): boolean {
  return executionStatus === ExecutionStatus.CONFIRMED || executionStatus === ExecutionStatus.IN_PROGRESS;
}

/** The viewer's side in this booking, or null when she/he is not a participant (the current nurse only). */
export function participantRole(b: Pick<ChatBookingRow, 'customer_id' | 'nurse_id'>, viewer: ChatViewer): ChatRole | null {
  if (viewer.role === 'PATIENT' && b.customer_id === viewer.id) return 'PATIENT';
  if (viewer.role === 'NURSE' && b.nurse_id !== null && b.nurse_id === viewer.id) return 'NURSE';
  return null;
}

export function counterpartOf(b: ChatBookingRow, role: ChatRole): { id: string | null; name: string } {
  return role === 'PATIENT' ? { id: b.nurse_id, name: b.nurse_name ?? 'Điều dưỡng' } : { id: b.customer_id, name: b.customer_name };
}

/**
 * SRS FR-CHAT-01: "số điện thoại thật của hai phía được che hoàn toàn" — no digit is returned (the shared
 * maskPhoneNumber keeps 7 of 10 digits, which is not "hoàn toàn"). The app shows this placeholder; calls go through
 * the in-app call, never through the number.
 */
export const MASKED_PHONE = '•••• ••• •••';

export interface ScanResult {
  flagged: boolean;
  reasons: OffPlatformReason[];
  matches: string[];
  warning: string | null;
}

/** Regex scan shared with the apps (packages/shared contact-detector): phone numbers, links, off-platform payment. */
export function scanMessage(text: string): ScanResult {
  const r = detectOffPlatformContact(text);
  return {
    flagged: r.hasOffPlatformContact,
    reasons: r.reasons,
    matches: r.matches.slice(0, 20).map((m) => m.slice(0, 200)),
    warning: r.hasOffPlatformContact ? r.warningMessage ?? null : null,
  };
}

function callText(seconds: number | null, outcome: string | null): string {
  if (outcome && outcome !== 'COMPLETED') return outcome === 'MISSED' ? 'Cuộc gọi nhỡ' : 'Cuộc gọi bị từ chối';
  const s = seconds ?? 0;
  return `Cuộc gọi trong ứng dụng · ${Math.floor(s / 60)} phút ${s % 60} giây`;
}

export const IMAGE_TEXT = '📷 Hình ảnh';

/** RING / ACCEPT / OFFER / ANSWER / ICE need an open chat; ending a call (HANGUP / DECLINE / BUSY) is always relayed. */
export function signalNeedsOpenChat(kind: string): boolean {
  return kind !== 'HANGUP' && kind !== 'DECLINE' && kind !== 'BUSY';
}

/** WEBRTC_ICE_SERVERS = JSON array of RTCIceServer; anything malformed is ignored (the call then needs STUN). */
export function parseIceServers(raw: string | undefined): Array<{ urls: string | string[]; username?: string; credential?: string }> {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (s): s is { urls: string | string[]; username?: string; credential?: string } =>
        !!s &&
        typeof s === 'object' &&
        (typeof (s as { urls?: unknown }).urls === 'string' ||
          (Array.isArray((s as { urls?: unknown }).urls) && ((s as { urls: unknown[] }).urls).every((u) => typeof u === 'string'))),
    );
  } catch {
    return [];
  }
}

export function toMessageDto(m: MessageRow, b: Pick<ChatBookingRow, 'id' | 'customer_id'>): ChatMessageDto {
  const senderRole: ChatMessageDto['senderRole'] =
    m.message_type === MessageType.SYSTEM_ALERT ? 'SYSTEM' : m.sender_id === b.customer_id ? 'PATIENT' : 'NURSE';
  return {
    id: m.id,
    conversationId: b.id,
    senderRole,
    type: m.message_type,
    content:
      m.message_type === MessageType.VOICE_CALL_LOG
        ? callText(m.call_duration_sec, m.content)
        : m.message_type === MessageType.IMAGE
          ? IMAGE_TEXT // the object key stays server-side; the service adds a short-lived imageUrl
          : m.content ?? '',
    ...(m.message_type === MessageType.IMAGE ? { imageUrl: null } : {}),
    flagged: m.is_flagged,
    createdAt: new Date(m.created_at).toISOString(),
    readAt: m.read_at ? new Date(m.read_at).toISOString() : null,
  };
}

/** Not stored: a status line at the top so the apps can explain why the box is locked. */
function statusLine(b: ChatBookingRow, open: boolean, atIso: string): ChatMessageDto {
  const content = open
    ? '🔒 Kênh chat an toàn của ca này. Số điện thoại của hai bên được ẩn; không chia sẻ số điện thoại, liên kết hay thông tin chuyển khoản riêng.'
    : b.execution_status === ExecutionStatus.DRAFT || b.execution_status === ExecutionStatus.MATCHING
      ? '⚠️ Ca chưa được xác nhận. Kênh nhắn tin sẽ mở khi có điều dưỡng nhận ca.'
      : '🔒 Ca đã kết thúc. Lịch sử trò chuyện được lưu làm bằng chứng khi có khiếu nại.';
  return {
    id: `system:${b.id}:${open ? 'open' : 'closed'}`,
    conversationId: b.id,
    senderRole: 'SYSTEM',
    type: MessageType.SYSTEM_ALERT,
    content,
    flagged: false,
    createdAt: atIso,
    readAt: null,
  };
}

export function toConversationDto(b: ChatBookingRow, role: ChatRole, messages: MessageRow[]): ConversationDto {
  const open = isChatOpen(b.execution_status);
  const other = counterpartOf(b, role);
  const dtos = messages.map((m) => toMessageDto(m, b));
  const firstAt = dtos[0]?.createdAt ?? new Date(0).toISOString();
  return {
    id: b.id,
    bookingId: b.id,
    bookingCode: b.booking_code,
    counterpartName: other.name,
    counterpartPhoneMasked: MASKED_PHONE,
    isOpen: open,
    messages: [statusLine(b, open, firstAt), ...dtos],
  };
}
