import React from 'react';
import renderer, { act } from 'react-test-renderer';
import notifee from '@notifee/react-native';
import {
  NotificationPriority,
  type NotificationDto,
} from '@healthcare-system/shared';
import { AuthProvider } from '../src/features/auth/AuthContext';
import {
  countUnreadNotifications,
  NotificationProvider,
} from '../src/features/notifications/NotificationContext';
import {
  groupNotificationsByDay,
  NotificationsScreen,
} from '../src/features/notifications/NotificationsScreen';
import { NOTIFICATION_LABELS } from '../src/features/notifications/notification-labels';
import { resolveNotificationTarget } from '../src/features/notifications/notification-navigation';
import {
  getMockAckedNotificationIds,
  mockPushNotification,
  resetNotificationsMockState,
} from '../src/features/notifications/notifications.mock';
import {
  handleIncomingRemoteMessage,
  routePushPayload,
  setNotificationRouteHandler,
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

describe('A17 — Trung tâm thông báo (nurse-app)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetNotificationsMockState();
    setNotificationRouteHandler(null);
  });

  describe('1. notification-navigation.ts (map loại -> màn)', () => {
    it('maps all NurseNotificationType values to the expected screens and params', () => {
      expect(
        resolveNotificationTarget({
          type: 'RADAR_URGENT',
          id: 'n1',
          data: { offerId: 'offer-1' },
        })
      ).toEqual({
        routeName: 'Radar',
        params: { offerId: 'offer-1', notificationId: 'n1' },
      });

      expect(resolveNotificationTarget({ type: 'DIRECT_INVITE' })).toEqual({
        routeName: 'MainTabs',
        params: { screen: 'JobsTab' },
      });
      expect(resolveNotificationTarget({ type: 'NEW_JOB' })).toEqual({
        routeName: 'MainTabs',
        params: { screen: 'JobsTab' },
      });

      const sampleShift = { bookingId: 'job-1' };
      expect(
        resolveNotificationTarget({
          type: 'EXTENSION_REQUEST',
          data: { shift: sampleShift },
        })
      ).toEqual({
        routeName: 'ActiveShift',
        params: { shift: sampleShift },
      });

      expect(
        resolveNotificationTarget({
          type: 'DISPUTE_OPENED',
          data: { disputeId: 'disp-1' },
        })
      ).toEqual({
        routeName: 'DisputeDetail',
        params: { disputeId: 'disp-1' },
      });

      expect(
        resolveNotificationTarget({
          type: 'COMMISSION_DUE',
          data: { bookingId: 'bk-cash-1057' },
        })
      ).toEqual({
        routeName: 'CommissionPayment',
        params: { bookingId: 'bk-cash-1057' },
      });

      expect(resolveNotificationTarget({ type: 'DEPOSIT_LOW' })).toEqual({
        routeName: 'Deposit',
      });
      expect(resolveNotificationTarget({ type: 'DEPOSIT_WITHHELD' })).toEqual({
        routeName: 'Deposit',
      });

      expect(
        resolveNotificationTarget({
          type: 'DEPOSIT_PENALTY',
          data: { transactionId: 'tx-1' },
        })
      ).toEqual({
        routeName: 'PenaltyDetail',
        params: { transactionId: 'tx-1' },
      });
      expect(
        resolveNotificationTarget({
          type: 'PENALTY_REVERSED',
          data: { transactionId: 'tx-2' },
        })
      ).toEqual({
        routeName: 'PenaltyDetail',
        params: { transactionId: 'tx-2' },
      });

      expect(resolveNotificationTarget({ type: 'DEPOSIT_REFUND_STATUS' })).toEqual({
        routeName: 'AccountClosure',
      });

      expect(
        resolveNotificationTarget({
          type: 'NEW_MESSAGE',
          data: { bookingId: 'job-1', bookingCode: 'BK-001' },
        })
      ).toEqual({
        routeName: 'Chat',
        params: { bookingId: 'job-1', bookingCode: 'BK-001' },
      });

      expect(resolveNotificationTarget({ type: 'GPHN_EXPIRING' })).toEqual({
        routeName: 'Credentials',
      });
      expect(resolveNotificationTarget({ type: 'CREDENTIAL_REVIEWED' })).toEqual({
        routeName: 'Credentials',
      });
      expect(resolveNotificationTarget({ type: 'REVIEW_RECEIVED' })).toEqual({
        routeName: 'TrustScore',
      });

      expect(resolveNotificationTarget({ type: 'UNKNOWN_TYPE' as any })).toEqual({
        routeName: 'Notifications',
      });
    });
  });

  describe('2. Unread count & grouping by day', () => {
    it('counts unread notifications accurately', () => {
      const items: NotificationDto[] = [
        {
          id: '1',
          type: 'NEW_JOB',
          priority: NotificationPriority.NORMAL,
          title: 'A',
          body: 'B',
          readAt: null,
          createdAt: '2026-11-26T08:00:00.000Z',
        },
        {
          id: '2',
          type: 'SETTLEMENT_DONE',
          priority: NotificationPriority.NORMAL,
          title: 'C',
          body: 'D',
          readAt: '2026-11-26T08:05:00.000Z',
          createdAt: '2026-11-26T07:00:00.000Z',
        },
      ];
      expect(countUnreadNotifications(items)).toBe(1);
    });

    it('groups notifications into Today and Earlier sections', () => {
      const nowMs = new Date(2026, 10, 26, 10, 0, 0).getTime();
      const todayIso = new Date(2026, 10, 26, 8, 30, 0).toISOString();
      const yesterdayIso = new Date(2026, 10, 25, 18, 0, 0).toISOString();

      const sections = groupNotificationsByDay(
        [
          {
            id: 't1',
            type: 'NEW_MESSAGE',
            priority: NotificationPriority.NORMAL,
            title: 'Hôm nay',
            body: 'Tin mới',
            readAt: null,
            createdAt: todayIso,
          },
          {
            id: 'e1',
            type: 'SETTLEMENT_DONE',
            priority: NotificationPriority.NORMAL,
            title: 'Hôm qua',
            body: 'Đã quyết toán',
            readAt: yesterdayIso,
            createdAt: yesterdayIso,
          },
        ],
        nowMs
      );

      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe(NOTIFICATION_LABELS.sectionToday);
      expect(sections[0].data.map((i) => i.id)).toEqual(['t1']);
      expect(sections[1].title).toBe(NOTIFICATION_LABELS.sectionEarlier);
      expect(sections[1].data.map((i) => i.id)).toEqual(['e1']);
    });
  });

  describe('3. NotificationsScreen & NotificationContext interactions', () => {
    it('loads notifications, marks one read + acks + navigates, and marks all read', async () => {
      const mockNavigation: any = {
        navigate: jest.fn(),
        goBack: jest.fn(),
      };

      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          React.createElement(
            AuthProvider,
            { autoStartDevSession: true },
            React.createElement(
              NotificationProvider,
              null,
              React.createElement(NotificationsScreen, {
                navigation: mockNavigation,
              })
            )
          )
        );
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 250));
      });

      const text = collectText(tree.root);
      expect(text).toContain(NOTIFICATION_LABELS.sectionToday);
      expect(text).toContain('Cần nộp hoa hồng ca tiền mặt 15%');
      // 5 unread in mock initial data
      expect(text).toContain('5');

      const commissionItem = tree.root.findByProps({
        accessibilityLabel: 'Cần nộp hoa hồng ca tiền mặt 15%',
      });
      await act(async () => {
        commissionItem.props.onPress();
        await new Promise((r) => setTimeout(r, 80));
      });

      expect(mockNavigation.navigate).toHaveBeenCalledWith('CommissionPayment', {
        bookingId: 'bk-cash-1057',
      });
      expect(getMockAckedNotificationIds()).toContain('notif-1');
      expect(collectText(tree.root)).toContain('4');

      const markAllBtn = tree.root.findByProps({
        accessibilityLabel: NOTIFICATION_LABELS.markAllRead,
      });
      await act(async () => {
        markAllBtn.props.onPress();
        await new Promise((r) => setTimeout(r, 80));
      });

      expect(markAllBtn.props.disabled).toBe(true);

      act(() => {
        tree.unmount();
      });
    });

    it('receives realtime HIGH notification and triggers foreground Notifee banner + ack', async () => {
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          React.createElement(
            AuthProvider,
            { autoStartDevSession: true },
            React.createElement(
              NotificationProvider,
              null,
              React.createElement(NotificationsScreen, { onBack: jest.fn() })
            )
          )
        );
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });

      await act(async () => {
        mockPushNotification({
          id: 'notif-rt-high',
          type: 'DISPUTE_OPENED',
          priority: NotificationPriority.HIGH,
          title: 'Khiếu nại khẩn',
          body: 'Khách hàng vừa mở khiếu nại mới',
          data: { disputeId: 'disp-99' },
          readAt: null,
          createdAt: new Date().toISOString(),
        });
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(getMockAckedNotificationIds()).toContain('notif-rt-high');
      expect(collectText(tree.root)).toContain('Khiếu nại khẩn');

      act(() => {
        tree.unmount();
      });
    });
  });

  describe('4. push.ts integration with notification-navigation & ack', () => {
    it('acks on remote push display and routes DISPUTE_OPENED tap to DisputeDetail', async () => {
      const routeHandler = jest.fn();
      setNotificationRouteHandler(routeHandler);

      await handleIncomingRemoteMessage(
        {
          messageId: 'fcm-100',
          notification: {
            title: 'Khiếu nại mới',
            body: 'Vui lòng gửi giải trình',
          },
          data: {
            type: 'DISPUTE_OPENED',
            disputeId: 'disp-100',
            notificationId: 'notif-push-100',
            priority: 'HIGH',
          },
        } as any,
        false
      );

      expect(notifee.displayNotification).toHaveBeenCalledTimes(1);
      expect(getMockAckedNotificationIds()).toContain('notif-push-100');

      routePushPayload({
        type: 'DISPUTE_OPENED',
        disputeId: 'disp-100',
        notificationId: 'notif-push-100',
      });

      expect(routeHandler).toHaveBeenCalledWith('DisputeDetail', {
        disputeId: 'disp-100',
      });
    });
  });
});
