import { useEffect, useRef } from 'react';

/**
 * Gọi `task` ngay khi gắn vào rồi lặp lại mỗi `intervalMs` (chỉ khi tab đang hiển thị).
 * Dùng cho dữ liệu "thời gian thực" khi chưa có WebSocket. `enabled=false` thì tạm dừng.
 */
export function usePolling(task: () => void | Promise<void>, intervalMs: number, enabled = true): void {
  const saved = useRef(task);
  saved.current = task;

  useEffect(() => {
    if (!enabled) return;
    saved.current();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') saved.current();
    }, intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && saved.current();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled]);
}
