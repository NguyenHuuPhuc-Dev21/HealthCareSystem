import type {
    AvailabilityData,
    ConfirmedBooking,
    RecurringWindow,
    UpdateAvailabilityInput,
} from './availability.types';
import { minutesOf, toISODate } from './availability.types';

/**
 * Mock Lịch rảnh (FR-SCHED-01) — chạy khi VITE_USE_MOCK_AVAILABILITY != 'false'.
 * Dữ liệu sửa được (khung tuần / ngày nghỉ / mở rảnh riêng) lưu ở localStorage
 * theo số điện thoại, giống mock DB của Giai đoạn 1.
 * Ca đã CONFIRMED là dữ liệu CHỈ ĐỌC, sinh theo tuần hiện tại để luôn demo được
 * trạng thái "đã có ca — không sửa được" trên board N13 (đơn HC-2026-1052).
 */

const DB_KEY = 'mock_availability_db_v1';
const MAI_PHONE = '0902222222';

interface StoredAvail {
    recurring: AvailabilityData['recurring'];
    timeOff: AvailabilityData['timeOff'];
    dateAvailability: AvailabilityData['dateAvailability'];
}

function delay<T>(value: T, ms = 400): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function loadDb(): Record<string, StoredAvail> {
    try {
        return JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    } catch {
        return {};
    }
}

function saveDb(db: Record<string, StoredAvail>) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

/** Ngày (theo giờ máy) của thứ `jsDay` (0=CN..6=T7) sắp tới, tính cả hôm nay. */
function nextWeekday(jsDay: number, addWeeks = 0): Date {
    const now = new Date();
    const delta = (jsDay - now.getDay() + 7) % 7 + addWeeks * 7;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
    return d;
}

/** Ca mẫu đã CONFIRMED — chỉ có ở tài khoản mẫu Trần Thị Mai. */
function seedBookings(phone: string): ConfirmedBooking[] {
    if (phone !== MAI_PHONE) return [];
    const friday = nextWeekday(5); // Thứ 6 tuần này
    const nextWed = nextWeekday(3, 1); // Thứ 4 tuần sau
    return [
        {
            id: 'seed-b1',
            code: 'HC-2026-1052',
            date: toISODate(friday),
            startTime: '20:00',
            endTime: '06:00',
            status: 'CONFIRMED',
            serviceName: 'Chăm sóc hậu phẫu tại nhà',
        },
        {
            id: 'seed-b2',
            code: 'HC-2026-1061',
            date: toISODate(nextWed),
            startTime: '07:00',
            endTime: '12:00',
            status: 'CONFIRMED',
            serviceName: 'Thay băng, chăm sóc vết thương',
        },
    ];
}

/** Khung tuần mẫu đúng board N13 (tài khoản Trần Thị Mai). */
function seedStored(phone: string): StoredAvail {
    if (phone !== MAI_PHONE) return { recurring: [], timeOff: [], dateAvailability: [] };
    const w = (id: string, dayOfWeek: number, startTime: string, endTime: string): RecurringWindow => ({
        id,
        dayOfWeek,
        startTime,
        endTime,
    });
    return {
        recurring: [
            w('seed-w1', 1, '07:00', '12:00'),
            w('seed-w2', 1, '19:00', '06:00'),
            w('seed-w3', 2, '07:00', '12:00'),
            w('seed-w4', 2, '19:00', '06:00'),
            w('seed-w5', 3, '07:00', '21:00'),
            w('seed-w6', 4, '07:00', '12:00'),
            w('seed-w7', 5, '20:00', '06:00'),
            w('seed-w8', 6, '00:00', '23:59'),
        ],
        timeOff: [],
        dateAvailability: [],
    };
}

/**
 * Khung tuần nào đang bị khóa bởi ca đã CONFIRMED/IN_PROGRESS?
 * Khóa khi: có ca trong 14 ngày tới rơi đúng thứ của khung và ca BAO TRỌN khung
 * (ca 07:00–12:00 nằm trong khung 07:00–21:00 thì khung vẫn sửa được).
 * Trả về Map: id khung -> mã đơn khóa nó.
 */
export function lockedWindows(
    recurring: RecurringWindow[],
    bookings: ConfirmedBooking[],
): Map<string, string> {
    const locked = new Map<string, string>();
    const today = new Date();
    const horizon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
    const norm = (start: string, end: string): [number, number] => {
        const s = minutesOf(start);
        let e = minutesOf(end);
        if (e <= s) e += 24 * 60;
        return [s, e];
    };
    for (const b of bookings) {
        const bDate = new Date(`${b.date}T00:00:00`);
        if (bDate < new Date(today.getFullYear(), today.getMonth(), today.getDate()) || bDate > horizon) continue;
        const [bs, be] = norm(b.startTime, b.endTime);
        for (const w of recurring) {
            if (w.dayOfWeek !== bDate.getDay()) continue;
            const [ws, we] = norm(w.startTime, w.endTime);
            if (bs <= ws && be >= we) locked.set(w.id, b.code);
        }
    }
    return locked;
}

export function mockGetAvailabilities(phone: string): Promise<AvailabilityData> {
    const db = loadDb();
    if (!db[phone]) {
        db[phone] = seedStored(phone);
        saveDb(db);
    }
    return delay({ ...db[phone], bookings: seedBookings(phone) });
}

export function mockUpdateAvailabilities(
    phone: string,
    input: UpdateAvailabilityInput,
): Promise<{ ok: true; data: AvailabilityData } | { ok: false; code: string; message: string }> {
    const db = loadDb();
    const current = db[phone] ?? seedStored(phone);
    const locked = lockedWindows(current.recurring, seedBookings(phone));
    const removedLocked = [...locked.keys()].find(
        (id) => !input.recurring.some((w) => w.id === id),
    );
    if (removedLocked) {
        return delay({
            ok: false as const,
            code: 'AVAILABILITY_LOCKED',
            message: `Khung giờ đã có ca ${locked.get(removedLocked)} nên không thể xóa hoặc sửa.`,
        });
    }
    db[phone] = {
        recurring: input.recurring,
        timeOff: input.timeOff,
        dateAvailability: input.dateAvailability,
    };
    saveDb(db);
    return delay({ ok: true as const, data: { ...db[phone], bookings: seedBookings(phone) } });
}