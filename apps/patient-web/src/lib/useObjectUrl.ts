import { useEffect, useState } from 'react';

/** Tạo URL xem trước cho File/Blob và tự thu hồi khi file đổi hoặc component bị huỷ. */
export function useObjectUrl(file: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return url;
}
