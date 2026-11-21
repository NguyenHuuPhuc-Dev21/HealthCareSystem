import {
  enqueueAction,
  loadQueue,
  getPendingQueue,
  getPendingQueueCount,
  dequeueAction,
  clearQueue,
  processQueue,
  validateCheckOutPrerequisites,
  isNetworkConnected,
  type QueuedAction,
} from '../src/features/active-shift/offline-queue';
import { submitCheckOut } from '../src/features/active-shift/active-shift.api';
import NetInfo from '@react-native-community/netinfo';

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

let mockIsConnected = true;
let mockIsInternetReachable = true;
const mockListeners = new Set<(arg: unknown) => void>();

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: mockIsConnected,
      isInternetReachable: mockIsInternetReachable,
    })
  ),
  addEventListener: jest.fn((cb: (arg: unknown) => void) => {
    mockListeners.add(cb);
    return () => mockListeners.delete(cb);
  }),
}));

function setMockNetworkStatus(connected: boolean, reachable = true) {
  mockIsConnected = connected;
  mockIsInternetReachable = reachable;
  mockListeners.forEach((cb) =>
    cb({ isConnected: connected, isInternetReachable: reachable })
  );
}

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {},
  Config: {},
}));

describe('Offline Queue & Shift Hardening (A05)', () => {
  const bookingId = 'bk-shift-001';

  beforeEach(async () => {
    for (const key of Object.keys(mockStorageMap)) {
      delete mockStorageMap[key];
    }
    await clearQueue();
    setMockNetworkStatus(true, true);
    jest.clearAllMocks();
  });

  it('enqueues an action with unique idempotencyKey and timestamp', async () => {
    const item = await enqueueAction({
      bookingId,
      type: 'ADD_VITALS',
      payload: {
        timestamp: '08:30',
        heartRate: 78,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        temperature: 36.6,
        spo2: 98,
      },
    });

    expect(item.id).toMatch(/^queue_/);
    expect(item.idempotencyKey).toContain(`idemp_${bookingId}_add_vitals`);
    expect(item.bookingId).toBe(bookingId);
    expect(item.type).toBe('ADD_VITALS');
    expect(item.retryCount).toBe(0);

    const count = await getPendingQueueCount(bookingId);
    expect(count).toBe(1);
  });

  it('preserves FIFO ordering when multiple actions are queued', async () => {
    await enqueueAction({
      bookingId,
      type: 'ADD_VITALS',
      payload: { heartRate: 75 },
    });
    await enqueueAction({
      bookingId,
      type: 'TOGGLE_ACTIVITY',
      payload: { activityId: 'act-1', completed: true },
    });
    await enqueueAction({
      bookingId,
      type: 'TRIGGER_SOS',
      payload: { latitude: 16.07, longitude: 108.22 },
    });

    const queue = await getPendingQueue(bookingId);
    expect(queue.length).toBe(3);
    expect(queue[0].type).toBe('ADD_VITALS');
    expect(queue[1].type).toBe('TOGGLE_ACTIVITY');
    expect(queue[2].type).toBe('TRIGGER_SOS');
  });

  it('processes queue successfully and removes completed actions in FIFO order', async () => {
    await enqueueAction({ bookingId, type: 'ADD_VITALS', payload: { step: 1 } });
    await enqueueAction({ bookingId, type: 'TOGGLE_ACTIVITY', payload: { step: 2 } });

    const processedSteps: number[] = [];
    const executor = jest.fn().mockImplementation(async (action: QueuedAction) => {
      processedSteps.push(action.payload.step);
      return true;
    });

    const result = await processQueue(executor, bookingId);
    expect(result.processed).toBe(2);
    expect(result.remaining).toBe(0);
    expect(processedSteps).toEqual([1, 2]);

    const remaining = await getPendingQueueCount(bookingId);
    expect(remaining).toBe(0);
  });

  it('stops processing and preserves order when an action fails during synchronization', async () => {
    await enqueueAction({ bookingId, type: 'ADD_VITALS', payload: { step: 1 } });
    await enqueueAction({ bookingId, type: 'TOGGLE_ACTIVITY', payload: { step: 2 } });

    const executor = jest.fn().mockImplementation(async (action: QueuedAction) => {
      if (action.payload.step === 1) return true;
      return false; // Step 2 fails
    });

    const result = await processQueue(executor, bookingId);
    expect(result.processed).toBe(1);
    expect(result.remaining).toBe(1);

    const remaining = await getPendingQueue(bookingId);
    expect(remaining.length).toBe(1);
    expect(remaining[0].payload.step).toBe(2);
    expect(remaining[0].retryCount).toBe(1);
  });

  it('blocks check-out when device is offline', async () => {
    setMockNetworkStatus(false, false);

    const check = await validateCheckOutPrerequisites(bookingId);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Bắt buộc có kết nối mạng');

    const res = await submitCheckOut(bookingId, {
      checkoutTime: new Date().toISOString(),
      finalVitals: {
        timestamp: '11:00',
        heartRate: 75,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        temperature: 36.5,
        spo2: 99,
      },
      completedActivityIds: ['1', '2'],
      handoverNote: 'Bàn giao tốt',
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('CHECKOUT_PRECONDITION_FAILED');
  });

  it('blocks check-out when device is online but offline queue is not empty', async () => {
    setMockNetworkStatus(true, true);

    await enqueueAction({
      bookingId,
      type: 'ADD_VITALS',
      payload: { heartRate: 80 },
    });

    const check = await validateCheckOutPrerequisites(bookingId);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Còn 1 mục dữ liệu chưa được gửi');

    const res = await submitCheckOut(bookingId, {
      checkoutTime: new Date().toISOString(),
      finalVitals: {
        timestamp: '11:00',
        heartRate: 75,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        temperature: 36.5,
        spo2: 99,
      },
      completedActivityIds: ['1', '2'],
      handoverNote: 'Bàn giao tốt',
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('CHECKOUT_PRECONDITION_FAILED');
  });

  it('allows check-out when device is online and queue is completely drained', async () => {
    setMockNetworkStatus(true, true);
    await clearQueue(bookingId);

    const check = await validateCheckOutPrerequisites(bookingId);
    expect(check.allowed).toBe(true);

    const res = await submitCheckOut(bookingId, {
      checkoutTime: new Date().toISOString(),
      finalVitals: {
        timestamp: '11:00',
        heartRate: 75,
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        temperature: 36.5,
        spo2: 99,
      },
      completedActivityIds: ['1', '2'],
      handoverNote: 'Bàn giao người nhà',
    });

    expect(res.success).toBe(true);
  });
});
