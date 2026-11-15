import { MessageType } from '@healthcare-system/shared';
import type { ChatMessageDto, ConversationDto } from '@healthcare-system/shared';
import { detectOffPlatformContact } from '@healthcare-system/shared';

const STORAGE_KEY_PREFIX = 'carenest_mock_chat_conv_';

type MessageSubscriber = (msg: ChatMessageDto) => void;
const subscribers: Map<string, Set<MessageSubscriber>> = new Map();

function getInitialConversation(bookingId: string): ConversationDto {
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
            '🔒 Ca trực đã được xác nhận. Kênh liên lạc trực tiếp giữa điều dưỡng và người nhà đã mở. Số điện thoại hai bên được bảo mật.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'msg-1-2',
          conversationId: 'conv-job-1',
          senderRole: 'NURSE',
          type: MessageType.TEXT,
          content:
            'Chào anh Tuấn, tôi là điều dưỡng phụ trách ca trực hôm nay. Tôi sẽ có mặt trước 10 phút để nhận định tình trạng vết loét của bà ạ.',
          createdAt: new Date(Date.now() - 2400000).toISOString(),
          readAt: new Date(Date.now() - 2300000).toISOString(),
        },
        {
          id: 'msg-1-3',
          conversationId: 'conv-job-1',
          senderRole: 'PATIENT',
          type: MessageType.TEXT,
          content:
            'Chào cô, gia đình đã chuẩn bị sẵn hồ sơ bệnh án và y lệnh gốc của bác sĩ tại bàn rồi nhé. Cảm ơn cô.',
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          readAt: new Date(Date.now() - 1700000).toISOString(),
        },
      ],
    };
  }

  if (bookingId === 'job-2' || bookingId === 'BK-20261102-002') {
    return {
      id: 'conv-job-2',
      bookingId: 'job-2',
      bookingCode: 'BK-20261102-002',
      counterpartName: 'Ông Trần Văn Nam (Người nhà: Chị Trang)',
      counterpartPhoneMasked: '0912 ••• 456',
      isOpen: true,
      messages: [
        {
          id: 'msg-2-1',
          conversationId: 'conv-job-2',
          senderRole: 'SYSTEM',
          type: MessageType.SYSTEM_ALERT,
          content:
            '🔒 Kênh liên lạc an toàn CareNest. Lịch sử trao đổi được bảo lưu làm bằng chứng khi khiếu nại (FR-CHAT-01).',
          createdAt: new Date(Date.now() - 5000000).toISOString(),
        },
        {
          id: 'msg-2-2',
          conversationId: 'conv-job-2',
          senderRole: 'PATIENT',
          type: MessageType.TEXT,
          content: 'Nhà mình ở số 112 ngay cạnh hiệu thuốc nhé điều dưỡng. Đến nơi bấm chuông giúp mình.',
          createdAt: new Date(Date.now() - 3000000).toISOString(),
          readAt: new Date(Date.now() - 2800000).toISOString(),
        },
      ],
    };
  }

  // Mặc định hoặc ca chưa CONFIRMED: isOpen = false để kiểm thử trạng thái khóa
  const isConfirmed = bookingId.includes('confirmed') || bookingId.startsWith('job-');
  return {
    id: `conv-${bookingId}`,
    bookingId,
    bookingCode: `BK-${bookingId.slice(0, 8)}`,
    counterpartName: 'Người nhà người bệnh',
    counterpartPhoneMasked: '09•• ••• 123',
    isOpen: isConfirmed,
    messages: [
      {
        id: `msg-${bookingId}-init`,
        conversationId: `conv-${bookingId}`,
        senderRole: 'SYSTEM',
        type: MessageType.SYSTEM_ALERT,
        content: isConfirmed
          ? '🔒 Kênh chat an toàn mở cho ca trực này.'
          : '⚠️ Ca trực chưa được xác nhận. Kênh nhắn tin đang khóa.',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function getStoredConversation(bookingId: string): ConversationDto {
  try {
    const raw = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${bookingId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  const init = getInitialConversation(bookingId);
  setStoredConversation(bookingId, init);
  return init;
}

function setStoredConversation(bookingId: string, conv: ConversationDto): void {
  try {
    sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${bookingId}`, JSON.stringify(conv));
  } catch {
    // ignore
  }
}

export async function mockGetConversation(bookingId: string): Promise<ConversationDto> {
  await new Promise((r) => setTimeout(r, 120));
  return getStoredConversation(bookingId);
}

export async function mockSendMessage(
  bookingId: string,
  content: string
): Promise<ChatMessageDto> {
  await new Promise((r) => setTimeout(r, 180));

  const conv = getStoredConversation(bookingId);
  if (!conv.isOpen) {
    const err: any = new Error('Không thể gửi tin nhắn khi ca trực chưa được xác nhận.');
    err.code = 'CONVERSATION_CLOSED';
    throw err;
  }

  // Quét rò rỉ liên lạc / thanh toán ngoài
  const scan = detectOffPlatformContact(content);

  const newMsg: ChatMessageDto = {
    id: `msg-${Date.now()}`,
    conversationId: conv.id,
    senderRole: 'NURSE',
    type: MessageType.TEXT,
    content,
    flagged: scan.hasOffPlatformContact,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  conv.messages.push(newMsg);
  setStoredConversation(bookingId, conv);

  // Notify subscribers
  notifySubscribers(conv.id, newMsg);

  // Giả lập khách trả lời sau 2 giây nếu cuộc trò chuyện đang mở
  setTimeout(() => {
    simulateCustomerReply(bookingId, conv.id);
  }, 2000);

  return newMsg;
}

export async function mockMarkRead(_conversationId: string, _lastMessageId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 50));
}

function simulateCustomerReply(bookingId: string, conversationId: string): void {
  const conv = getStoredConversation(bookingId);
  if (!conv.isOpen) return;

  const replies = [
    'Dạ gia đình đã nhận được tin, cảm ơn điều dưỡng!',
    'Vâng ạ, người nhà đang có mặt ở phòng bệnh rồi nhé.',
    'Dạ vâng, phiền cô kiểm tra thêm nhiệt độ giúp bà với nhé.',
    'Ok cô, chúc cô đi đường an toàn.',
  ];
  const randomReply = replies[Math.floor(Math.random() * replies.length)];

  const replyMsg: ChatMessageDto = {
    id: `msg-reply-${Date.now()}`,
    conversationId,
    senderRole: 'PATIENT',
    type: MessageType.TEXT,
    content: randomReply,
    flagged: false,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  conv.messages.push(replyMsg);
  setStoredConversation(bookingId, conv);
  notifySubscribers(conversationId, replyMsg);
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

function notifySubscribers(conversationId: string, msg: ChatMessageDto): void {
  const set = subscribers.get(conversationId);
  if (set) {
    set.forEach((cb) => {
      try {
        cb(msg);
      } catch {
        // ignore
      }
    });
  }
}
