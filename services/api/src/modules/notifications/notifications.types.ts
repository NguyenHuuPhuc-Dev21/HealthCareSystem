/**
 * notifications — types (BE-3 · Phase 6 · FR-NOTIF-01).
 * A Notice is what a business module wants a user to know; core/notifications stores and delivers it
 * (IN_APP + WebSocket, PUSH_FCM, and the 60 s SMS fallback for HIGH priority).
 */
import type { NotificationDto, NotificationPriority } from '@healthcare-system/shared';

export interface Notice {
  userId: string;
  bookingId?: string | null;
  /** Routing key for the apps (NurseNotificationType for nurses; customer types are listed in the README). */
  type: string;
  title: string;
  body: string;
  priority?: NotificationPriority;
  /** Need-to-know routing ids only (bookingId, disputeId, withdrawalId…). Never clinical detail. */
  data?: Record<string, string>;
}

/** What business modules depend on. Absent in unit/integration tests that do not care about notifications. */
export type Notify = (notice: Notice) => Promise<void>;

/** Shape of an older module's notice (booking-expiry, shift-extend…): no type, no priority. */
export interface LegacyNotice {
  userId: string;
  bookingId?: string | null;
  title: string;
  body?: string | null;
}

/** Type stored when a module sends no type. */
export const UNTYPED_NOTIFICATION = 'SYSTEM';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface InboxRow {
  id: string;
  type: string | null;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  data: Record<string, string> | null;
  booking_id: string | null;
  read_at: Date | null;
  is_read: boolean;
  created_at: Date;
  /** created_at in UTC with microseconds (YYYY-MM-DDTHH:MM:SS.ffffffZ) for the keyset cursor. */
  at_text: string;
}

/** NotificationDto with `type` widened to string: customers get types the nurse union does not list. */
export type InboxItemDto = Omit<NotificationDto, 'type'> & { type: string };

export interface InboxPage {
  items: InboxItemDto[];
  nextCursor: string | null;
  totalUnread: number;
}

export interface InboxQuery {
  cursor?: string;
  limit?: number;
  unreadOnly?: boolean;
}

/** Redis pub/sub channel that carries realtime events from any process (API, worker) to the API's sockets. */
export const REALTIME_CHANNEL = 'notifications:realtime';

/** WebSocket paths (nurse-web connects to /ws/notifications through the dev proxy). */
export const WS_PATHS = ['/ws/notifications', '/api/v1/ws/notifications'];

/** Message the apps receive on the socket (nurse-web notifications.api.ts). */
export interface SocketMessage {
  type: 'NEW_NOTIFICATION';
  notification: InboxItemDto;
}
