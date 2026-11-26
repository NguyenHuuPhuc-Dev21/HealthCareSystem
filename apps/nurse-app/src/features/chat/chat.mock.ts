import {
  detectOffPlatformContact,
  MessageType,
  type ChatMessageDto,
  type ConversationDto,
} from '@healthcare-system/shared';
import { CHAT_CONFIG } from './chat-labels';

type MessageSubscriber = (msg: ChatMessageDto) => void;

const conversationStore = new Map<string, ConversationDto>();
const subscribers = new Map<string, Set<MessageSubscriber>>();
const pendingReplyTimers = new Set<ReturnType<typeof setTimeout>>();

function buildInitialConversation(bookingId: string): ConversationDto {
  if (bookingId === 'job-1' || bookingId === 'BK-20261102-001') {
    return {
      id: 'conv-job-1',
      bookingId: 'job-1',
      bookingCode: 'BK-20261102-001',
      counterpartName: 'Bà Nguyễn Thị Mai (Người nhà: Anh Tuấn)',
      counterpartPhoneMasked: '0905 ••• 688',
      isOpen: true,
      messages: [
        {
          id: 'msg-1-1',
          conversationId: 'conv-job-1',
          senderRole: 'SYSTEM',
          type: MessageType.SYSTEM_ALERT,
          content:
            'Ca trực đã được xác nhận. Kênh nhắn tin trực tiếp đã mở và số điện thoại hai bên được bảo mật.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          readAt: new Date(Date.now() - 3500000).toISOString(),
        },
        {
          id: 'msg-1-2',
          conversationId: 'conv-job-1',
          senderRole: 'NURSE',
          type: MessageType.TEXT,
          content:
            'Chào anh Tuấn, tôi là điều dưỡng phụ trách ca trực hôm nay. Tôi sẽ có mặt trước 10 phút ạ.',
          createdAt: new Date(Date.now() - 2400000).toISOString(),
          readAt: new Date(Date.now() - 2300000).toISOString(),
        },
        {
          id: 'msg-1-3',
          conversationId: 'conv-job-1',
          senderRole: 'PATIENT',
          type: MessageType.TEXT,
          content:
            'Chào cô, gia đình đã chuẩn bị sẵn hồ sơ bệnh án và y lệnh gốc tại bàn rồi nhé.',
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          readAt: null,
        },
      ],
    };
  }

  if (bookingId === 'job-night-1050' || bookingId === 'BK-20261103-050') {
    return {
      id: 'conv-job-night-1050',
      bookingId: 'job-night-1050',
      bookingCode: 'BK-20261103-050',
      counterpartName: 'Ông Trần Văn Nam (Người nhà: Chị Trang)',
      counterpartPhoneMasked: '0912 ••• 456',
      isOpen: true,
      messages: [
        {
          id: 'msg-2-1',
          conversationId: 'conv-job-night-1050',
          senderRole: 'SYSTEM',
          type: MessageType.SYSTEM_ALERT,
          content:
            'Kênh liên lạc an toàn CareNest. Lịch sử trao đổi được bảo lưu để đối soát khi cần.',
          createdAt: new Date(Date.now() - 5000000).toISOString(),
          readAt: new Date(Date.now() - 4900000).toISOString(),
        },
        {
          id: 'msg-2-2',
          conversationId: 'conv-job-night-1050',
          senderRole: 'PATIENT',
          type: MessageType.TEXT,
          content:
            'Nhà mình ở số 112 ngay cạnh hiệu thuốc nhé điều dưỡng. Đến nơi bấm chuông giúp mình.',
          createdAt: new Date(Date.now() - 3000000).toISOString(),
          readAt: null,
        },
      ],
    };
  }

  const isClosed =
    bookingId.includes('unconfirmed') ||
    bookingId.includes('closed') ||
    bookingId.includes('completed');
  const isOpen =
    !isClosed &&
    (bookingId.startsWith('job-') ||
      bookingId.includes('confirmed') ||
      bookingId.startsWith('bk-'));

  return {
    id: `conv-${bookingId}`,
    bookingId,
    bookingCode: `BK-${bookingId.slice(0, 8).toUpperCase()}`,
    counterpartName: 'Người nhà người bệnh',
    counterpartPhoneMasked: '09•• ••• 123',
    isOpen,
    messages: [
      {
        id: `msg-${bookingId}-init`,
        conversationId: `conv-${bookingId}`,
        senderRole: 'SYSTEM',
        type: MessageType.SYSTEM_ALERT,
        content: isOpen
          ? 'Kênh nhắn tin an toàn đã mở cho ca trực này.'
          : 'Ca trực chưa xác nhận hoặc đã đóng. Kênh nhắn tin đang khóa.',
        createdAt: new Date().toISOString(),
        readAt: new Date().toISOString(),
      },
    ],
  };
}

