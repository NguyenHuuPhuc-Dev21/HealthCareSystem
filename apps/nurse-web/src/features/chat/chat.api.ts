import type { ChatMessageDto, ConversationDto } from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { USE_MOCK_CHAT } from '../../lib/mock-flags';
import * as mockChat from './chat.mock';

/**
 * Lấy toàn bộ thông tin hội thoại và lịch sử tin nhắn của ca trực (FR-CHAT-01)
 */
export async function getConversation(
  bookingId: string
): Promise<ApiResponse<ConversationDto>> {
  if (USE_MOCK_CHAT) {
    try {
      const data = await mockChat.mockGetConversation(bookingId);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi tải cuộc trò chuyện',
        },
      };
    }
  }

  return apiClient<ConversationDto>(`/bookings/${bookingId}/conversation`);
}

/**
 * Gửi tin nhắn mới trong ca trực
 */
export async function sendMessage(
  bookingId: string,
  content: string
): Promise<ApiResponse<ChatMessageDto>> {
  if (USE_MOCK_CHAT) {
    try {
      const data = await mockChat.mockSendMessage(bookingId, content);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as any,
        error: {
          code: err.code || 'UNKNOWN_ERROR',
          message: err.message || 'Lỗi gửi tin nhắn',
        },
      };
    }
  }

  return apiClient<ChatMessageDto>(`/bookings/${bookingId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

/**
 * Đánh dấu đã đọc tin nhắn
 */
export async function markRead(
  conversationId: string,
  lastMessageId: string
): Promise<ApiResponse<{ success: boolean }>> {
  if (USE_MOCK_CHAT) {
    await mockChat.mockMarkRead(conversationId, lastMessageId);
    return { success: true, data: { success: true } };
  }

  return apiClient<{ success: boolean }>(`/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({ lastMessageId }),
  });
}

/**
 * Đăng ký nhận tin nhắn mới theo thời gian thực (WebSocket hoặc Mock subscriber)
 */
export function subscribeConversation(
  conversationId: string,
  onMessage: (msg: ChatMessageDto) => void
): () => void {
  if (USE_MOCK_CHAT) {
    return mockChat.subscribeToMockConversation(conversationId, onMessage);
  }

  // Gateway WebSocket thật (khi BE-2 hoàn thiện gateway)
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${
    window.location.host
  }/ws/chat?conversationId=${conversationId}`;

  let ws: WebSocket | null = null;
  try {
    ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.type === 'NEW_MESSAGE' && data.message) {
          onMessage(data.message);
        }
      } catch {
        // parse error
      }
    };
  } catch {
    // ws connect error
  }

  return () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  };
}
