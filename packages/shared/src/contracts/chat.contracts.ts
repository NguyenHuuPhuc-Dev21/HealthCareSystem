import type { MessageType } from '../enums';

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderRole: 'PATIENT' | 'NURSE' | 'SYSTEM';
  type: MessageType; // TEXT | IMAGE | VOICE_CALL_LOG | SYSTEM_ALERT
  content: string;
  /** IMAGE only: short-lived presigned GET of the (metadata-stripped) photo. Added by BE-2 Phase 6. */
  imageUrl?: string | null;
  flagged?: boolean; // bị quét trúng số điện thoại / link / thanh toán ngoài
  createdAt: string;
  readAt?: string | null;
}

export interface ConversationDto {
  id: string;
  bookingId: string;
  bookingCode: string;
  counterpartName: string;
  counterpartPhoneMasked: string; // luôn là '•••• ••• •••' — không trả chữ số nào (FR-CHAT-01)
  isOpen: boolean; // false khi booking chưa CONFIRMED hoặc đã đóng
  messages: ChatMessageDto[];
}

export interface SendMessageInput {
  content: string;
  type?: MessageType;
}

// ---- Added by the backend (BE-2 Phase 6, docs/api/chat.api.md) ----

export type OffPlatformReason = 'PHONE_NUMBER' | 'EXTERNAL_LINK' | 'OFF_PLATFORM_PAYMENT';

/** POST /bookings/:id/messages answer: the stored message + the warning shown to the sender when it was flagged. */
export interface SendMessageResult extends ChatMessageDto {
  warning?: { reasons: OffPlatformReason[]; message: string } | null;
}

/** POST /bookings/:id/calls — log of an in-app call (the call itself never reveals a phone number). */
export interface CallLogInput {
  durationSec: number;
  outcome: 'COMPLETED' | 'MISSED' | 'DECLINED';
}

/** POST /bookings/:id/messages with an image: imageKey comes from POST /bookings/:id/messages/image-upload-url. */
export interface SendImageInput {
  type: 'IMAGE';
  imageKey: string;
}

export interface ChatImageUploadUrl {
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  contentType: string;
}

/**
 * In-app call (WebRTC, audio). Signalling goes through /ws/chat to the other participant only: neither side ever
 * learns the other's phone number. RING → ACCEPT | DECLINE | BUSY → OFFER / ANSWER / ICE_CANDIDATE … → HANGUP.
 */
export type CallSignalKind = 'RING' | 'ACCEPT' | 'DECLINE' | 'BUSY' | 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'HANGUP';

/** Client → server over /ws/chat. payload: SDP (OFFER / ANSWER) or an ICE candidate; ≤ 16 KB once serialized. */
export interface CallSignalInput {
  type: 'CALL_SIGNAL';
  callId: string; // uuid chosen by the caller
  kind: CallSignalKind;
  payload?: unknown;
}

/** GET /bookings/:id/call-config — STUN/TURN servers for RTCPeerConnection. */
export interface CallConfigDto {
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  ringTimeoutSec: number;
}

/** WebSocket /ws/chat?conversationId=… (conversationId = bookingId). */
export type ChatRealtimeMessage =
  | { type: 'NEW_MESSAGE'; message: ChatMessageDto }
  | { type: 'READ'; conversationId: string; readerRole: 'PATIENT' | 'NURSE'; upTo: string }
  | { type: 'CALL_SIGNAL'; conversationId: string; callId: string; kind: CallSignalKind; fromRole: 'PATIENT' | 'NURSE'; payload?: unknown; at: string }
  | { type: 'CALL_ERROR'; callId: string | null; code: string; message: string };

/** GET /admin/bookings/:id/conversation — full evidence view (audit-logged). */
export interface AdminChatMessageDto extends ChatMessageDto {
  senderName: string;
  receiverRole: 'PATIENT' | 'NURSE';
  callDurationSec: number | null;
  flagReasons: OffPlatformReason[];
}

export interface AdminConversationDto {
  bookingId: string;
  bookingCode: string;
  executionStatus: string;
  customerName: string;
  nurseName: string | null;
  messages: AdminChatMessageDto[];
  flaggedCount: number;
}
