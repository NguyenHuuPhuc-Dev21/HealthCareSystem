/**
 * chat — types (BE-2 · Phase 6 · FR-CHAT-01). Message types come from packages/shared (MessageType).
 */
import type { ChatRealtimeMessage, MessageType, OffPlatformReason } from '@healthcare-system/shared';

/** The booking as chat needs it: who talks to whom, and whether the conversation is open. */
export interface ChatBookingRow {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  execution_status: string;
  customer_name: string;
  patient_name: string;
  nurse_name: string | null;
}

export interface MessageRow {
  id: string;
  booking_id: string;
  sender_id: string;
  receiver_id: string;
  message_type: MessageType;
  content: string | null;
  call_duration_sec: number | null;
  is_flagged: boolean;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
  // admin view only
  sender_name?: string;
  flag_reasons?: OffPlatformReason[] | null;
}

export type ChatRole = 'PATIENT' | 'NURSE';

export interface ChatViewer {
  id: string;
  role: string;
}

export interface ChatNotice {
  userId: string;
  bookingId: string;
  type: 'NEW_MESSAGE';
  title: string;
  body: string;
  data: Record<string, string>;
}

/** toUserId: deliver to that participant's sockets only (call signalling); otherwise to everyone watching. */
export type ChatPublish = (bookingId: string, m: ChatRealtimeMessage, toUserId?: string) => void;

/** Object storage as chat needs it (core/storage in production, a fake in tests). */
export interface ChatStorage {
  buildObjectKey(ownerUserId: string, contentType: string): string;
  createUploadUrl(objectKey: string, contentType: string): Promise<{ url: string; expiresInSeconds: number }>;
  createDownloadUrl(objectKey: string): Promise<string>;
  objectKeyBelongsTo(objectKey: string, userId: string): boolean;
  statObject(objectKey: string): Promise<{ sizeBytes: number } | null>;
  readObject(objectKey: string): Promise<Buffer | null>;
  putObject(objectKey: string, body: Buffer, contentType: string): Promise<void>;
}

/** WebRTC ICE servers (infrastructure, from env WEBRTC_ICE_SERVERS — TURN credentials are secrets, not configs). */
export type IceServer = { urls: string | string[]; username?: string; credential?: string };

/** Redis channel of chat events (API processes only). */
export const CHAT_REALTIME_CHANNEL = 'chat:realtime';

/** WebSocket paths (nurse-web chat.api.ts connects to /ws/chat?conversationId=…). */
export const CHAT_WS_PATHS = ['/ws/chat', '/api/v1/ws/chat'];

/** Presigned GET lifetime of a photo in a conversation. */
export const CHAT_IMAGE_URL_SECONDS = 600;

/** Largest serialized CALL_SIGNAL accepted from a socket (an SDP offer is a few KB). */
export const CALL_SIGNAL_MAX_BYTES = 16 * 1024;

/** Newest messages returned by GET conversation. */
export const CHAT_HISTORY_LIMIT = 500;
