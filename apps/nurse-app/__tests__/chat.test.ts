import React from 'react';
import { Alert, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import notifee from '@notifee/react-native';
import {
  detectOffPlatformContact,
  MessageType,
} from '@healthcare-system/shared';
import * as chatApi from '../src/features/chat/chat.api';
import { resetChatMockState } from '../src/features/chat/chat.mock';
import { CHAT_LABELS } from '../src/features/chat/chat-labels';
import {
  sortMessagesForInvertedList,
  type OptimisticChatMessage,
} from '../src/features/chat/useConversation';
import { ChatScreen } from '../src/features/chat/ChatScreen';
import { Composer } from '../src/features/chat/components/Composer';
import { MessageBubble } from '../src/features/chat/components/MessageBubble';
import { ShiftBriefingScreen } from '../src/features/shift-briefing/ShiftBriefingScreen';
import {
  handleChatNotificationNavigation,
  handleIncomingRemoteMessage,
  setActiveChatTarget,
} from '../src/lib/push';

function collectText(node: renderer.ReactTestInstance): string {
  return node
    .findAllByType('Text' as any)
    .map((t) =>
      t.children
        .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
        .join('')
    )
    .join(' | ');
}

describe('A16 — Chat với khách (nurse-app)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetChatMockState();
    setActiveChatTarget(null);
  });

  describe('1. contact-detector.ts', () => {
    it('detects 10-digit, spaced, and dotted Vietnamese phone numbers', () => {
      expect(detectOffPlatformContact('Số của tôi 0905123456').hasOffPlatformContact).toBe(true);
      expect(detectOffPlatformContact('zalo 0905 123 456').hasOffPlatformContact).toBe(true);
      expect(detectOffPlatformContact('Gọi 0905.123.456 nhé').hasOffPlatformContact).toBe(true);
    });

    it('detects social links (zalo.me, facebook.com) and off-platform payment keywords', () => {
      const zalo = detectOffPlatformContact('Nhắn qua zalo.me/0905123456');
      expect(zalo.hasOffPlatformContact).toBe(true);
      expect(zalo.reasons).toContain('EXTERNAL_LINK');

      const zaloBare = detectOffPlatformContact('Tìm zalo.me của mình nhé');
      expect(zaloBare.hasOffPlatformContact).toBe(true);
      expect(zaloBare.reasons).toContain('EXTERNAL_LINK');

      const fb = detectOffPlatformContact('Kết bạn facebook.com/carenest.nurse');
      expect(fb.hasOffPlatformContact).toBe(true);
      expect(fb.reasons).toContain('EXTERNAL_LINK');

      const pay = detectOffPlatformContact('Anh chuyển khoản riêng cho em nhé');
      expect(pay.hasOffPlatformContact).toBe(true);
      expect(pay.reasons).toContain('OFF_PLATFORM_PAYMENT');
    });

    it('allows clean clinical coordination messages without flagging', () => {
      const clean = detectOffPlatformContact(
        'Tôi đã tới trước cổng, nhờ gia đình mở cửa giúp ạ.'
      );
      expect(clean.hasOffPlatformContact).toBe(false);
      expect(clean.reasons).toHaveLength(0);
    });
  });

  describe('2. Message ordering for inverted FlatList', () => {
    it('places newest message at index 0 and oldest at the end', () => {
      const msgs: OptimisticChatMessage[] = [
        {
          id: 'm1',
          conversationId: 'c1',
          senderRole: 'SYSTEM',
          type: MessageType.SYSTEM_ALERT,
          content: 'Mở kênh chat',
          createdAt: '2026-11-26T08:00:00.000Z',
          status: 'sent',
        },
        {
          id: 'm2',
          conversationId: 'c1',
          senderRole: 'NURSE',
          type: MessageType.TEXT,
          content: 'Tin thứ hai',
          createdAt: '2026-11-26T08:05:00.000Z',
          status: 'sent',
        },
        {
          id: 'm3',
          conversationId: 'c1',
          senderRole: 'PATIENT',
          type: MessageType.TEXT,
          content: 'Tin mới nhất',
          createdAt: '2026-11-26T08:10:00.000Z',
          status: 'sent',
        },
      ];

      const inverted = sortMessagesForInvertedList(msgs);
      expect(inverted.map((m) => m.id)).toEqual(['m3', 'm2', 'm1']);
    });
  });

  describe('3. Composer warning dialog & locked state', () => {
    it('prompts confirmation when off-platform contact is detected and sends only on confirm', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const onSend = jest.fn();

      let tree!: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          React.createElement(Composer, { isOpen: true, onSend })
        );
      });

      const input = tree.root.findByType(TextInput);
      act(() => {
        input.props.onChangeText('zalo 0905 123 456');
      });

      const sendBtn = tree.root.findByType(TouchableOpacity);
      act(() => {
        sendBtn.props.onPress();
      });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy.mock.calls[0][1]).toBe(CHAT_LABELS.offPlatformDialogMessage);
      expect(onSend).not.toHaveBeenCalled();

      const buttons = alertSpy.mock.calls[0][2] as Array<{ text?: string; onPress?: () => void }>;
      const confirmBtn = buttons.find((b) => b.text === CHAT_LABELS.offPlatformDialogConfirm);
      expect(confirmBtn).toBeDefined();

      act(() => {
        confirmBtn?.onPress?.();
      });

      expect(onSend).toHaveBeenCalledWith('zalo 0905 123 456');
    });

    it('locks composer and shows reason when isOpen is false', () => {
      let tree!: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          React.createElement(Composer, { isOpen: false, onSend: jest.fn() })
        );
      });

      const text = collectText(tree.root);
      expect(text).toContain(CHAT_LABELS.composerLockedTitle);
      expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    });
  });

  describe('4. MessageBubble flagged & retry behavior', () => {
    it('renders flagged warning and retry button for failed messages', () => {
      const onRetry = jest.fn();
      const failedFlaggedMsg: OptimisticChatMessage = {
        id: 'temp-123',
        conversationId: 'conv-job-1',
        senderRole: 'NURSE',
        type: MessageType.TEXT,
        content: 'Gọi 0905123456',
        flagged: true,
        createdAt: '2026-11-26T08:15:00.000Z',
        status: 'error',
        errorMessage: 'Lỗi mạng khi gửi',
      };

      let tree!: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          React.createElement(MessageBubble, { message: failedFlaggedMsg, onRetry })
        );
      });

      const text = collectText(tree.root);
      expect(text).toContain(CHAT_LABELS.flaggedWarning);
      expect(text).toContain(CHAT_LABELS.retryButton);

      const retryBtn = tree.root.findByProps({
        accessibilityLabel: CHAT_LABELS.retryButton,
      });
      act(() => {
        retryBtn.props.onPress();
      });
      expect(onRetry).toHaveBeenCalledWith('temp-123');
    });
  });

  describe('5. ChatScreen optimistic send & retry integration', () => {
    it('loads conversation, shows masked phone, and retries a failed message', async () => {
      const sendSpy = jest
        .spyOn(chatApi, 'sendMessage')
        .mockResolvedValueOnce({
          success: false,
          data: null as any,
          error: { code: 'NETWORK_ERROR', message: 'Mất kết nối' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            id: 'msg-sent-99',
            conversationId: 'conv-job-1',
            senderRole: 'NURSE',
            type: MessageType.TEXT,
            content: 'Tôi đang tới',
            flagged: false,
            createdAt: new Date().toISOString(),
            readAt: null,
          },
        });

      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          React.createElement(ChatScreen, { bookingId: 'job-1' })
        );
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 300));
      });

      const initialText = collectText(tree.root);
      expect(initialText).toContain('0905 ••• 688');

      const input = tree.root.findByType(TextInput);
      act(() => {
        input.props.onChangeText('Tôi đang tới');
      });

      const sendBtn = tree.root.findByProps({
        accessibilityLabel: CHAT_LABELS.composerSendAccessibility,
      });
      await act(async () => {
        sendBtn.props.onPress();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });

      expect(collectText(tree.root)).toContain(CHAT_LABELS.retryButton);

      const retryBtn = tree.root.findByProps({
        accessibilityLabel: CHAT_LABELS.retryButton,
      });
      await act(async () => {
        retryBtn.props.onPress();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });

      expect(sendSpy).toHaveBeenCalledTimes(2);
      expect(collectText(tree.root)).toContain(CHAT_LABELS.statusSent);
      act(() => {
        tree.unmount();
      });
      sendSpy.mockRestore();
    });
  });

  describe('6. Push notification NEW_MESSAGE handling & ShiftBriefing button', () => {
    it('suppresses push when viewing the same chat and displays push otherwise', async () => {
      setActiveChatTarget({ bookingId: 'job-1', conversationId: 'conv-job-1' });
      await handleIncomingRemoteMessage(
        {
          messageId: 'push-1',
          data: {
            type: 'NEW_MESSAGE',
            bookingId: 'job-1',
            conversationId: 'conv-job-1',
            preview: 'Xin chào',
          },
        } as any,
        true
      );
      expect(notifee.displayNotification).not.toHaveBeenCalled();

      setActiveChatTarget(null);
      await handleIncomingRemoteMessage(
        {
          messageId: 'push-2',
          data: {
            type: 'NEW_MESSAGE',
            bookingId: 'job-1',
            conversationId: 'conv-job-1',
            preview: 'Gia đình đã mở cửa',
          },
        } as any,
        false
      );
      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);

      const navigate = jest.fn();
      const handled = handleChatNotificationNavigation(
        { type: 'NEW_MESSAGE', bookingId: 'job-1' },
        navigate
      );
      expect(handled).toBe(true);
      expect(navigate).toHaveBeenCalledWith('Chat', { bookingId: 'job-1' });
    });

    it('renders Nhắn tin button with unread badge on ShiftBriefingScreen', () => {
      const onOpenChat = jest.fn();
      let tree!: renderer.ReactTestRenderer;
      act(() => {
        tree = renderer.create(
          React.createElement(ShiftBriefingScreen, {
            bookingId: 'job-1',
            bookingCode: 'BK-20261102-001',
            serviceName: 'Chăm sóc vết loét',
            timeRange: '08:00 - 12:00',
            patientName: 'Bà Nguyễn Thị Mai',
            patientAge: 78,
            patientAddress: '123 Lê Lợi, Q1',
            mobilityNote: 'Hỗ trợ một phần',
            allergies: 'Không',
            isInvasive: false,
            unreadChatCount: 3,
            onOpenChat,
            onProceedToCheckIn: jest.fn(),
            onBack: jest.fn(),
          })
        );
      });

      const text = collectText(tree.root);
      expect(text).toContain(CHAT_LABELS.chatActionButton);
      expect(text).toContain('3');

      const chatBtn = tree.root.findByProps({
        accessibilityLabel: CHAT_LABELS.chatActionButton,
      });
      act(() => {
        chatBtn.props.onPress();
      });
      expect(onOpenChat).toHaveBeenCalledTimes(1);
    });
  });
});
