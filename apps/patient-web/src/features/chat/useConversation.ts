import { useCallback, useEffect, useRef, useState } from 'react';
import { usePolling } from '../../lib/usePolling';
import { getErrorMessage } from '../../lib/errors';
import { getConversation, markRead, sendImage, sendText, subscribeChat } from './chat.api';
import type { ChatRealtimeEvent } from './chat.api';
import type { ChatRole, Conversation, SendMessageResult, UiChatMessage } from './chat.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const POLL_MS = 5_000;

export interface SendWarning {
  messageId: string;
  text: string;
}

/**
 * Trạng thái một cuộc trò chuyện (FR-CHAT-01) — dùng chung cho mọi vai trò (`viewerRole`).
 * - Tải lịch sử; nhận tin mới qua WebSocket `/ws/chat`, tự chuyển sang hỏi định kỳ khi WebSocket không khả dụng (hoặc mock).
 * - Gửi tin theo kiểu "lạc quan": hiện ngay với trạng thái đang gửi, lỗi thì cho thử lại.
 * - Tin bị quét trúng số điện thoại/link/thanh toán ngoài vẫn được gửi; `warning` trả về để hiển thị cho người gửi.
 * - Đánh dấu đã đọc các tin nhận được khi khung chat đang mở.
 */
export function useConversation(bookingId: string | undefined, viewerRole: ChatRole, active: boolean) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<SendWarning | null>(null);
  const [connected, setConnected] = useState(false);
  const lastMarked = useRef<string | null>(null);

  /** Gộp tin từ server với các tin còn đang gửi/lỗi ở phía giao diện. */
  const applyServer = useCallback((conv: Conversation) => {
    setConversation(conv);
    setMessages((prev) => {
      const pending = prev.filter((m) => m.status === 'sending' || m.status === 'error');
      return [...conv.messages.map((m) => ({ ...m, status: 'sent' as const })), ...pending];
    });
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!bookingId) return;
      if (!silent) setLoading(true);
      const res = await getConversation(bookingId);
      if (res.success) {
        applyServer(res.data);
        setError(null);
      } else if (!silent) {
        setError(getErrorMessage(res.error, 'Không tải được cuộc trò chuyện.'));
      }
      if (!silent) setLoading(false);
    },
    [bookingId, applyServer],
  );

  // Tải lần đầu mỗi khi mở khung chat / đổi ca
  useEffect(() => {
    if (!active || !bookingId) return;
    lastMarked.current = null;
    setWarning(null);
    load();
  }, [active, bookingId, load]);

  // Thời gian thực: WebSocket (thật) — mock không có WebSocket nên dựa vào polling
  useEffect(() => {
    if (!active || !bookingId || USE_MOCK) return;
    const onEvent = (e: ChatRealtimeEvent) => {
      if (e.type === 'NEW_MESSAGE') {
        setMessages((prev) => (prev.some((m) => m.id === e.message.id) ? prev : [...prev, { ...e.message, status: 'sent' }]));
      } else if (e.type === 'READ') {
        setMessages((prev) => prev.map((m) => (m.senderRole === viewerRole && !m.readAt && m.createdAt <= (prev.find((x) => x.id === e.upTo)?.createdAt ?? '') ? { ...m, readAt: new Date().toISOString() } : m)));
      }
    };
    return subscribeChat(bookingId, onEvent, setConnected);
  }, [active, bookingId, viewerRole]);

  usePolling(() => load(true), POLL_MS, active && !!bookingId && (USE_MOCK || !connected));

  // Đánh dấu đã đọc tin nhận được mới nhất
  useEffect(() => {
    if (!active || !conversation) return;
    const incoming = [...messages].reverse().find((m) => m.senderRole !== viewerRole && m.senderRole !== 'SYSTEM' && m.status === 'sent');
    if (incoming && incoming.id !== lastMarked.current && !incoming.readAt) {
      lastMarked.current = incoming.id;
      markRead(conversation.id, incoming.id);
    }
  }, [messages, active, conversation, viewerRole]);

  const settle = useCallback((tmpId: string, res: SendMessageResult) => {
    setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...res, status: 'sent' as const } : m)));
    if (res.warning) setWarning({ messageId: res.id, text: res.warning.message });
  }, []);

  const fail = useCallback((tmpId: string, message: string) => {
    setMessages((prev) => prev.map((m) => (m.id === tmpId ? { ...m, status: 'error' as const, errorMessage: message } : m)));
  }, []);

  const send = useCallback(
    async (text: string, retryId?: string) => {
      if (!bookingId) return;
      const tmpId = retryId ?? `tmp-${Date.now()}`;
      if (retryId) setMessages((prev) => prev.map((m) => (m.id === retryId ? { ...m, status: 'sending' as const, errorMessage: undefined } : m)));
      else setMessages((prev) => [...prev, { id: tmpId, conversationId: bookingId, senderRole: viewerRole, type: 'TEXT', content: text, createdAt: new Date().toISOString(), status: 'sending' }]);
      const res = await sendText(bookingId, text);
      if (res.success) settle(tmpId, res.data);
      else {
        fail(tmpId, getErrorMessage(res.error, 'Chưa gửi được tin nhắn.'));
        if (res.error?.code === 'CONVERSATION_CLOSED') load(true);
      }
    },
    [bookingId, viewerRole, settle, fail, load],
  );

  const sendPhoto = useCallback(
    async (file: File) => {
      if (!bookingId) return;
      const tmpId = `tmp-${Date.now()}`;
      setMessages((prev) => [...prev, { id: tmpId, conversationId: bookingId, senderRole: viewerRole, type: 'IMAGE', content: '📷 Đang gửi ảnh…', createdAt: new Date().toISOString(), status: 'sending' }]);
      const res = await sendImage(bookingId, file);
      if (res.success) settle(tmpId, res.data);
      else fail(tmpId, getErrorMessage(res.error, 'Chưa gửi được ảnh.'));
    },
    [bookingId, viewerRole, settle, fail],
  );

  const discard = useCallback((id: string) => setMessages((prev) => prev.filter((m) => m.id !== id)), []);

  return { conversation, messages, loading, error, warning, dismissWarning: () => setWarning(null), reload: () => load(), send, sendPhoto, discard, realtime: connected };
}
