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
  ackNotification,
  getOnlineStatus,
  registerDeviceToken,
  unregisterDeviceToken,
} from '../features/radar/radar.api';

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
      if (payload?.offerId && navigationHandler) {
        navigationHandler(payload.offerId, payload.notificationId);
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

  const isOnline = await getOnlineStatus();
  if (!isOnline) {
    // Nurse is offline -> ignore Radar push
    return;
  }

  if (payload.type === 'RADAR_URGENT') {
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

    // If app is currently in foreground, notify listener immediately so RadarScreen appears
    if (isForeground && foregroundRadarListener) {
      foregroundRadarListener(payload);
    }
  }
}

export async function handleBackgroundMessage(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage
): Promise<void> {
  await handleIncomingRemoteMessage(remoteMessage, false);
}

function handleNotificationOpen(notification?: NotifeeNotification): void {
  if (!notification || !notification.data) return;
  const payload = notification.data as RadarPushPayload;

  if (payload.offerId && navigationHandler) {
    navigationHandler(payload.offerId, payload.notificationId);
  }
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
