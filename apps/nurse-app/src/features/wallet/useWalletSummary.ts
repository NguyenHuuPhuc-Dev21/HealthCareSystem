import { useCallback, useEffect, useState } from 'react';
import type { WalletSummaryDto } from '@healthcare-system/shared';
import { getWalletSummary } from './wallet.api';

export function useWalletSummary() {
  const [summary, setSummary] = useState<WalletSummaryDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getWalletSummary();
      if (res.success && res.data) {
        setSummary(res.data);
      } else {
        setError(res.error?.message || 'Không thể tải thông tin số dư ví.');
      }
    } catch {
      setError('Lỗi kết nối khi tải số dư ví.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, loading, error, refresh };
}
