import { env } from './env';
import { getAuthToken } from './api-client';

export type RealtimeEventType =
  | 'EXTENSION_REQUESTED'
  | 'SHIFT_CANCELLED'
  | 'CARE_ACTIVITY_UPDATED'
  | 'SOS_ACKNOWLEDGED'
  | 'HEARTBEAT';

export interface RealtimeShiftEvent<T = any> {
  type: RealtimeEventType;
  bookingId: string;
  timestamp: string;
  payload: T;
}

export interface ExtensionRequestPayload {
  extensionId: string;
  hours: number;
  extraAmount: number;
  requestedAt?: string;
}

type EventCallback<T = any> = (payload: T) => void;

class ShiftRealtimeManager {
  private ws: WebSocket | null = null;
  private currentBookingId: string | null = null;
  private isIntentionallyClosed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly subscribers = new Map<string, Set<EventCallback>>();

  public connect(bookingId: string): void {
    if (this.currentBookingId === bookingId && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.disconnect();
    this.currentBookingId = bookingId;
    this.isIntentionallyClosed = false;
    this.reconnectAttempts = 0;
    void this.initWebSocket(bookingId);
  }

  public disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close error
      }
      this.ws = null;
    }
    this.currentBookingId = null;
  }

  private async initWebSocket(bookingId: string): Promise<void> {
    try {
      const token = await getAuthToken();
      const baseWsUrl = env.apiBaseUrl.replace(/^http/, 'ws');
      const wsUrl = `${baseWsUrl}/realtime/shifts/${bookingId}?token=${encodeURIComponent(
        token || ''
      )}`;

      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as RealtimeShiftEvent;
          if (data && data.type) {
            this.emit(data.type, data.payload);
          }
        } catch {
          // Ignore malformed message
        }
      };

      socket.onerror = () => {
        // Handled in onclose
      };

      socket.onclose = () => {
        this.stopHeartbeat();
        if (!this.isIntentionallyClosed && this.currentBookingId) {
          this.scheduleReconnect(this.currentBookingId);
        }
      };
    } catch {
      if (!this.isIntentionallyClosed && this.currentBookingId) {
        this.scheduleReconnect(this.currentBookingId);
      }
    }
  }

  private scheduleReconnect(bookingId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      if (!this.isIntentionallyClosed && this.currentBookingId === bookingId) {
        void this.initWebSocket(bookingId);
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'PING', timestamp: new Date().toISOString() }));
        } catch {
          // Ignore ping send error
        }
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public subscribe<T = any>(eventType: RealtimeEventType, callback: EventCallback<T>): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    const set = this.subscribers.get(eventType)!;
    set.add(callback as EventCallback);

    return () => {
      set.delete(callback as EventCallback);
      if (set.size === 0) {
        this.subscribers.delete(eventType);
      }
    };
  }

  public emit(eventType: RealtimeEventType, payload: any): void {
    const set = this.subscribers.get(eventType);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(payload);
        } catch {
          // Ignore callback error
        }
      });
    }
  }

  /**
   * Helper to simulate incoming realtime events in testing or dev mode without backend.
   */
  public simulateEvent(eventType: RealtimeEventType, payload: any): void {
    this.emit(eventType, payload);
  }
}

export const shiftRealtime = new ShiftRealtimeManager();
