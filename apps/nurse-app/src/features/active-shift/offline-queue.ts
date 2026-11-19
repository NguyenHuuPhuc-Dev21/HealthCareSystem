import EncryptedStorage from 'react-native-encrypted-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type QueuedActionType =
  | 'ADD_VITALS'
  | 'TOGGLE_ACTIVITY'
  | 'SUBMIT_ASSESSMENT'
  | 'REJECT_PRESCRIPTION'
  | 'RESPOND_EXTENSION'
  | 'TRIGGER_SOS';

export interface QueuedAction<T = any> {
  id: string;
  idempotencyKey: string;
  bookingId: string;
  type: QueuedActionType;
  payload: T;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const STORAGE_KEY = 'carenest_offline_shift_queue';

let memoryQueue: QueuedAction[] | null = null;
let isProcessing = false;
const listeners = new Set<(queue: QueuedAction[]) => void>();

function notifyListeners(): void {
  const current = memoryQueue || [];
  listeners.forEach((listener) => {
    try {
      listener([...current]);
    } catch {
      // Ignore listener error
    }
  });
}

function generateIdempotencyKey(type: QueuedActionType, bookingId: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  return `idemp_${bookingId}_${type.toLowerCase()}_${ts}_${rand}`;
}

/**
 * Loads pending actions from encrypted storage.
 */
export async function loadQueue(): Promise<QueuedAction[]> {
  if (memoryQueue !== null) {
    return [...memoryQueue];
  }
  try {
    const raw = await EncryptedStorage.getItem(STORAGE_KEY);
    if (raw) {
      memoryQueue = JSON.parse(raw) as QueuedAction[];
    } else {
      memoryQueue = [];
    }
  } catch {
    memoryQueue = [];
  }
  return [...memoryQueue];
}

async function persistQueue(): Promise<void> {
  try {
    if (memoryQueue) {
      await EncryptedStorage.setItem(STORAGE_KEY, JSON.stringify(memoryQueue));
    } else {
      await EncryptedStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore native storage errors in tests
  }
}

/**
 * Adds an action to the offline queue with a guaranteed idempotencyKey and timestamp.
 */
export async function enqueueAction<T = any>(params: {
  bookingId: string;
  type: QueuedActionType;
  payload: T;
  idempotencyKey?: string;
}): Promise<QueuedAction<T>> {
  await loadQueue();
  const idempotencyKey =
    params.idempotencyKey || generateIdempotencyKey(params.type, params.bookingId);
  const item: QueuedAction<T> = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    idempotencyKey,
    bookingId: params.bookingId,
    type: params.type,
    payload: params.payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  memoryQueue = memoryQueue ? [...memoryQueue, item] : [item];
  await persistQueue();
  notifyListeners();
  return item;
}

/**
 * Returns pending items in FIFO order, optionally filtered by bookingId.
 */
export async function getPendingQueue(bookingId?: string): Promise<QueuedAction[]> {
  const queue = await loadQueue();
  if (bookingId) {
    return queue.filter((item) => item.bookingId === bookingId);
  }
  return queue;
}

/**
 * Returns count of pending items in queue.
 */
export async function getPendingQueueCount(bookingId?: string): Promise<number> {
  const queue = await getPendingQueue(bookingId);
  return queue.length;
}

/**
 * Removes an action from the queue by its ID.
 */
export async function dequeueAction(id: string): Promise<void> {
  await loadQueue();
  if (!memoryQueue) return;
  memoryQueue = memoryQueue.filter((item) => item.id !== id);
  await persistQueue();
  notifyListeners();
}

/**
 * Clears queue entirely or for a specific booking.
 */
export async function clearQueue(bookingId?: string): Promise<void> {
  await loadQueue();
  if (!memoryQueue) return;
  if (bookingId) {
    memoryQueue = memoryQueue.filter((item) => item.bookingId !== bookingId);
  } else {
    memoryQueue = [];
  }
  await persistQueue();
  notifyListeners();
}

/**
 * Checks whether device is currently connected to the internet.
 */
export async function isNetworkConnected(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return true; // Default optimistic in case NetInfo is unlinked in test
  }
}

/**
 * Validation helper for Check-out:
 * Check-out requires active internet connection AND an empty offline queue.
 */
export async function validateCheckOutPrerequisites(
  bookingId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const online = await isNetworkConnected();
  if (!online) {
    return {
      allowed: false,
      reason: 'Bắt buộc có kết nối mạng để hoàn tất bàn giao và kết thúc ca trực.',
    };
  }

  const pendingCount = await getPendingQueueCount(bookingId);
  if (pendingCount > 0) {
    return {
      allowed: false,
      reason: `Còn ${pendingCount} mục dữ liệu chưa được gửi lên hệ thống. Vui lòng đợi đồng bộ xong trước khi hoàn tất bàn giao.`,
    };
  }

  return { allowed: true };
}

export type QueueProcessor = (action: QueuedAction) => Promise<boolean>;

/**
 * Processes the queue in strict FIFO order using the provided executor.
 * If an action fails, processing stops to preserve chronological order.
 */
export async function processQueue(
  executor: QueueProcessor,
  bookingId?: string
): Promise<{ processed: number; remaining: number }> {
  if (isProcessing) {
    const queue = await getPendingQueue(bookingId);
    return { processed: 0, remaining: queue.length };
  }

  isProcessing = true;
  let processedCount = 0;

  try {
    await loadQueue();
    if (!memoryQueue || memoryQueue.length === 0) {
      return { processed: 0, remaining: 0 };
    }

    const online = await isNetworkConnected();
    if (!online) {
      return { processed: 0, remaining: memoryQueue.length };
    }

    const itemsToProcess = bookingId
      ? memoryQueue.filter((item) => item.bookingId === bookingId)
      : [...memoryQueue];

    for (const item of itemsToProcess) {
      try {
        const success = await executor(item);
        if (success) {
          // Remove processed item
          memoryQueue = memoryQueue.filter((q) => q.id !== item.id);
          await persistQueue();
          processedCount++;
          notifyListeners();
        } else {
          // Increment retry count and stop processing to preserve FIFO
          item.retryCount += 1;
          await persistQueue();
          notifyListeners();
          break;
        }
      } catch (err: any) {
        item.retryCount += 1;
        item.lastError = err?.message || 'Lỗi không xác định khi đồng bộ';
        await persistQueue();
        notifyListeners();
        break;
      }
    }

    return { processed: processedCount, remaining: memoryQueue.length };
  } finally {
    isProcessing = false;
  }
}

/**
 * Subscribes to queue state changes.
 */
export function subscribeQueue(listener: (queue: QueuedAction[]) => void): () => void {
  listeners.add(listener);
  // Send initial state
  loadQueue().then((q) => listener([...q])).catch(() => {});
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Sets up auto-synchronization when NetInfo detects connectivity restored.
 */
export function setupQueueAutoSync(
  executor: QueueProcessor,
  bookingId?: string
): () => void {
  const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void processQueue(executor, bookingId);
    }
  });

  return () => {
    unsubscribeNetInfo();
  };
}
