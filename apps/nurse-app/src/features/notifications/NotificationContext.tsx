import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import {
  NotificationPriority,
  type NotificationDto,
} from '@healthcare-system/shared';
import { useAuth } from '../auth/AuthContext';
import { PUSH_CHANNEL_GENERAL } from '../../lib/push';
import {
  ackNotification,
  getNotifications,
  markAllRead,
  markRead,
  subscribeNotifications,
} from './notifications.api';
import { NOTIFICATION_CONFIG } from './notification-labels';

export interface NotificationContextValue {
  notifications: NotificationDto[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function countUnreadNotifications(items: NotificationDto[]): number {
  return items.filter((n) => !n.readAt).length;
}

async function displayForegroundHighBanner(notif: NotificationDto): Promise<void> {
  try {
    await notifee.displayNotification({
      id: `fg-${notif.id}`,
      title: notif.title,
      body: notif.body,
      data: {
        ...(notif.data || {}),
        type: notif.type,
        notificationId: notif.id,
      },
      android: {
        channelId: PUSH_CHANNEL_GENERAL,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
      },
    });
  } catch {
    // Ignore Notifee error in headless/test environments
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { zone } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [totalUnreadOverride, setTotalUnreadOverride] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchFirstPage = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await getNotifications({ limit: NOTIFICATION_CONFIG.PAGE_SIZE });
      if (res.success && res.data) {
        setNotifications(res.data.items);
        setNextCursor(res.data.nextCursor ?? null);
        setTotalUnreadOverride(
          typeof res.data.totalUnread === 'number' ? res.data.totalUnread : null
        );
      }
    } catch {
      // Ignore transient error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load notifications when nurse enters active zone
  useEffect(() => {
    if (zone !== 'active') {
      setNotifications([]);
      setNextCursor(null);
      setTotalUnreadOverride(null);
      return;
    }
    void fetchFirstPage(false);
  }, [zone, fetchFirstPage]);

  // Reload when app returns to foreground ('active')
  useEffect(() => {
    if (zone !== 'active') return;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active'
      ) {
        void fetchFirstPage(false);
      }
      appStateRef.current = nextState;
    });
    return () => {
      sub.remove();
    };
  }, [zone, fetchFirstPage]);

  // Subscribe to realtime notifications
  useEffect(() => {
    if (zone !== 'active') return;

    const unsubscribe = subscribeNotifications((newNotif) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
      setTotalUnreadOverride((prev) =>
        typeof prev === 'number' && !newNotif.readAt ? prev + 1 : prev
      );

      // Show Notifee foreground banner for HIGH priority (excluding RADAR_URGENT) and ack
      if (
        newNotif.priority === NotificationPriority.HIGH &&
        newNotif.type !== 'RADAR_URGENT' &&
        AppState.currentState !== 'background' &&
        AppState.currentState !== 'inactive'
      ) {
        void displayForegroundHighBanner(newNotif);
        void ackNotification(newNotif.id);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [zone]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await getNotifications({
        cursor: nextCursor,
        limit: NOTIFICATION_CONFIG.PAGE_SIZE,
      });
      if (res.success && res.data) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const appended = res.data.items.filter((n) => !existingIds.has(n.id));
          return [...prev, ...appended];
        });
        setNextCursor(res.data.nextCursor ?? null);
      }
    } catch {
      // Ignore error
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, loading]);

  const refresh = useCallback(async () => {
    await fetchFirstPage(true);
  }, [fetchFirstPage]);

  const markAsRead = useCallback(async (id: string) => {
    const nowIso = new Date().toISOString();
    let wasUnread = false;

    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id && !n.readAt) {
          wasUnread = true;
          return { ...n, readAt: nowIso };
        }
        return n;
      })
    );

    if (wasUnread) {
      setTotalUnreadOverride((prev) =>
        typeof prev === 'number' ? Math.max(0, prev - 1) : prev
      );
    }

    await Promise.allSettled([markRead(id), ackNotification(id)]);
  }, []);

  const markAllAsRead = useCallback(async () => {
    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: nowIso }))
    );
    setTotalUnreadOverride(0);
    await markAllRead();
  }, []);

  const unreadCount = useMemo(() => {
    if (totalUnreadOverride !== null) return totalUnreadOverride;
    return countUnreadNotifications(notifications);
  }, [notifications, totalUnreadOverride]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      refreshing,
      loadingMore,
      hasMore: Boolean(nextCursor),
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
    }),
    [
      notifications,
      unreadCount,
      loading,
      refreshing,
      loadingMore,
      nextCursor,
      refresh,
      loadMore,
      markAsRead,
      markAllAsRead,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return ctx;
}

export function useOptionalNotifications(): NotificationContextValue | null {
  return useContext(NotificationContext);
}
