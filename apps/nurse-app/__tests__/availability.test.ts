import {
  findOverlap,
  isOvernight,
  formatWindow,
  lockedWindows,
  toISODate,
  type ConfirmedBooking,
  type RecurringWindow,
  type TimeOffException,
  type UpdateAvailabilityInput,
} from '@healthcare-system/shared';
import {
  getAvailabilities,
  updateAvailabilities,
} from '../src/features/availability/availability.api';
import {
  resetMockAvailabilityState,
  seedBookings,
  seedRecurringWindows,
} from '../src/features/availability/availability.mock';

const mockStorageMap: Record<string, string> = {};

jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn((key: string, val: string) => {
    mockStorageMap[key] = val;
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) => {
    return Promise.resolve(mockStorageMap[key] || null);
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorageMap[key];
    return Promise.resolve();
  }),
}));

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { USE_MOCK_AVAILABILITY: 'true' },
  Config: { USE_MOCK_AVAILABILITY: 'true' },
}));

describe('Availability & Schedule Hardening (A06)', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorageMap)) {
      delete mockStorageMap[key];
    }
    resetMockAvailabilityState();
    jest.clearAllMocks();
  });

  describe('Utility calculations (findOverlap, isOvernight, lockedWindows)', () => {
    const existing: RecurringWindow[] = [
      { id: 'w1', dayOfWeek: 1, startTime: '07:00', endTime: '12:00' },
      { id: 'w2', dayOfWeek: 1, startTime: '19:00', endTime: '06:00' }, // Overnight to T3 06:00
      { id: 'w3', dayOfWeek: 2, startTime: '08:00', endTime: '12:00' },
    ];

    it('identifies overnight windows correctly', () => {
      expect(isOvernight({ startTime: '19:00', endTime: '06:00' })).toBe(true);
      expect(isOvernight({ startTime: '20:00', endTime: '00:00' })).toBe(true);
      expect(isOvernight({ startTime: '07:00', endTime: '12:00' })).toBe(false);
      expect(isOvernight({ startTime: '00:00', endTime: '23:59' })).toBe(false);
    });

    it('detects overlap within the same day', () => {
      // Overlaps 07:00 - 12:00
      const overlap1 = findOverlap(existing, 1, { startTime: '09:00', endTime: '11:00' });
      expect(overlap1?.id).toBe('w1');

      // Partial overlap at end
      const overlap2 = findOverlap(existing, 1, { startTime: '11:30', endTime: '13:00' });
      expect(overlap2?.id).toBe('w1');

      // Non-overlapping afternoon window
      const noOverlap = findOverlap(existing, 1, { startTime: '13:00', endTime: '17:00' });
      expect(noOverlap).toBeNull();
    });

    it('detects overlap with overnight spillover to the next day', () => {
      // w2 starts at T1 19:00 and spills into T2 00:00 - 06:00
      // Candidate on T2 (dayOfWeek = 2) at 04:00 - 07:00 overlaps with w2 spillover
      const spillOverlap = findOverlap(existing, 2, { startTime: '04:00', endTime: '07:00' });
      expect(spillOverlap?.id).toBe('w2');

      // Candidate on T2 at 06:30 - 07:30 does not overlap with 00:00-06:00 spillover or w3 (08:00-12:00)
      const validT2 = findOverlap(existing, 2, { startTime: '06:30', endTime: '07:30' });
      expect(validT2).toBeNull();
    });

    it('locks windows when confirmed bookings overlap in the upcoming 14 days', () => {
      const mockToday = new Date('2026-11-19T08:00:00');
      // Friday 2026-11-20 is tomorrow (within 14 days)
      const fridayDate = '2026-11-20';
      const fridayWindows: RecurringWindow[] = [
        { id: 'w-fri-night', dayOfWeek: 5, startTime: '20:00', endTime: '06:00' },
        { id: 'w-sat-all', dayOfWeek: 6, startTime: '00:00', endTime: '23:59' },
      ];

      const bookings: ConfirmedBooking[] = [
        {
          id: 'b-1',
          code: 'HC-2026-1052',
          date: fridayDate,
          startTime: '20:00',
          endTime: '06:00',
          status: 'CONFIRMED',
          serviceName: 'Chăm sóc hậu phẫu tại nhà',
        },
      ];

      const locked = lockedWindows(fridayWindows, bookings, mockToday);
      expect(locked.has('w-fri-night')).toBe(true);
      expect(locked.get('w-fri-night')).toBe('HC-2026-1052');
      expect(locked.has('w-sat-all')).toBe(false);
    });
  });

  describe('Availability API & Mock Storage Flow', () => {
    it('retrieves default seed availabilities with recurring windows and bookings', async () => {
      const res = await getAvailabilities();
      expect(res.success).toBe(true);
      expect(res.data.recurring.length).toBeGreaterThan(0);
      expect(res.data.bookings.length).toBeGreaterThan(0);
      expect(res.data.bookings[0].code).toBe('HC-2026-1052');
    });

    it('saves updated schedule and persists to storage', async () => {
      const initial = await getAvailabilities();
      const updatedRecurring = [
        ...initial.data.recurring,
        { id: 'w-test-add', dayOfWeek: 3, startTime: '08:00', endTime: '12:00' },
      ];

      const input: UpdateAvailabilityInput = {
        recurring: updatedRecurring,
        timeOff: [
          {
            id: 'to-1',
            specificDate: '2026-11-20',
            startTime: '00:00',
            endTime: '23:59',
          },
        ],
        dateAvailability: [],
      };

      const saveRes = await updateAvailabilities(input);
      expect(saveRes.success).toBe(true);
      expect(saveRes.data.recurring.some((w) => w.id === 'w-test-add')).toBe(true);
      expect(saveRes.data.timeOff.length).toBe(1);

      // Verify persistent re-fetch
      const refetched = await getAvailabilities();
      expect(refetched.data.recurring.some((w) => w.id === 'w-test-add')).toBe(true);
      expect(refetched.data.timeOff[0].specificDate).toBe('2026-11-20');
    });

    it('rejects schedule update with AVAILABILITY_LOCKED if a locked window is removed', async () => {
      const current = await getAvailabilities();
      const locked = lockedWindows(current.data.recurring, current.data.bookings);

      const lockedId = [...locked.keys()][0];
      expect(lockedId).toBeDefined();

      // Attempt to save while omitting the locked window
      const illegalRecurring = current.data.recurring.filter((w) => w.id !== lockedId);
      const input: UpdateAvailabilityInput = {
        recurring: illegalRecurring,
        timeOff: [],
        dateAvailability: [],
      };

      const res = await updateAvailabilities(input);
      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('AVAILABILITY_LOCKED');
      expect(res.error?.message).toContain('không thể xóa hoặc sửa');
    });

    it('constructs multi-day time-off range properly (20-22/11 generates 3 entries)', () => {
      const start = new Date('2026-11-20');
      const end = new Date('2026-11-22');
      const items: TimeOffException[] = [];

      const curr = new Date(start);
      while (curr <= end) {
        items.push({
          id: `to-${curr.getDate()}`,
          specificDate: toISODate(curr),
          startTime: '00:00',
          endTime: '23:59',
        });
        curr.setDate(curr.getDate() + 1);
      }

      expect(items.length).toBe(3);
      expect(items.map((i) => i.specificDate)).toEqual([
        '2026-11-20',
        '2026-11-21',
        '2026-11-22',
      ]);
    });
  });
});
