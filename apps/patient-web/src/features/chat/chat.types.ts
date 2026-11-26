/**
 * Chat trong ứng dụng (FR-CHAT-01) — khớp docs/api/chat.api.md và packages/shared/src/contracts/chat.contracts.ts.
 * Hội thoại: một cuộc cho mỗi ca (id hội thoại = id ca) giữa khách và điều dưỡng được phân công.
 * Không bao giờ có số điện thoại thật: tin mang `senderRole`, không mang id người dùng.
 *
 * Các kiểu ở đây KHÔNG gắn với riêng vai trò khách để component chat dùng chung được cho cả Patient Web và Nurse Web.
 */

export type ChatRole = 'PATIENT' | 'NURSE';
export type ChatMessageType = 'TEXT' | 'IMAGE' | 'VOICE_CALL_LOG' | 'SYSTEM_ALERT';
export type OffPlatformReason = 'PHONE_NUMBER' | 'EXTERNAL_LINK' | 'OFF_PLATFORM_PAYMENT';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderRole: ChatRole | 'SYSTEM';
  type: ChatMessageType;
  content: string;
  /** IMAGE: link tải tạm thời (≈10 phút) của bản ảnh đã xoá EXIF/GPS */
  imageUrl?: string | null;
  /** Bị quét trúng số điện thoại / link ngoài / thanh toán ngoài hệ thống */
  flagged?: boolean;
  createdAt: string;
  readAt?: string | null;
}

export interface Conversation {
  id: string;
  bookingId: string;
  bookingCode: string;
  counterpartName: string;
  /** Luôn là '•••• ••• •••' — không có chữ số nào */
  counterpartPhoneMasked: string;
  /** false khi ca chưa được xác nhận hoặc đã kết thúc → chỉ đọc */
  isOpen: boolean;
  messages: ChatMessage[];
}

export interface SendMessageResult extends ChatMessage {
  warning?: { reasons: OffPlatformReason[]; message: string } | null;
}

/** Tin đang gửi / gửi lỗi ở phía giao diện (trước khi server xác nhận). */
export interface UiChatMessage extends ChatMessage {
  status?: 'sending' | 'sent' | 'error';
  errorMessage?: string;
}

export const CHAT_TEXT_MAX = 2000;
export const CHAT_IMAGE_MAX_MB = 10;
export const CHAT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
