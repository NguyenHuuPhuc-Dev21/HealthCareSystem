import { useEffect, useState } from 'react';

/** Số giây còn lại tới mốc `targetMs` (epoch ms), cập nhật mỗi giây. */
export function useCountdown(targetMs: number): number {
  const calc = () => Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
  const [secondsLeft, setSecondsLeft] = useState(calc);

  useEffect(() => {
    setSecondsLeft(calc());
    const id = window.setInterval(() => {
      const next = calc();
      setSecondsLeft(next);
      if (next === 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMs]);

  return secondsLeft;
}

export function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
