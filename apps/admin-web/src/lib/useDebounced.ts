import { useEffect, useState } from 'react';

/** Trả về `value` sau khi ngừng đổi `delay` ms — dùng cho ô tìm kiếm để không gọi API mỗi phím gõ. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}
