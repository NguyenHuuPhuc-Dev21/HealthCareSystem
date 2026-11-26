import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from '../../lib/usePolling';
import { getUnreadCount, subscribeNotifications } from './notifications.api';
import type { NotificationDto } from './notifications.api';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const FALLBACK_POLL_MS = 30_000;

interface NotificationContextValue {
  /** Số thông báo chưa đọc (hiện ở huy hiệu chuông) */
  unreadCount: number;
  /** Tải lại số chưa đọc từ server */
  refreshUnread: () => Promise<void>;
  /** Cập nhật số chưa đọc tại chỗ sau khi đọc/đọc hết (không cần gọi lại server) */
  adjustUnread: (delta: number | 'zero') => void;
  /** Đăng ký nhận thông báo mới (qua WebSocket); trả về hàm huỷ */
  onNew: (listener: (n: NotificationDto) => void) => () => void;
}

const Ctx = createContext<NotificationContextValue | null>(null);

/**
 * Nguồn dữ liệu chung cho chuông thông báo (FR-NOTIF-01): giữ số chưa đọc, nhận thông báo mới theo thời gian thực qua
 * WebSocket `/ws/notifications`, và tự hỏi lại mỗi 30 giây khi WebSocket không khả dụng (hoặc đang chạy mock).
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<(n: NotificationDto) => void>());

  const refreshUnread = useCallback(async () => {
    const res = await getUnreadCount();
    if (res.success) setUnreadCount(res.data.totalUnread);
  }, []);

  const adjustUnread = useCallback((delta: number | 'zero') => {
    setUnreadCount((c) => (delta === 'zero' ? 0 : Math.max(0, c + delta)));
  }, []);

  const onNew = useCallback((listener: (n: NotificationDto) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (USE_MOCK) return; // mock không có WebSocket → dùng polling
    return subscribeNotifications(
      (n) => {
        if (!n.readAt) setUnreadCount((c) => c + 1);
        listeners.current.forEach((l) => l(n));
      },
      setConnected,
    );
  }, []);

  // Có WebSocket thì chỉ cần lấy số chưa đọc một lần (usePolling gọi ngay khi gắn); không thì hỏi lại định kỳ.
  usePolling(refreshUnread, FALLBACK_POLL_MS, !connected);
  useEffect(() => {
    if (connected) refreshUnread(); // vừa kết nối lại → đồng bộ số đã bỏ lỡ
  }, [connected, refreshUnread]);

  const value = useMemo(() => ({ unreadCount, refreshUnread, adjustUnread, onNew }), [unreadCount, refreshUnread, adjustUnread, onNew]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const FALLBACK: NotificationContextValue = { unreadCount: 0, refreshUnread: async () => {}, adjustUnread: () => {}, onNew: () => () => {} };

/** Trả về giá trị mặc định (0 chưa đọc) nếu dùng ngoài provider, để các layout không bị lỗi. */
export function useNotifications(): NotificationContextValue {
  return useContext(Ctx) ?? FALLBACK;
}
