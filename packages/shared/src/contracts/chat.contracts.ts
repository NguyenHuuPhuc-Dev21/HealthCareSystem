import type { MessageType } from '../enums';

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderRole: 'PATIENT' | 'NURSE' | 'SYSTEM';
  type: MessageType; // TEXT | IMAGE | VOICE_CALL_LOG | SYSTEM_ALERT
  content: string;
  flagged?: boolean; // bị quét trúng số điện thoại / link / thanh toán ngoài
  createdAt: string;
  readAt?: string | null;
}

export interface ConversationDto {
  id: string;
  bookingId: string;
  bookingCode: string;
  counterpartName: string;
  counterpartPhoneMasked: string; // 09•• ••• 123
  isOpen: boolean; // false khi booking chưa CONFIRMED hoặc đã đóng
  messages: ChatMessageDto[];
}

export interface SendMessageInput {
  content: string;
  type?: MessageType;
}
