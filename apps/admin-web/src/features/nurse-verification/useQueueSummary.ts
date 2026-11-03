import { useCallback, useEffect, useState } from 'react';
import { getQueueSummary } from './nurse-verification.api';
import type { QueueSummary } from './nurse-verification.types';

/** Số hồ sơ chờ (badge sidebar "Duyệt hồ sơ" + số trên tab). */
export function useQueueSummary() {
  const [summary, setSummary] = useState<QueueSummary | null>(null);

  const refresh = useCallback(async () => {
    const res = await getQueueSummary();
    if (res.success) setSummary(res.data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, total: summary ? summary.NEW + summary.RENEWAL : undefined, refresh };
}
