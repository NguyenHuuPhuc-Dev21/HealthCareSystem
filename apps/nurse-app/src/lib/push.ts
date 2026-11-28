import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  EventType,
  Event as NotifeeEvent,
  Notification as NotifeeNotification,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import type { RadarJob } from '@healthcare-system/shared';
import {
  getOnlineStatus,
  registerDeviceToken,
  unregisterDeviceToken,
} from '../features/radar/radar.api';
import { ackNotification } from '../features/notifications/notifications.api';
import { resolveNotificationTarget } from '../features/notifications/notification-navigation';

export const PUSH_CHANNEL_RADAR = 'radar';
export const PUSH_CHANNEL_GENERAL = 'general';

export interface RadarPushPayload {
  type?: 'RADAR_URGENT' | string;
  offerId?: string;
  bookingId?: string;
  notificationId?: string;
  expiresAt?: string;
  expiresInSeconds?: number;
  serviceName?: string;
  urgentBonus?: number;
  totalAmount?: number;
  district?: string;
  patientName?: string;
  patientAge?: number;
  isInvasive?: boolean;
  hasPrescription?: boolean;
  paymentMethod?: 'BANK_TRANSFER' | 'CASH';
  [key: string]: any;
}

export function computeRemainingSeconds(
  expiresAt?: string,
  expiresInSeconds?: number
): number {
  if (expiresAt) {
    const expiryMs = Date.parse(expiresAt);
    if (!Number.isNaN(expiryMs)) {
      return Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
    }
  }
  return Math.max(0, expiresInSeconds ?? 45);
}

export function parsePushPayload(
  rawMessage: FirebaseMessagingTypes.RemoteMessage | null | undefined
): RadarPushPayload | null {
  if (!rawMessage || typeof rawMessage !== 'object') {
    return null;
  }

  const data = rawMessage.data || {};
  let parsedData: Record<string, any> = {};

  if (typeof data === 'string') {
    try {
      parsedData = JSON.parse(data);
    } catch {
      return null;
    }
  } else if (typeof data === 'object') {
    parsedData = { ...data };
  }

  const type = parsedData.type || parsedData.notificationType;
  const offerId = parsedData.offerId || parsedData.bookingId || parsedData.id;
  const bookingId = parsedData.bookingId || offerId;
  const notificationId = parsedData.notificationId || rawMessage.messageId;
  const expiresAt = parsedData.expiresAt || parsedData.radarExpiresAt;

  const urgentBonus =
    parsedData.urgentBonus !== undefined ? Number(parsedData.urgentBonus) : undefined;
  const totalAmount =
    parsedData.totalAmount !== undefined ? Number(parsedData.totalAmount) : undefined;
  const patientAge =
    parsedData.patientAge !== undefined ? Number(parsedData.patientAge) : undefined;

  return {
    ...parsedData,
    type,
    offerId: offerId ? String(offerId) : undefined,
    bookingId: bookingId ? String(bookingId) : undefined,
    notificationId: notificationId ? String(notificationId) : undefined,
    expiresAt: expiresAt ? String(expiresAt) : undefined,
    expiresInSeconds:
      parsedData.expiresInSeconds !== undefined
        ? Number(parsedData.expiresInSeconds)
        : undefined,
    serviceName: parsedData.serviceName ? String(parsedData.serviceName) : undefined,
    urgentBonus: Number.isNaN(urgentBonus) ? undefined : urgentBonus,
    totalAmount: Number.isNaN(totalAmount) ? undefined : totalAmount,
    district: parsedData.district ? String(parsedData.district) : undefined,
    patientName: parsedData.patientName ? String(parsedData.patientName) : undefined,
    patientAge: Number.isNaN(patientAge) ? undefined : patientAge,
    isInvasive:
      parsedData.isInvasive === true ||
      parsedData.isInvasive === 'true' ||
      parsedData.isInvasive === 1,
    hasPrescription:
      parsedData.hasPrescription === true ||
      parsedData.hasPrescription === 'true' ||
      parsedData.hasPrescription === 1,
    paymentMethod: parsedData.paymentMethod || 'BANK_TRANSFER',
  };
}

let activePushToken: string | null = null;
let foregroundRadarListener: ((payload: RadarPushPayload) => void) | null = null;
let navigationHandler: ((offerId: string, notificationId?: string) => void) | null = null;
let chatNavigationHandler: ((bookingId: string) => void) | null = null;
let notificationRouteHandler: ((routeName: string, params?: any) => void) | null = null;
let activeChatTarget: { bookingId?: string; conversationId?: string } | null = null;

export function setForegroundRadarListener(
  listener: ((payload: RadarPushPayload) => void) | null
): void {
  foregroundRadarListener = listener;
}

export function setNavigationHandler(
  handler: ((offerId: string, notificationId?: string) => void) | null
): void {
  navigationHandler = handler;
}

export function setChatNavigationHandler(
  handler: ((bookingId: string) => void) | null
): void {
  chatNavigationHandler = handler;
}

