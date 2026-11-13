export interface RecurringWindow {
  id: string;
  /** 0 = Chủ nhật … 6 = Thứ 7 (đúng quy ước day_of_week của DB). */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface TimeOffException {
  id: string;
  specificDate: string;
  startTime: string;
  endTime: string;
}

export interface DateAvailability {
  id: string;
  specificDate: string;
  startTime: string;
  endTime: string;
}

export interface ConfirmedBooking {
  id: string;
  code: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'CONFIRMED' | 'IN_PROGRESS';
  serviceName: string;
}

export interface AvailabilityData {
  recurring: RecurringWindow[];
  timeOff: TimeOffException[];
  dateAvailability: DateAvailability[];
  bookings: ConfirmedBooking[];
}

export interface UpdateAvailabilityInput {
  recurring: RecurringWindow[];
  timeOff: TimeOffException[];
  dateAvailability: DateAvailability[];
}

export const WEEKDAY_ORDER: { dayOfWeek: number; label: string }[] = [
  { dayOfWeek: 1, label: 'Thứ 2' },
  { dayOfWeek: 2, label: 'Thứ 3' },
  { dayOfWeek: 3, label: 'Thứ 4' },
  { dayOfWeek: 4, label: 'Thứ 5' },
  { dayOfWeek: 5, label: 'Thứ 6' },
  { dayOfWeek: 6, label: 'Thứ 7' },
  { dayOfWeek: 0, label: 'Chủ nhật' },
];

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isOvernight(w: { startTime: string; endTime: string }): boolean {
  return minutesOf(w.endTime) <= minutesOf(w.startTime);
}

export function segmentsOnStartDay(w: { startTime: string; endTime: string }): [number, number][] {
  const s = minutesOf(w.startTime);
  const e = minutesOf(w.endTime);
  if (e > s) return [[s, e]];
  return [[s, 24 * 60]];
}

export function spillSegment(w: { startTime: string; endTime: string }): [number, number] | null {
  if (!isOvernight(w)) return null;
  return [0, minutesOf(w.endTime)];
}

function segmentsOverlap(a: [number, number][], b: [number, number][]): boolean {
  return a.some(([as, ae]) => b.some(([bs, be]) => as < be && bs < ae));
}

export function findOverlap(
  all: RecurringWindow[],
  dayOfWeek: number,
  candidate: { startTime: string; endTime: string }
): RecurringWindow | null {
  const candSegs = segmentsOnStartDay(candidate);
  const candSpill = spillSegment(candidate);
  const prevDay = (dayOfWeek + 6) % 7;
  const nextDay = (dayOfWeek + 1) % 7;

  for (const w of all) {
    if (w.dayOfWeek === dayOfWeek) {
      if (segmentsOverlap(candSegs, segmentsOnStartDay(w))) return w;
      const wSpill = spillSegment(w);
      if (candSpill && wSpill && segmentsOverlap([candSpill], [wSpill])) return w;
    }
    if (w.dayOfWeek === prevDay) {
      const prevSpill = spillSegment(w);
      if (prevSpill && segmentsOverlap(candSegs, [prevSpill])) return w;
    }
    if (w.dayOfWeek === nextDay && candSpill) {
      if (segmentsOverlap([candSpill], segmentsOnStartDay(w))) return w;
    }
  }
  return null;
}

export function formatWindow(w: { startTime: string; endTime: string }): string {
  return `${w.startTime} – ${w.endTime}`;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

