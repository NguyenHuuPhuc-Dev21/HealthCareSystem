import type { ChatMessageDto, ConversationDto } from '@healthcare-system/shared';
import { apiClient, getAuthToken, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import { CHAT_CONFIG, CHAT_LABELS } from './chat-labels';
import * as mockChat from './chat.mock';

export async function getConversation(
  bookingId: string
): Promise<ApiResponse<ConversationDto>> {
  if (env.useMockChat) {
    try {
      const data = await mockChat.mockGetConversation(bookingId);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as ConversationDto,
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || CHAT_LABELS.errorLoadFallback,
        },
      };
    }
  }

  return apiClient<ConversationDto>(`/bookings/${bookingId}/conversation`);
}

export async function sendMessage(
  bookingId: string,
  content: string
): Promise<ApiResponse<ChatMessageDto>> {
  if (env.useMockChat) {
    try {
      const data = await mockChat.mockSendMessage(bookingId, content);
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        data: null as unknown as ChatMessageDto,
        error: {
          code: err?.code || 'UNKNOWN_ERROR',
          message: err?.message || CHAT_LABELS.errorSendFallback,
        },
      };
    }
  }

  return apiClient<ChatMessageDto>(`/bookings/${bookingId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function markRead(
  conversationId: string,
  lastMessageId: string
): Promise<ApiResponse<{ success: boolean }>> {
  if (env.useMockChat) {
    await mockChat.mockMarkRead(conversationId, lastMessageId);
    return { success: true, data: { success: true } };
  }

  return apiClient<{ success: boolean }>(`/conversations/${conversationId}/read`, {
    method: 'POST',
    body: JSON.stringify({ lastMessageId }),
  });
}

export function subscribeConversation(
  conversationId: string,
  onMessage: (msg: ChatMessageDto) => void
): () => void {
  if (env.useMockChat) {
    return mockChat.subscribeToMockConversation(conversationId, onMessage);
  }

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closedIntentionally = false;
  let reconnectAttempts = 0;

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() }));
        } catch {
          // Ignore heartbeat error
        }
      }
    }, CHAT_CONFIG.WS_HEARTBEAT_INTERVAL_MS);
  };

  const connect = async () => {
    if (closedIntentionally) return;
    try {
      const token = await getAuthToken();
      const baseWsUrl = env.apiBaseUrl.replace(/^http/, 'ws');
      const channel = encodeURIComponent(`conversation:${conversationId}`);
      const wsUrl = `${baseWsUrl}/ws/chat?channel=${channel}&conversationId=${encodeURIComponent(
        conversationId
      )}&token=${encodeURIComponent(token || '')}`;

      const socket = new WebSocket(wsUrl);
      ws = socket;

      socket.onopen = () => {
        reconnectAttempts = 0;
        startHeartbeat();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          const msg: ChatMessageDto | undefined =
            data?.type === 'NEW_MESSAGE'
              ? data.message || data.payload
              : data?.id && data?.conversationId
              ? data
              : undefined;
          if (msg) {
            onMessage(msg);
          }
        } catch {
          // Ignore malformed WS payload
        }
      };

      socket.onerror = () => {
        // Handled by onclose
      };

      socket.onclose = () => {
        stopHeartbeat();
        if (
          !closedIntentionally &&
          reconnectAttempts < CHAT_CONFIG.WS_MAX_RECONNECT_ATTEMPTS
        ) {
          const delay = Math.min(
            CHAT_CONFIG.WS_RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts),
            CHAT_CONFIG.WS_RECONNECT_MAX_MS
          );
          reconnectAttempts += 1;
          reconnectTimer = setTimeout(() => {
            void connect();
          }, delay);
        }
      };
    } catch {
      // Ignore connection setup error
    }
  };

  void connect();

  return () => {
    closedIntentionally = true;
    stopHeartbeat();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      try {
        ws.close();
      } catch {
        // Ignore close error
      }
      ws = null;
    }
  };
}
