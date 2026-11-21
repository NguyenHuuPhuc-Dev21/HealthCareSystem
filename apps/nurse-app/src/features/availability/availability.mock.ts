import EncryptedStorage from 'react-native-encrypted-storage';
import type {
  AvailabilityData,
  ConfirmedBooking,
  RecurringWindow,
  TimeOffException,
  DateAvailability,
  UpdateAvailabilityInput,
} from '@healthcare-system/shared';
import { lockedWindows, toISODate } from '@healthcare-system/shared';

const STORAGE_KEY = 'carenest_mock_availability_data_v1';

function nextWeekday(jsDay: number, addWeeks = 0): Date {
  const now = new Date();
  const delta = ((jsDay - now.getDay() + 7) % 7) + addWeeks * 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta);
}

export function seedBookings(): ConfirmedBooking[] {
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

export function seedRecurringWindows(): RecurringWindow[] {
  return [
    { id: 'seed-w1', dayOfWeek: 1, startTime: '07:00', endTime: '12:00' },
    { id: 'seed-w2', dayOfWeek: 1, startTime: '19:00', endTime: '06:00' },
    { id: 'seed-w3', dayOfWeek: 2, startTime: '07:00', endTime: '12:00' },
    { id: 'seed-w4', dayOfWeek: 2, startTime: '19:00', endTime: '06:00' },
    { id: 'seed-w5', dayOfWeek: 3, startTime: '07:00', endTime: '21:00' },
    { id: 'seed-w6', dayOfWeek: 4, startTime: '07:00', endTime: '12:00' },
    { id: 'seed-w7', dayOfWeek: 5, startTime: '20:00', endTime: '06:00' },
    { id: 'seed-w8', dayOfWeek: 6, startTime: '00:00', endTime: '23:59' },
  ];
}

interface StoredAvailability {
  recurring: RecurringWindow[];
  timeOff: TimeOffException[];
  dateAvailability: DateAvailability[];
}

let inMemoryState: StoredAvailability | null = null;

export async function mockGetAvailabilities(): Promise<AvailabilityData> {
  if (inMemoryState) {
    return {
      recurring: [...inMemoryState.recurring],
      timeOff: [...inMemoryState.timeOff],
      dateAvailability: [...inMemoryState.dateAvailability],
      bookings: seedBookings(),
    };
  }

  try {
    const raw = await EncryptedStorage.getItem(STORAGE_KEY);
    if (raw) {
      inMemoryState = JSON.parse(raw);
    }
  } catch {
    // Fallback if storage fails
  }

  if (!inMemoryState) {
    inMemoryState = {
      recurring: seedRecurringWindows(),
      timeOff: [],
      dateAvailability: [],
    };
    try {
      await EncryptedStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryState));
    } catch {}
  }

  return {
    recurring: [...inMemoryState.recurring],
    timeOff: [...inMemoryState.timeOff],
    dateAvailability: [...inMemoryState.dateAvailability],
    bookings: seedBookings(),
  };
}

export async function mockUpdateAvailabilities(
  input: UpdateAvailabilityInput
): Promise<
  | { success: true; data: AvailabilityData }
  | { success: false; code: string; message: string }
> {
  const current = await mockGetAvailabilities();
  const locked = lockedWindows(current.recurring, current.bookings);

  // Check if any locked window was deleted
  const removedLockedId = [...locked.keys()].find(
    (id) => !input.recurring.some((w) => w.id === id)
  );

  if (removedLockedId) {
    const bookingCode = locked.get(removedLockedId);
    return {
      success: false,
      code: 'AVAILABILITY_LOCKED',
      message: `Khung giờ đang có ca ${bookingCode} đã nhận nên không thể xóa hoặc sửa.`,
    };
  }

  inMemoryState = {
    recurring: input.recurring,
    timeOff: input.timeOff,
    dateAvailability: input.dateAvailability,
  };

  try {
    await EncryptedStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryState));
  } catch {}

  return {
    success: true,
    data: {
      recurring: input.recurring,
      timeOff: input.timeOff,
      dateAvailability: input.dateAvailability,
      bookings: seedBookings(),
    },
  };
}

export function resetMockAvailabilityState(): void {
  inMemoryState = null;
}
