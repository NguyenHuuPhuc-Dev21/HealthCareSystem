import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';
import { NotificationPriority } from '@healthcare-system/shared';
import type { NotificationDto } from '@healthcare-system/shared';
import {
  getNotifications,
  markAllRead,
  markRead,
  subscribeNotifications,
} from './notifications.api';
import { getNotificationRoute } from './notification-routes';
import { useAuth } from '../auth/AuthContext';

interface NotificationContextValue {
  notifications: NotificationDto[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
  activeHighToast: NotificationDto | null;
  dismissToast: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * Âm thanh báo hiệu ngắn (Melodic Chime) cho thông báo HIGH ưu tiên cao
 */
function playHighPriorityChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // 2-tone melodic chime: D5 (587.33Hz) -> A5 (880Hz)
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  } catch {
    // Trình duyệt có thể chặn autoplay âm thanh khi chưa có tương tác
  }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeHighToast, setActiveHighToast] = useState<NotificationDto | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const { session } = useAuth();
  const isAuthenticated = Boolean(session?.token);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.readAt).length;
  }, [notifications]);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      const res = await getNotifications();
      if (res.success && res.data) {
        setNotifications(res.data.items);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Tải danh sách thông báo lần đầu
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const triggerHighPriorityToast = useCallback((notif: NotificationDto) => {
    setActiveHighToast(notif);
    playHighPriorityChime();

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setActiveHighToast(null);
    }, 7000);
  }, []);

  // Lắng nghe thông báo mới qua WebSocket hoặc Mock subscriber (chỉ khi đã đăng nhập)
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = subscribeNotifications((newNotif) => {
      setNotifications((prev) => {
        // Tránh trùng lặp
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });

      // Nếu là thông báo HIGH (ca gấp, khách hủy sát giờ, khiếu nại...), phát âm thanh và hiển thị toast
      if (newNotif.priority === NotificationPriority.HIGH) {
        triggerHighPriorityToast(newNotif);
      }
    });

    // Polling fallback mỗi 30 giây
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [isAuthenticated, fetchNotifications, triggerHighPriorityToast]);

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n))
    );
    try {
      await markRead(id);
    } catch {
      // ignore
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const now = new Date().toISOString();
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
    try {
      await markAllRead();
    } catch {
      // ignore
    }
  }, []);

  const dismissToast = useCallback(() => {
    setActiveHighToast(null);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
  }, []);

  const handleToastClick = () => {
    if (!activeHighToast) return;
    markAsRead(activeHighToast.id);
    const targetRoute = getNotificationRoute(activeHighToast);
    dismissToast();
    navigate(targetRoute);
  };

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      refresh: fetchNotifications,
      activeHighToast,
      dismissToast,
    }),
    [
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      fetchNotifications,
      activeHighToast,
      dismissToast,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {/* Floating High-Priority Toast Banner */}
      {activeHighToast && (
        <aside
          className="notification-urgent-toast"
          role="alert"
          aria-live="assertive"
          aria-label={`Thông báo khẩn: ${activeHighToast.title}`}
        >
          <div className="notification-urgent-toast__content">
            <div className="notification-urgent-toast__icon">
              <AlertTriangle size={20} aria-hidden="true" />
            </div>
            <div className="notification-urgent-toast__text">
              <div className="notification-urgent-toast__title-row">
                <span className="notification-urgent-toast__badge">KHẨN CẤP</span>
                <strong className="notification-urgent-toast__title">{activeHighToast.title}</strong>
              </div>
              <p className="notification-urgent-toast__body">{activeHighToast.body}</p>
            </div>
          </div>

          <div className="notification-urgent-toast__actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleToastClick}
              style={{ minHeight: 30, padding: '4px 10px', fontSize: 13 }}
            >
              <span>Xem ngay</span>
              <ExternalLink size={13} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="notification-urgent-toast__close"
              onClick={dismissToast}
              aria-label="Đóng thông báo khẩn"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </aside>
      )}
    </NotificationContext.Provider>
  );
};

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
