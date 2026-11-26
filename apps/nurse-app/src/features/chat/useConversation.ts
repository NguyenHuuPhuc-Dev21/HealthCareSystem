import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageType,
  type ChatMessageDto,
  type ConversationDto,
} from '@healthcare-system/shared';
import {
  getConversation,
  markRead,
  sendMessage,
  subscribeConversation,
} from './chat.api';
import { CHAT_CONFIG, CHAT_LABELS } from './chat-labels';

export interface OptimisticChatMessage extends ChatMessageDto {
  status?: 'sending' | 'sent' | 'error';
  errorMessage?: string;
}

/**
 * Sorts messages newest-first for React Native inverted FlatList.
 */
export function sortMessagesForInvertedList(
  messages: OptimisticChatMessage[]
): OptimisticChatMessage[] {
  return [...messages].sort((a, b) => {
    const timeDiff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (!Number.isNaN(timeDiff) && timeDiff !== 0) {
      return timeDiff;
    }
    return b.id.localeCompare(a.id);
  });
}

export function countUnreadMessages(messages: ChatMessageDto[]): number {
  return messages.filter((m) => m.senderRole !== 'NURSE' && !m.readAt).length;
}

export function useConversation(
  bookingId: string | undefined,
  isScreenActive: boolean = true
) {
  const [conversation, setConversation] = useState<ConversationDto | null>(null);
  const [messages, setMessages] = useState<OptimisticChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const isActiveRef = useRef(isScreenActive);
  isActiveRef.current = isScreenActive;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const loadConversation = useCallback(async () => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    try {
      const res = await getConversation(bookingId);
      if (res.success && res.data) {
        setConversation(res.data);
        setMessages(
          res.data.messages.map((m) => ({
            ...m,
            status: 'sent' as const,
          }))
        );
        setError(null);

        const unread = countUnreadMessages(res.data.messages);
        setUnreadCount(isActiveRef.current ? 0 : unread);

        if (isActiveRef.current && res.data.messages.length > 0) {
          const lastMsg = res.data.messages[res.data.messages.length - 1];
          void markRead(res.data.id, lastMsg.id).catch(() => {});
        }
      } else {
        setError(res.error?.message || CHAT_LABELS.errorLoadFallback);
      }
    } catch {
      setError(CHAT_LABELS.errorNetwork);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    setLoading(true);
    void loadConversation();
  }, [loadConversation]);

  // Subscribe to realtime updates and polling fallback
  useEffect(() => {
    if (!conversation?.id) return;
    const convId = conversation.id;

    const unsubscribe = subscribeConversation(convId, (newMsg) => {
      setMessages((prev) => {
        const optIndex = prev.findIndex(
          (m) =>
            m.id.startsWith('temp-') &&
            m.senderRole === newMsg.senderRole &&
            m.content === newMsg.content
        );
        if (optIndex !== -1) {
          const copy = [...prev];
          copy[optIndex] = { ...newMsg, status: 'sent' };
          return copy;
        }
        if (prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        return [...prev, { ...newMsg, status: 'sent' }];
      });

      if (isActiveRef.current) {
        setUnreadCount(0);
        void markRead(convId, newMsg.id).catch(() => {});
      } else if (newMsg.senderRole !== 'NURSE') {
        setUnreadCount((c) => c + 1);
      }
    });

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (isScreenActive && bookingId) {
      pollInterval = setInterval(() => {
        void getConversation(bookingId).then((res) => {
          if (!res.success || !res.data) return;
          setConversation(res.data);
          setMessages((prev) => {
            const sentMap = new Map(res.data.messages.map((m) => [m.id, m]));
            const merged = prev.map((m) => {
              const updated = sentMap.get(m.id);
              return updated ? { ...updated, status: 'sent' as const } : m;
            });
            res.data.messages.forEach((m) => {
              if (!prev.some((p) => p.id === m.id)) {
                merged.push({ ...m, status: 'sent' });
              }
            });
            return merged;
          });
        });
      }, CHAT_CONFIG.POLL_INTERVAL_MS);
    }

    return () => {
      unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [conversation?.id, isScreenActive, bookingId]);

  // Mark read when screen becomes active
  useEffect(() => {
    if (isScreenActive && conversation && messages.length > 0) {
      setUnreadCount(0);
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.id.startsWith('temp-')) {
        void markRead(conversation.id, lastMsg.id).catch(() => {});
      }
    }
  }, [isScreenActive, conversation, messages]);

  const send = useCallback(
    async (content: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!bookingId || !trimmed) return false;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const optimisticMsg: OptimisticChatMessage = {
        id: tempId,
        conversationId: conversation?.id || `conv-${bookingId}`,
        senderRole: 'NURSE',
        type: MessageType.TEXT,
        content: trimmed,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const res = await sendMessage(bookingId, trimmed);
        if (res.success && res.data) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.data.id)) {
              return prev.filter((m) => m.id !== tempId);
            }
            return prev.map((m) =>
              m.id === tempId ? { ...res.data, status: 'sent' } : m
            );
          });
          return true;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: 'error',
                  errorMessage: res.error?.message || CHAT_LABELS.errorSendFallback,
                }
              : m
          )
        );
        return false;
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: 'error',
                  errorMessage: CHAT_LABELS.errorNetworkSend,
                }
              : m
          )
        );
        return false;
      }
    },
    [bookingId, conversation?.id]
  );

  const retry = useCallback(
    async (tempId: string): Promise<boolean> => {
      const target = messagesRef.current.find((m) => m.id === tempId);
      if (!target || !bookingId) return false;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, status: 'sending', errorMessage: undefined } : m
        )
      );

      try {
        const res = await sendMessage(bookingId, target.content);
        if (res.success && res.data) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.data.id)) {
              return prev.filter((m) => m.id !== tempId);
            }
            return prev.map((m) =>
              m.id === tempId ? { ...res.data, status: 'sent' } : m
            );
          });
          return true;
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: 'error',
                  errorMessage: res.error?.message || CHAT_LABELS.errorRetryFallback,
                }
              : m
          )
        );
        return false;
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  status: 'error',
                  errorMessage: CHAT_LABELS.errorNetworkRetry,
                }
              : m
          )
        );
        return false;
      }
    },
    [bookingId]
  );

  const invertedMessages = useMemo(
    () => sortMessagesForInvertedList(messages),
    [messages]
  );

  return {
    conversation,
    messages,
    invertedMessages,
    loading,
    error,
    unreadCount,
    send,
    retry,
    reload: loadConversation,
  };
}
