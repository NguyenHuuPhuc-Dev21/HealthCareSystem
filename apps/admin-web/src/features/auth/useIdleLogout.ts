import { useCallback, useEffect, useRef, useState } from 'react';

/** Khớp `ADMIN_SESSION_IDLE_MINUTES` (system_configs, mặc định 30) — backend mới là nơi thu hồi refresh token; đây là lớp bảo vệ phía giao diện. */
export const ADMIN_IDLE_MINUTES = 30;
const WARN_BEFORE_MS = 2 * 60_000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = ['mousedown', 'keydown', 'touchstart', 'scroll'];
const THROTTLE_MS = 1_000;

/**
 * Tự đăng xuất khi Admin không thao tác trong `ADMIN_IDLE_MINUTES` phút (phiên Admin phải ngắn — thao tác trên tiền và dữ liệu y tế).
 * Trả về `warning` (số giây còn lại) trong 2 phút cuối để giao diện cho người dùng bấm "Tiếp tục phiên".
 */
export function useIdleLogout(onTimeout: () => void, minutes = ADMIN_IDLE_MINUTES) {
  const limit = minutes * 60_000;
  const lastActive = useRef(Date.now());
  const lastBump = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timeoutRef = useRef(onTimeout);
  timeoutRef.current = onTimeout;

  const bump = useCallback(() => {
    const now = Date.now();
    if (now - lastBump.current < THROTTLE_MS) return;
    lastBump.current = now;
    lastActive.current = now;
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    // Không tính cuộc gọi lúc đang cảnh báo: phải bấm nút rõ ràng ("Tiếp tục phiên") mới gia hạn
    const onActivity = () => {
      if (Date.now() - lastActive.current < limit - WARN_BEFORE_MS) bump();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const tick = window.setInterval(() => {
      const idle = Date.now() - lastActive.current;
      if (idle >= limit) {
        timeoutRef.current();
      } else if (idle >= limit - WARN_BEFORE_MS) {
        setSecondsLeft(Math.ceil((limit - idle) / 1000));
      }
    }, 1_000);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      window.clearInterval(tick);
    };
  }, [limit, bump]);

  const stayActive = useCallback(() => {
    lastBump.current = 0;
    bump();
  }, [bump]);

  return { warningSecondsLeft: secondsLeft, stayActive };
}