export function setNotificationRouteHandler(
  handler: ((routeName: string, params?: any) => void) | null
): void {
  notificationRouteHandler = handler;
}

export function setActiveChatTarget(
  target: { bookingId?: string; conversationId?: string } | null
): void {
  activeChatTarget = target;
}

export function getActiveChatTarget(): { bookingId?: string; conversationId?: string } | null {
  return activeChatTarget;
}

export function isSameActiveChat(
  target: { bookingId?: string; conversationId?: string } | null,
  payload: { bookingId?: string; conversationId?: string }
): boolean {
  if (!target) return false;
  if (target.conversationId && payload.conversationId) {
    return target.conversationId === payload.conversationId;
  }
  if (target.bookingId && payload.bookingId) {
    return target.bookingId === payload.bookingId;
  }
  return false;
}

export async function createNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: PUSH_CHANNEL_RADAR,
      name: 'Ca gấp Radar',
      importance: AndroidImportance.HIGH,
      sound: 'radar_alert',
      vibration: true,
      vibrationPattern: [300, 500, 300, 500],
      lights: true,
      badge: true,
    });

    await notifee.createChannel({
      id: PUSH_CHANNEL_GENERAL,
      name: 'Thông báo chung',
      importance: AndroidImportance.DEFAULT,
    });
  }
}

export async function requestPushPermission(): Promise<boolean> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    return enabled;
  } catch {
    return false;
  }
}

export async function getDevicePushToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    activePushToken = token;
    return token;
  } catch {
    return null;
  }
}

export async function initPushNotifications(): Promise<void> {
  await createNotificationChannels();

  const hasPermission = await requestPushPermission();
  if (hasPermission) {
    const token = await getDevicePushToken();
    if (token) {
      await registerDeviceToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    }

    messaging().onTokenRefresh(async (newToken) => {
      activePushToken = newToken;
      await registerDeviceToken(newToken, Platform.OS === 'ios' ? 'ios' : 'android');
    });
  }

  // Foreground message handler from Firebase
  messaging().onMessage(async (remoteMessage) => {
    await handleIncomingRemoteMessage(remoteMessage, true);
  });

  // Notifee event handlers (user tapping notification)
  notifee.onForegroundEvent(({ type, detail }: NotifeeEvent) => {
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      handleNotificationOpen(detail.notification);
    }
  });

  // Check initial notifications when app opens from quit state
  void checkInitialNotification();
}

export async function checkInitialNotification(): Promise<void> {
  try {
    const initialNotifee = await notifee.getInitialNotification();
    if (initialNotifee) {
      handleNotificationOpen(initialNotifee.notification);
      return;
    }

    const initialMessaging = await messaging().getInitialNotification();
    if (initialMessaging) {
      const payload = parsePushPayload(initialMessaging);
      if (payload) {
        routePushPayload(payload);
      }
    }
  } catch {
    // Ignore error
  }
}

export async function handleIncomingRemoteMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  isForeground = false
): Promise<void> {
  const payload = parsePushPayload(remoteMessage);
  if (!payload) return;

  if (payload.type === 'NEW_MESSAGE') {
    const incomingBookingId = payload.bookingId;
    const incomingConversationId =
      typeof payload.conversationId === 'string' ? payload.conversationId : undefined;

    if (
      isSameActiveChat(activeChatTarget, {
        bookingId: incomingBookingId,
        conversationId: incomingConversationId,
      })
    ) {
      // Suppress push notification when user is already viewing this exact conversation
      return;
    }

    const title =
      remoteMessage.notification?.title ||
      (typeof payload.senderName === 'string' && payload.senderName
        ? `Tin nhắn mới từ ${payload.senderName}`
        : 'Tin nhắn mới từ khách hàng');
    const body =
      remoteMessage.notification?.body ||
      (typeof payload.preview === 'string' && payload.preview
        ? payload.preview
        : 'Bạn có tin nhắn mới trong ca trực.');

    await notifee.displayNotification({
      id: payload.notificationId || `chat-${incomingBookingId || Date.now()}`,
      title,
      body,
      data: payload as Record<string, any>,
      android: {
        channelId: PUSH_CHANNEL_GENERAL,
        importance: AndroidImportance.DEFAULT,
        pressAction: {
          id: 'default',
        },
      },
    });
    if (payload.notificationId) {
      void ackNotification(payload.notificationId);
    }
    return;
  }

  if (payload.type === 'RADAR_URGENT') {
    const isOnline = await getOnlineStatus();
    if (!isOnline) {
      // Nurse is offline -> ignore Radar push
      return;
    }

    const title =
      remoteMessage.notification?.title ||
      '🚨 Ca gấp Radar cần nhận ngay!';
    const bonusText = payload.urgentBonus
      ? ` (+${payload.urgentBonus.toLocaleString('vi-VN')}đ thưởng)`
      : '';
    const body =
      remoteMessage.notification?.body ||
      `${payload.serviceName || 'Dịch vụ chăm sóc tại nhà'}${bonusText} · Cách bạn ${
        payload.district || 'gần bạn'
      }. Bấm để nhận!`;

    // Display Notifee notification with full screen intent & high priority sound
    await notifee.displayNotification({
      id: payload.notificationId || `radar-${payload.offerId || Date.now()}`,
      title,
      body,
      data: payload as Record<string, any>,
      android: {
        channelId: PUSH_CHANNEL_RADAR,
        importance: AndroidImportance.HIGH,
        sound: 'radar_alert',
        vibrationPattern: [300, 500, 300, 500],
        fullScreenAction: {
          id: 'default',
        },
        pressAction: {
          id: 'default',
        },
      },
    });

    if (payload.notificationId) {
      void ackNotification(payload.notificationId);
    }

    // If app is currently in foreground, notify listener immediately so RadarScreen appears
    if (isForeground && foregroundRadarListener) {
      foregroundRadarListener(payload);
    }
    return;
  }

  // General / HIGH-priority notifications (A17)
  const title = remoteMessage.notification?.title || String(payload.title || 'Thông báo CareNest');
  const body =
    remoteMessage.notification?.body ||
    String(payload.body || 'Bạn có cập nhật mới trong ứng dụng.');
  const isHigh = payload.priority === 'HIGH';

  await notifee.displayNotification({
    id: payload.notificationId || `notif-${Date.now()}`,
    title,
    body,
    data: payload as Record<string, any>,
    android: {
      channelId: PUSH_CHANNEL_GENERAL,
      importance: isHigh ? AndroidImportance.HIGH : AndroidImportance.DEFAULT,
      pressAction: {
        id: 'default',
      },
    },
  });

  if (payload.notificationId) {
    void ackNotification(payload.notificationId);
  }
}

