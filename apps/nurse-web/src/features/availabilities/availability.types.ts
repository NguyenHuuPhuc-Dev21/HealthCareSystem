/**
 * Kiểu dữ liệu Lịch rảnh & Ngày nghỉ (FR-SCHED-01, màn N13).
 *
 * Ánh xạ 1-1 với bảng nurse_availabilities (SRS §7 bảng 10):
 * - RECURRING_AVAILABLE: khung lặp lại theo thứ trong tuần (day_of_week 0=CN..6=T7).
 * - TIME_OFF_EXCEPTION: nghỉ vào một ngày cụ thể (specific_date).
 * Riêng "mở rảnh riêng một ngày" (trạng thái xanh trên board N13) CHƯA có loại
 * tương ứng trong schema — xem ghi chú ở availabilities.api.ts, chờ BE-2 chốt.
 */

/** Khung giờ lặp lại hằng tuần. endTime <= startTime nghĩa là khung QUA ĐÊM
 *  (vd 19:00 – 06:00 = rảnh từ 19:00 hôm đó tới 06:00 sáng hôm sau). */
export interface RecurringWindow {
    id: string;
    /** 0 = Chủ nhật … 6 = Thứ 7 (đúng quy ước day_of_week của DB). */
    dayOfWeek: number;
    /** 'HH:mm' */
    startTime: string;
    /** 'HH:mm' */
    endTime: string;
}

/** Ngày nghỉ cụ thể. Nghỉ cả ngày = 00:00 – 23:59. */
export interface TimeOffException {
    id: string;
    /** 'YYYY-MM-DD' */
    specificDate: string;
    startTime: string;
    endTime: string;
}

/** Mở rảnh riêng cho một ngày cụ thể (ghi đè lịch tuần ngày đó). */
export interface DateAvailability {
    id: string;
    /** 'YYYY-MM-DD' */
    specificDate: string;
    startTime: string;
    endTime: string;
}

/** Ca đã chốt hiển thị kèm trên lịch (chỉ đọc ở Giai đoạn 2 — đặt ca là GĐ3). */
export interface ConfirmedBooking {
    id: string;
    code: string;
    /** 'YYYY-MM-DD' — ngày bắt đầu ca. */
    date: string;
    startTime: string;
    /** endTime <= startTime = ca qua đêm, kết thúc sáng hôm sau. */
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

/** Thứ tự hiển thị trên UI: Thứ 2 → Chủ nhật, kèm day_of_week theo DB. */
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

/**
 * Các đoạn [start, end) theo phút TRONG MỘT NGÀY của một khung giờ.
 * Khung qua đêm tách 2 đoạn: phần thuộc ngày bắt đầu và phần tràn sang ngày sau
 * (phần tràn được tính khi xét ngày hôm sau — xem windowsOverlapOnDay).
 */
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

/**
 * Kiểm tra một khung MỚI có chồng lấn với các khung đã có của cùng một thứ không,
 * tính cả phần tràn qua đêm của khung ngày hôm trước và của chính khung mới.
 * Trả về khung bị trùng đầu tiên, hoặc null nếu không trùng.
 */
export function findOverlap(
    all: RecurringWindow[],
    dayOfWeek: number,
    candidate: { startTime: string; endTime: string },
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