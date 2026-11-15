import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessageDto, ConversationDto } from '@healthcare-system/shared';
import { MessageType } from '@healthcare-system/shared';
import { getConversation, markRead, sendMessage, subscribeConversation } from './chat.api';

export interface OptimisticChatMessage extends ChatMessageDto {
  status?: 'sending' | 'sent' | 'error';
  errorMessage?: string;
}

export function useConversation(bookingId: string | undefined, isPanelOpen: boolean = false) {
  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [messages, setMessages] = useState<OptimisticChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const isPanelOpenRef = useRef(isPanelOpen);
  isPanelOpenRef.current = isPanelOpen;

  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  // Load conversation
  const loadConversation = useCallback(async () => {
    if (!bookingId) return;
    try {
      const res = await getConversation(bookingId);
      if (res.success && res.data) {
        setConversation(res.data);
        setMessages(
          res.data.messages.map((m) => ({
            ...m,
            status: 'sent',
          }))
        );
        setError(null);

        // Calculate unread
        const unread = res.data.messages.filter(
          (m) => m.senderRole !== 'NURSE' && !m.readAt
        ).length;
        setUnreadCount(isPanelOpenRef.current ? 0 : unread);

        if (isPanelOpenRef.current && res.data.messages.length > 0) {
          const lastMsg = res.data.messages[res.data.messages.length - 1];
          markRead(res.data.id, lastMsg.id).catch(() => {});
        }
      } else {
        setError(res.error?.message || 'Không thể tải cuộc hội thoại');
      }
    } catch {
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Subscribe to real-time updates and polling fallback
  useEffect(() => {
    if (!conversation?.id) return;

    const convId = conversation.id;

    // Real-time subscription
    const unsubscribe = subscribeConversation(convId, (newMsg) => {
      setMessages((prev) => {
        // avoid duplicate
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, { ...newMsg, status: 'sent' }];
      });

      if (isPanelOpenRef.current) {
        markRead(convId, newMsg.id).catch(() => {});
      } else if (newMsg.senderRole !== 'NURSE') {
        setUnreadCount((c) => c + 1);
      }
    });

    // 5-second polling fallback when panel is open
    let pollInterval: any = null;
    if (isPanelOpen) {
      pollInterval = setInterval(() => {
        if (!bookingId) return;
        getConversation(bookingId).then((res) => {
          if (res.success && res.data) {
            setMessages((prev) => {
              // merge preserving optimistic messages
              const sentMap = new Map(res.data.messages.map((m) => [m.id, m]));
              const merged = prev.map((m) => {
                const updated = sentMap.get(m.id);
                return updated ? { ...updated, status: 'sent' as const } : m;
              });
              // append new ones
              res.data.messages.forEach((m) => {
                if (!prev.some((p) => p.id === m.id)) {
                  merged.push({ ...m, status: 'sent' });
                }
              });
              return merged;
            });
          }
        });
      }, 5000);
    }

    return () => {
      unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [conversation?.id, isPanelOpen, bookingId]);

  // Clear unread when panel opens
  useEffect(() => {
    if (isPanelOpen && conversation) {
      setUnreadCount(0);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        markRead(conversation.id, lastMsg.id).catch(() => {});
      }
    }
  }, [isPanelOpen, conversation, messages]);

  // Optimistic Send Message
  const send = useCallback(
    async (content: string): Promise<boolean> => {
      if (!bookingId || !content.trim()) return false;

      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: OptimisticChatMessage = {
        id: tempId,
        conversationId: conversation?.id || `conv-${bookingId}`,
        senderRole: 'NURSE',
        type: MessageType.TEXT,
        content: content.trim(),
        createdAt: new Date().toISOString(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const res = await sendMessage(bookingId, content.trim());
        if (res.success && res.data) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId ? { ...res.data, status: 'sent' } : m
            )
          );
          return true;
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    status: 'error',
                    errorMessage: res.error?.message || 'Gửi thất bại',
                  }
                : m
            )
          );
          return false;
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: 'error',
                  errorMessage: 'Lỗi mạng khi gửi',
                }
              : m
          )
        );
        return false;
      }
    },
    [bookingId, conversation?.id]
  );

  // Retry sending
  const retry = useCallback(
    async (tempId: string) => {
      const target = messages.find((m) => m.id === tempId);
      if (!target || !bookingId) return;

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'sending', errorMessage: undefined } : m))
      );

      try {
        const res = await sendMessage(bookingId, target.content);
        if (res.success && res.data) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...res.data, status: 'sent' } : m))
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    status: 'error',
                    errorMessage: res.error?.message || 'Gửi lại thất bại',
                  }
                : m
            )
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: 'error',
                  errorMessage: 'Lỗi mạng khi gửi lại',
                }
              : m
          )
        );
      }
    },
    [bookingId, messages]
  );

  return {
    conversation,
    messages,
    loading,
    error,
    unreadCount,
    send,
    retry,
    reload: loadConversation,
  };
}
