import { useCallback, useRef, useState } from 'react';
import { getCredentialUrl } from './nurse-verification.api';

/** Làm mới URL trước khi hết hạn bấy nhiêu ms (presigned URL chỉ sống 10 phút). */
const REFRESH_BEFORE_MS = 30_000;

type Entry = { url: string; expiresAt: number } | { error: true };

/**
 * Lấy presigned URL cho từng giấy tờ khi cần xem (không tải trước tất cả).
 * - Còn hạn → dùng lại; sắp/hết hạn → xin URL mới.
 * - Ảnh lỗi khi tải (URL vừa hết hạn) → gọi `refresh(id)` để xin lại.
 */
export function useCredentialUrls(nurseId: string) {
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const inFlight = useRef(new Set<string>());

  const fetchUrl = useCallback(
    async (credentialId: string) => {
      if (inFlight.current.has(credentialId)) return;
      inFlight.current.add(credentialId);
      const res = await getCredentialUrl(nurseId, credentialId);
      inFlight.current.delete(credentialId);
      setEntries((prev) => ({
        ...prev,
        [credentialId]: res.success
          ? { url: res.data.url, expiresAt: new Date(res.data.expires_at).getTime() }
          : { error: true },
      }));
    },
    [nurseId]
  );

  /** URL hiện có (có thể là URL cũ dùng tạm trong lúc xin URL mới), 'error', hoặc null nếu chưa tải. */
  const urlFor = useCallback(
    (credentialId: string): string | null | 'error' => {
      const entry = entries[credentialId];
      if (!entry) return null;
      return 'error' in entry ? 'error' : entry.url;
    },
    [entries]
  );

  /** Gọi trong useEffect: xin URL nếu chưa có hoặc sắp hết hạn. */
  const ensure = useCallback(
    (credentialId: string) => {
      const entry = entries[credentialId];
      if (entry && 'error' in entry) return;
      if (entry && entry.expiresAt - Date.now() > REFRESH_BEFORE_MS) return;
      void fetchUrl(credentialId);
    },
    [entries, fetchUrl]
  );

  const refresh = useCallback(
    (credentialId: string) => {
      setEntries((prev) => {
        const next = { ...prev };
        delete next[credentialId];
        return next;
      });
      void fetchUrl(credentialId);
    },
    [fetchUrl]
  );

  return { urlFor, ensure, refresh };
}