function getOrInitConversation(bookingId: string): ConversationDto {
  const existing = conversationStore.get(bookingId);
  if (existing) {
    return {
      ...existing,
      messages: [...existing.messages],
    };
  }
  const initial = buildInitialConversation(bookingId);
  conversationStore.set(bookingId, initial);
  return {
    ...initial,
    messages: [...initial.messages],
  };
}

function findConversationById(conversationId: string): ConversationDto | undefined {
  for (const conv of conversationStore.values()) {
    if (conv.id === conversationId) {
      return conv;
    }
  }
  return undefined;
}

function notifySubscribers(conversationId: string, msg: ChatMessageDto): void {
  const set = subscribers.get(conversationId);
  if (!set) return;
  set.forEach((cb) => {
    try {
      cb(msg);
    } catch {
      // Ignore subscriber error
    }
  });
}

export async function mockGetConversation(bookingId: string): Promise<ConversationDto> {
  await new Promise((r) => setTimeout(r, CHAT_CONFIG.MOCK_NETWORK_DELAY_MS));
  return getOrInitConversation(bookingId);
}

export async function mockSendMessage(
  bookingId: string,
  content: string,
  options?: { simulateAutoReply?: boolean }
): Promise<ChatMessageDto> {
  await new Promise((r) => setTimeout(r, CHAT_CONFIG.MOCK_NETWORK_DELAY_MS));

  const conv = getOrInitConversation(bookingId);
  if (!conv.isOpen) {
    const err: Error & { code?: string } = new Error(
      'Không thể gửi tin nhắn khi ca trực chưa xác nhận hoặc đã đóng.'
    );
    err.code = 'CONVERSATION_CLOSED';
    throw err;
  }

  const scan = detectOffPlatformContact(content);
  const newMsg: ChatMessageDto = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversationId: conv.id,
    senderRole: 'NURSE',
    type: MessageType.TEXT,
    content,
    flagged: scan.hasOffPlatformContact,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  conv.messages = [...conv.messages, newMsg];
  conversationStore.set(bookingId, conv);
  notifySubscribers(conv.id, newMsg);

  if (options?.simulateAutoReply !== false) {
    const timer = setTimeout(() => {
      pendingReplyTimers.delete(timer);
      mockSimulateCustomerReply(bookingId);
    }, CHAT_CONFIG.MOCK_REPLY_DELAY_MS);
    pendingReplyTimers.add(timer);
  }

  return newMsg;
}

export async function mockMarkRead(
  conversationId: string,
  lastMessageId: string
): Promise<void> {
  await new Promise((r) => setTimeout(r, 30));
  const conv = findConversationById(conversationId);
  if (!conv) return;

  const targetIndex = conv.messages.findIndex((m) => m.id === lastMessageId);
  const nowIso = new Date().toISOString();
  conv.messages = conv.messages.map((m, idx) => {
    const shouldMark =
      m.senderRole !== 'NURSE' &&
      !m.readAt &&
      (targetIndex === -1 || idx <= targetIndex);
    return shouldMark ? { ...m, readAt: nowIso } : m;
  });
  conversationStore.set(conv.bookingId, conv);
}

export function mockSimulateCustomerReply(
  bookingId: string,
  customContent?: string
): ChatMessageDto | null {
  const conv = getOrInitConversation(bookingId);
  if (!conv.isOpen) return null;

  const replies = [
    'Dạ gia đình đã nhận được tin, cảm ơn điều dưỡng!',
    'Vâng ạ, người nhà đang có mặt ở phòng bệnh rồi nhé.',
    'Dạ vâng, phiền điều dưỡng kiểm tra thêm nhiệt độ giúp người nhà nhé.',
  ];
  const content =
    customContent || replies[Math.floor(Math.random() * replies.length)];

  const replyMsg: ChatMessageDto = {
    id: `msg-reply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    conversationId: conv.id,
    senderRole: 'PATIENT',
    type: MessageType.TEXT,
    content,
    flagged: detectOffPlatformContact(content).hasOffPlatformContact,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  conv.messages = [...conv.messages, replyMsg];
  conversationStore.set(bookingId, conv);
  notifySubscribers(conv.id, replyMsg);
  return replyMsg;
}

export function subscribeToMockConversation(
  conversationId: string,
  onMessage: (msg: ChatMessageDto) => void
): () => void {
  if (!subscribers.has(conversationId)) {
    subscribers.set(conversationId, new Set());
  }
  const set = subscribers.get(conversationId)!;
  set.add(onMessage);

  return () => {
    set.delete(onMessage);
    if (set.size === 0) {
      subscribers.delete(conversationId);
    }
  };
}

export function resetChatMockState(): void {
  pendingReplyTimers.forEach((timer) => clearTimeout(timer));
  pendingReplyTimers.clear();
  conversationStore.clear();
  subscribers.clear();
}
