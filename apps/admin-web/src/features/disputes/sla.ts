import { formatDateTime } from '../../lib/formatters';
import type { Dispute } from './disputes.types';

/**
 * Trạng thái hạn phản hồi của bên bị khiếu nại (`rebuttalDueAt` = mở + DISPUTE_REBUTTAL_HOURS).
 * - chưa phản hồi & còn hạn → còn X giờ
 * - chưa phản hồi & quá hạn → "quá hạn" (Admin có thể phán quyết dựa trên bằng chứng sẵn có)
 * - đã phản hồi / đã xử lý → "—"
 */
export function rebuttalSla(d: Dispute): { text: string; tone: 'ok' | 'warn' | 'late' } {
  const closed = d.status.startsWith('RESOLVED');
  if (closed || d.nurseRebuttal || d.kind === 'PENALTY_APPEAL' || !d.rebuttalDueAt) return { text: '—', tone: 'ok' };
  const ms = Date.parse(d.rebuttalDueAt) - Date.now();
  if (ms <= 0) return { text: `Quá hạn từ ${formatDateTime(d.rebuttalDueAt)}`, tone: 'late' };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return { text: h > 0 ? `Còn ${h} giờ ${m} phút` : `Còn ${m} phút`, tone: h < 4 ? 'warn' : 'ok' };
}
