import type { NurseTier, QueueItem } from './nurse-verification.types';
import { TIER_LABEL } from './nurse-verification.types';

/** "30/10 · 08:12" theo giờ Việt Nam. */
export function formatShortDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')} · ${get('hour')}:${get('minute')}`;
}

/** "2026-05-15" → "15/05/2027" (ngày thuần, không đổi múi giờ). */
export function formatPlainDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${d}/${m}/${y}` : ymd;
}

/** Tuổi hồ sơ: "45 phút", "2 giờ", "1 ngày". */
export function formatAge(iso: string, now = Date.now()): { text: string; hours: number } {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  const hours = minutes / 60;
  if (minutes < 60) return { text: `${minutes} phút`, hours };
  if (hours < 24) return { text: `${Math.floor(hours)} giờ`, hours };
  return { text: `${Math.floor(hours / 24)} ngày`, hours };
}

/*
 * Ngưỡng tô màu tuổi hồ sơ trên giao diện (chỉ để nhắc Admin xử lý sớm, không phải quy tắc nghiệp vụ).
 * Bộ lọc "Quá 24 giờ (ưu tiên)" do backend lọc.
 */
const AGE_WARN_HOURS = 12;
const AGE_LATE_HOURS = 24;

export function ageTone(hours: number): 'normal' | 'warn' | 'late' {
  if (hours >= AGE_LATE_HOURS) return 'late';
  if (hours >= AGE_WARN_HOURS) return 'warn';
  return 'normal';
}

export interface DocumentSegment {
  label: string;
  ok: boolean;
}

/** Các giấy tờ đã nộp dạng đoạn có trạng thái — giao diện tự vẽ icon Check/Minus, không dùng ký tự ✓. */
export function documentsSegments(d: QueueItem['documents']): DocumentSegment[] {
  return [
    { label: 'CCCD', ok: d.cccd },
    { label: 'Bằng', ok: d.degree },
    {
      label: d.gphn === 'NEW_SUBMITTED' ? 'GPHN mới' : d.gphn === 'EXPIRED' ? 'GPHN (hết hạn)' : 'GPHN',
      ok: d.gphn !== 'NONE',
    },
    { label: 'Hưu trí', ok: d.retirement },
  ];
}

/** "Gợi ý: Cấp 2" hoặc "Giữ Cấp 2" (hồ sơ gia hạn, cấp không đổi). */
export function suggestionLabel(suggested: NurseTier, current: NurseTier | null): string {
  if (current && current === suggested) return `Giữ ${TIER_LABEL[suggested]}`;
  return `Gợi ý: ${TIER_LABEL[suggested]}`;
}