export async function handleBackgroundMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage
): Promise<void> {
  await handleIncomingRemoteMessage(remoteMessage, false);
}

export function routePushPayload(payload: RadarPushPayload): void {
  if (payload.notificationId) {
    void ackNotification(String(payload.notificationId));
  }

  if (payload.type === 'NEW_MESSAGE' && payload.bookingId && chatNavigationHandler) {
    chatNavigationHandler(String(payload.bookingId));
    return;
  }

  if (payload.type === 'RADAR_URGENT' && payload.offerId && navigationHandler) {
    navigationHandler(String(payload.offerId), payload.notificationId);
    return;
  }

  if (notificationRouteHandler) {
    const target = resolveNotificationTarget({
      type: payload.type,
      id: payload.notificationId,
      data: payload,
    });
    notificationRouteHandler(target.routeName, target.params);
    return;
  }

  if (payload.offerId && navigationHandler) {
    navigationHandler(payload.offerId, payload.notificationId);
  }
}

function handleNotificationOpen(notification?: NotifeeNotification): void {
  if (!notification || !notification.data) return;
  const payload = notification.data as RadarPushPayload;
  routePushPayload(payload);
}

export function handleChatNotificationNavigation(
  payload: { type?: string; bookingId?: string },
  navigate: (route: string, params?: any) => void
): boolean {
  if (payload.type === 'NEW_MESSAGE' && payload.bookingId) {
    navigate('Chat', { bookingId: payload.bookingId });
    return true;
  }
  return false;
}

/**
 * Route deposit push notifications (A10 / ADR-0004)
 * TODO (A17): move to notification-navigation.ts when A17 notification center is implemented.
 */
export function handleDepositNotificationNavigation(
  payload: { type?: string; transactionId?: string; refundRequestId?: string },
  navigate: (route: string, params?: any) => void
): boolean {
  switch (payload.type) {
    case 'DEPOSIT_WITHHELD':
      navigate('Deposit');
      return true;
    case 'DEPOSIT_PENALTY':
      if (payload.transactionId) {
        navigate('PenaltyDetail', { transactionId: payload.transactionId });
      } else {
        navigate('Deposit');
      }
      return true;
    case 'PENALTY_REVERSED':
      if (payload.transactionId) {
        navigate('PenaltyDetail', { transactionId: payload.transactionId });
      } else {
        navigate('Deposit');
      }
      return true;
    case 'DEPOSIT_REFUND_STATUS':
      navigate('AccountClosure');
      return true;
    default:
      return false;
  }
}

/**
 * Route commission payment push notifications (A11 / FR-PAY-01, FR-PAY-02)
 * TODO (A17): move to notification-navigation.ts when A17 notification center is implemented.
 */
export function handleCommissionNotificationNavigation(
  payload: { type?: string; bookingId?: string; bookingCode?: string },
  navigate: (route: string, params?: any) => void
): boolean {
  switch (payload.type) {
    case 'COMMISSION_DUE':
    case 'COMMISSION_OVERDUE':
    case 'COMMISSION_PAID':
      navigate('CommissionPayment', { bookingId: payload.bookingId });
      return true;
    default:
      return false;
  }
}

export async function unregisterPushOnLogout(): Promise<void> {
  try {
    if (activePushToken) {
      await unregisterDeviceToken(activePushToken);
    }
    await messaging().deleteToken();
    activePushToken = null;
  } catch {
    // Ignore error
  }
}
