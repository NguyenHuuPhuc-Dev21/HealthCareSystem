/**
 * chat — in-app chat, photos & calls between the family and the assigned nurse (BE-2 · Phase 6).
 * Traceability: FR-CHAT-01 · RISK-06 · SRS §7 table 13 · NFR (audit) · checklist Phase 6 BE-2.
 *
 *  GET  /bookings/:id/conversation      customer or the assigned nurse; ConversationDto (conversation id = booking id)
 *  POST /bookings/:id/messages          TEXT, or IMAGE { imageKey } — only while the booking is CONFIRMED / IN_PROGRESS
 *                                       (409 CONVERSATION_CLOSED otherwise). Every text is scanned with the shared
 *                                       detector (phone number, external link, off-platform payment): a hit is still
 *                                       delivered (SRS: warn + log, no blocking), stored is_flagged, logged in
 *                                       chat_flags, and the sender gets the warning in the answer.
 *  POST /bookings/:id/messages/image-upload-url   presigned PUT for a photo (jpeg / png / webp, ≤ 10 MB); the photo
 *                                       is re-encoded without metadata (GPS) before it becomes a message
 *  GET  /bookings/:id/call-config       ICE servers + ring timeout for the in-app WebRTC call
 *  WS   CALL_SIGNAL (relaySignal)       RING / ACCEPT / DECLINE / BUSY / OFFER / ANSWER / ICE_CANDIDATE / HANGUP,
 *                                       forwarded to the other participant only
 *  POST /bookings/:id/calls             log an in-app call (VOICE_CALL_LOG, duration) — same open rule
 *  POST /conversations/:id/read         read receipt up to a message
 *  GET  /admin/bookings/:id/conversation   Admin, full evidence view — writes audit_logs VIEW_CHAT_HISTORY
 *  WS   /ws/chat?conversationId=        NEW_MESSAGE / READ / CALL_SIGNAL events
 *
 * Real phone numbers are never read nor returned (counterpartPhoneMasked is always '•••• ••• •••'); messages carry
 * only the sender ROLE; calls are peer-to-peer WebRTC set up through our socket, so no number is dialled. Nothing is
 * ever deleted or edited (DB trigger, migration 0026): history is dispute evidence.
 */
import {
  AuditAction,
  MessageType,
  type AdminConversationDto,
  type CallConfigDto,
  type ChatImageUploadUrl,
  type ChatMessageDto,
  type ConversationDto,
  type SendMessageResult,
} from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { getConfigNumber } from '../../core/config';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, notFound } from '../../core/errors';
import * as storage from '../../core/storage';
import { notifyUser } from '../notifications/notifications.service';
import { CHAT_IMAGE_TYPES, ChatImageUnreadableError, sanitizeChatImage } from './chat.image';
import {
  IMAGE_TEXT,
  counterpartOf,
  isChatOpen,
  parseIceServers,
  participantRole,
  scanMessage,
  signalNeedsOpenChat,
  toConversationDto,
  toMessageDto,
} from './chat.policy';
import { ChatPublisher, chatHub } from './chat.realtime';
import * as repo from './chat.repo';
import { callSignalSchema, type CallSignalBody } from './chat.schema';
import {
  CALL_SIGNAL_MAX_BYTES,
  CHAT_HISTORY_LIMIT,
  CHAT_IMAGE_URL_SECONDS,
  type ChatBookingRow,
  type ChatNotice,
  type ChatPublish,
  type ChatRole,
  type ChatStorage,
  type ChatViewer,
  type IceServer,
  type MessageRow,
} from './chat.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFoundConversation = () => notFound('CONVERSATION_NOT_FOUND', 'Conversation not found');

export interface ChatDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  publish?: ChatPublish;
  /** Push / in-app notice to the receiver when she/he is not looking at the conversation. */
  notify?: (n: ChatNotice) => Promise<void>;
  /** Is the receiver connected to this conversation's socket? (then no push) */
  isWatching?: (bookingId: string, userId: string) => boolean;
  /** Photos (presigned PUT / GET, re-encode). Without it IMAGE messages answer 503. */
  storage?: ChatStorage;
  /** Re-encodes a photo without metadata (sharp in production). */
  sanitizeImage?: (image: Buffer) => Promise<Buffer>;
  getNumber?: (key: 'CHAT_CALL_RING_TIMEOUT_SECONDS') => Promise<number>;
  iceServers?: () => IceServer[];
  now?: () => number;
}

export class ChatService {
  constructor(private readonly deps: ChatDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** The booking and the viewer's side; 404 for non-participants (no existence leak). */
  private async participant(db: Queryable, viewer: ChatViewer, bookingId: string, lock = false): Promise<{ b: ChatBookingRow; role: ChatRole }> {
    if (!UUID_RE.test(bookingId)) throw notFoundConversation();
    const b = lock ? await repo.shareLockBooking(db, bookingId) : await repo.findBooking(db, bookingId);
    const role = b ? participantRole(b, viewer) : null;
    if (!b || !role) throw notFoundConversation();
    return { b, role };
  }

  private assertOpen(b: ChatBookingRow): void {
    if (!isChatOpen(b.execution_status)) {
      throw new AppError(409, 'CONVERSATION_CLOSED', 'Chat is open only while the shift is confirmed or running', {
        executionStatus: b.execution_status,
      });
    }
  }

  /** GET /bookings/:id/conversation */
  async getConversation(viewer: ChatViewer, bookingId: string): Promise<ConversationDto> {
    const { b, role } = await this.participant(this.deps.read, viewer, bookingId);
    const rows = await repo.listMessages(this.deps.read, b.id, CHAT_HISTORY_LIMIT);
    const dto = toConversationDto(b, role, rows);
    return { ...dto, messages: await this.withImageUrls(dto.messages, rows) };
  }

  /** Adds a short-lived presigned GET to every IMAGE message (the object key itself is never returned). */
  private async withImageUrls<T extends ChatMessageDto>(dtos: T[], rows: MessageRow[]): Promise<T[]> {
    const keys = new Map(rows.filter((r) => r.message_type === MessageType.IMAGE && r.content).map((r) => [r.id, r.content!]));
    if (keys.size === 0) return dtos;
    return Promise.all(
      dtos.map(async (d) => {
        const key = keys.get(d.id);
        if (!key || !this.deps.storage) return d;
        try {
          return { ...d, imageUrl: await this.deps.storage.createDownloadUrl(key) };
        } catch (err) {
          console.warn(`[chat] image url for ${d.id} failed: ${(err as Error).message}`);
          return d;
        }
      }),
    );
  }

  private requireStorage(): ChatStorage {
    if (!this.deps.storage) throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Photo storage is not configured');
    return this.deps.storage;
  }

  /** POST /bookings/:id/messages/image-upload-url */
  async requestImageUploadUrl(viewer: ChatViewer, bookingId: string, contentType: string): Promise<ChatImageUploadUrl> {
    const { b } = await this.participant(this.deps.read, viewer, bookingId);
    this.assertOpen(b);
    if (!CHAT_IMAGE_TYPES.includes(contentType)) {
      throw new AppError(400, 'CONTENT_TYPE_NOT_ALLOWED', `Photos accept ${CHAT_IMAGE_TYPES.join(', ')}`);
    }
    const st = this.requireStorage();
    const objectKey = st.buildObjectKey(viewer.id, contentType);
    const url = await st.createUploadUrl(objectKey, contentType);
    return { objectKey, uploadUrl: url.url, expiresInSeconds: url.expiresInSeconds, contentType };
  }

  /**
   * Checks the uploaded photo (own upload, exists, ≤ 10 MB, decodable) and stores a re-encoded copy without
   * metadata. Returns the clean key. Runs before the transaction (object storage is slow).
   */
  private async cleanImage(senderId: string, rawKey: string): Promise<string> {
    const st = this.requireStorage();
    if (!rawKey.startsWith('chat-image/') || !st.objectKeyBelongsTo(rawKey, senderId)) {
      throw new AppError(400, 'IMAGE_KEY_INVALID', 'imageKey must come from image-upload-url for this account');
    }
    const info = await st.statObject(rawKey);
    if (!info) throw new AppError(400, 'IMAGE_NOT_UPLOADED', 'The photo has not been uploaded yet');
    if (info.sizeBytes > storage.MAX_UPLOAD_BYTES) throw new AppError(400, 'IMAGE_TOO_LARGE', 'A photo is at most 10 MB');
    const raw = await st.readObject(rawKey);
    if (!raw) throw new AppError(400, 'IMAGE_NOT_UPLOADED', 'The photo has not been uploaded yet');
    let clean: Buffer;
    try {
      clean = await (this.deps.sanitizeImage ?? sanitizeChatImage)(raw);
    } catch (err) {
      if (err instanceof ChatImageUnreadableError) throw new AppError(400, 'IMAGE_UNREADABLE', 'The file is not a readable photo');
      throw err;
    }
    const cleanKey = st.buildObjectKey(senderId, 'image/jpeg');
    await st.putObject(cleanKey, clean, 'image/jpeg');
    return cleanKey;
  }

  /** POST /bookings/:id/messages { type: 'IMAGE', imageKey } */
  async sendImage(viewer: ChatViewer, bookingId: string, imageKey: string): Promise<SendMessageResult> {
    // cheap checks first so a closed chat / stranger never triggers storage work
    const { b: pre } = await this.participant(this.deps.read, viewer, bookingId);
    this.assertOpen(pre);
    const cleanKey = await this.cleanImage(viewer.id, imageKey);
    const at = new Date(this.nowMs());
    const out = await this.deps.withTx(async (db) => {
      const { b, role } = await this.participant(db, viewer, bookingId, true);
      this.assertOpen(b);
      const receiver = counterpartOf(b, role).id!;
      const m = await repo.insertMessage(db, {
        bookingId: b.id,
        senderId: viewer.id,
        receiverId: receiver,
        type: MessageType.IMAGE,
        content: cleanKey,
        callSec: null,
        flagged: false,
        at,
      });
      return { b, role, m, receiver };
    });
    const [dto] = await this.withImageUrls([toMessageDto(out.m, out.b)], [out.m]);
    await this.deliver(out.b, out.role, out.receiver, dto, IMAGE_TEXT);
    return { ...dto, warning: null };
  }

  /** GET /bookings/:id/call-config */
  async callConfig(viewer: ChatViewer, bookingId: string): Promise<CallConfigDto> {
    const { b } = await this.participant(this.deps.read, viewer, bookingId);
    this.assertOpen(b);
    const ringTimeoutSec = await (this.deps.getNumber ?? getConfigNumber)('CHAT_CALL_RING_TIMEOUT_SECONDS');
    return { iceServers: (this.deps.iceServers ?? (() => parseIceServers(process.env.WEBRTC_ICE_SERVERS)))(), ringTimeoutSec };
  }

  /** Entry point for /ws/chat client messages: validates, relays; only AppErrors reach the socket. */
  async handleSocketSignal(user: ChatViewer, bookingId: string, raw: unknown): Promise<void> {
    const parsed = callSignalSchema.safeParse(raw);
    if (!parsed.success) throw new AppError(400, 'BAD_SIGNAL', 'Invalid CALL_SIGNAL');
    try {
      await this.relaySignal(user, bookingId, parsed.data);
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.warn(`[chat] call signal on ${bookingId} failed: ${(err as Error).message}`);
      throw new AppError(500, 'SIGNAL_FAILED', 'Call signal failed');
    }
  }

  /**
   * WS CALL_SIGNAL from a participant → the other participant's sockets only (never Admin watchers, never the
   * sender). The server only relays: no phone number, no SDP is stored. The call log itself is POST /calls.
   */
  async relaySignal(viewer: ChatViewer, bookingId: string, signal: CallSignalBody): Promise<void> {
    if (signal.payload !== undefined && Buffer.byteLength(JSON.stringify(signal.payload)) > CALL_SIGNAL_MAX_BYTES) {
      throw new AppError(400, 'SIGNAL_TOO_LARGE', 'Call signal payload is too large');
    }
    const { b, role } = await this.participant(this.deps.read, viewer, bookingId);
    if (signalNeedsOpenChat(signal.kind)) this.assertOpen(b);
    const to = counterpartOf(b, role).id;
    if (!to) throw notFoundConversation();
    this.safePublish(
      b.id,
      {
        type: 'CALL_SIGNAL',
        conversationId: b.id,
        callId: signal.callId,
        kind: signal.kind,
        fromRole: role,
        ...(signal.payload !== undefined ? { payload: signal.payload } : {}),
        at: new Date(this.nowMs()).toISOString(),
      },
      to,
    );
  }

  /** POST /bookings/:id/messages */
  async send(viewer: ChatViewer, bookingId: string, content: string): Promise<SendMessageResult> {
    const scan = scanMessage(content);
    const at = new Date(this.nowMs());
    const out = await this.deps.withTx(async (db) => {
      const { b, role } = await this.participant(db, viewer, bookingId, true);
      this.assertOpen(b);
      const receiver = counterpartOf(b, role).id!;
      const m = await repo.insertMessage(db, {
        bookingId: b.id,
        senderId: viewer.id,
        receiverId: receiver,
        type: MessageType.TEXT,
        content,
        callSec: null,
        flagged: scan.flagged,
        at,
      });
      if (scan.flagged) {
        await repo.insertFlag(db, { messageId: m.id, bookingId: b.id, senderId: viewer.id, reasons: scan.reasons, matches: scan.matches, at });
      }
      return { b, role, m, receiver };
    });
    const dto = toMessageDto(out.m, out.b);
    if (scan.flagged) {
      console.warn(`[chat] flagged message ${out.m.id} on booking ${out.b.booking_code}: ${scan.reasons.join(', ')}`);
    }
    await this.deliver(out.b, out.role, out.receiver, dto, content);
    return { ...dto, warning: scan.flagged ? { reasons: scan.reasons, message: scan.warning! } : null };
  }

  /** POST /bookings/:id/calls — the in-app call itself is masked by the calling provider; we keep the log. */
  async logCall(viewer: ChatViewer, bookingId: string, call: { durationSec: number; outcome: 'COMPLETED' | 'MISSED' | 'DECLINED' }): Promise<ChatMessageDto> {
    const at = new Date(this.nowMs());
    const out = await this.deps.withTx(async (db) => {
      const { b, role } = await this.participant(db, viewer, bookingId, true);
      this.assertOpen(b);
      const receiver = counterpartOf(b, role).id!;
      const m = await repo.insertMessage(db, {
        bookingId: b.id,
        senderId: viewer.id,
        receiverId: receiver,
        type: MessageType.VOICE_CALL_LOG,
        content: call.outcome,
        callSec: call.outcome === 'COMPLETED' ? call.durationSec : 0,
        flagged: false,
        at,
      });
      return { b, role, m, receiver };
    });
    const dto = toMessageDto(out.m, out.b);
    await this.deliver(out.b, out.role, out.receiver, dto, dto.content);
    return dto;
  }

  /** POST /conversations/:id/read — conversation id = booking id. */
  async markRead(viewer: ChatViewer, conversationId: string, lastMessageId: string): Promise<{ success: true }> {
    const at = new Date(this.nowMs());
    const out = await this.deps.withTx(async (db) => {
      const { b, role } = await this.participant(db, viewer, conversationId);
      const upTo = await repo.markRead(db, b.id, viewer.id, lastMessageId, at);
      if (!upTo) throw notFound('MESSAGE_NOT_FOUND', 'Message not found in this conversation');
      return { b, role, upTo };
    });
    this.safePublish(out.b.id, { type: 'READ', conversationId: out.b.id, readerRole: out.role, upTo: new Date(out.upTo).toISOString() });
    return { success: true };
  }

  /** GET /admin/bookings/:id/conversation — every message with flags; the read itself is audit-logged. */
  async adminConversation(adminId: string, bookingId: string, ip?: string): Promise<AdminConversationDto> {
    if (!UUID_RE.test(bookingId)) throw notFound('BOOKING_NOT_FOUND', 'Booking not found');
    return this.deps.withTx(async (db) => {
      const b = await repo.findBooking(db, bookingId);
      if (!b) throw notFound('BOOKING_NOT_FOUND', 'Booking not found');
      const rows = await repo.listAllMessagesWithFlags(db, b.id);
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.VIEW_CHAT_HISTORY,
        targetTable: 'conversations_messages',
        targetId: b.id,
        newValue: { bookingId: b.id, bookingCode: b.booking_code, messages: rows.length },
        ...(ip ? { ipAddress: ip.slice(0, 45) } : {}),
      });
      const base = rows.map((m) => ({
        ...toMessageDto(m, b),
        senderName: m.sender_name ?? '',
        receiverRole: (m.receiver_id === b.customer_id ? 'PATIENT' : 'NURSE') as 'PATIENT' | 'NURSE',
        callDurationSec: m.call_duration_sec,
        flagReasons: m.flag_reasons ?? [],
      }));
      const messages = await this.withImageUrls(base, rows);
      return {
        bookingId: b.id,
        bookingCode: b.booking_code,
        executionStatus: b.execution_status,
        customerName: b.customer_name,
        nurseName: b.nurse_name,
        messages,
        flaggedCount: messages.filter((m) => m.flagged).length,
      };
    });
  }

  private safePublish(bookingId: string, m: Parameters<ChatPublish>[1], toUserId?: string): void {
    try {
      this.deps.publish?.(bookingId, m, toUserId);
    } catch (err) {
      console.warn(`[chat] publish failed: ${(err as Error).message}`);
    }
  }

  /** After COMMIT: socket event, then a notification if the receiver is not in the conversation. */
  private async deliver(b: ChatBookingRow, role: ChatRole, receiverId: string, dto: ChatMessageDto, preview: string): Promise<void> {
    this.safePublish(b.id, { type: 'NEW_MESSAGE', message: dto });
    if (!this.deps.notify || this.deps.isWatching?.(b.id, receiverId)) return;
    try {
      await this.deps.notify({
        userId: receiverId,
        bookingId: b.id,
        type: 'NEW_MESSAGE',
        title: role === 'PATIENT' ? `Tin nhắn từ gia đình · ${b.booking_code}` : `Tin nhắn từ điều dưỡng · ${b.booking_code}`,
        body: preview.length > 120 ? `${preview.slice(0, 119)}…` : preview,
        data: { bookingId: b.id, bookingCode: b.booking_code, conversationId: b.id },
      });
    } catch (err) {
      console.warn(`[chat] notification for ${b.id} failed: ${(err as Error).message}`);
    }
  }
}

let singleton: ChatService | null = null;
let publisher: ChatPublisher | null = null;

export function getChatService(): ChatService {
  if (!singleton) {
    publisher = publisher ?? new ChatPublisher();
    singleton = new ChatService({
      read: getPool(),
      withTx: (fn) => withTransaction(fn),
      publish: publisher.publish,
      notify: (n) => notifyUser({ userId: n.userId, bookingId: n.bookingId, type: n.type, title: n.title, body: n.body, data: n.data }),
      isWatching: (bookingId, userId) => chatHub.isWatching(bookingId, userId),
      storage: {
        buildObjectKey: (owner, type) => storage.buildObjectKey('chat-image', owner, type),
        createUploadUrl: (key, type) => storage.createUploadUrl(key, type),
        createDownloadUrl: async (key) => (await storage.createDownloadUrl(key, CHAT_IMAGE_URL_SECONDS)).url,
        objectKeyBelongsTo: storage.objectKeyBelongsTo,
        statObject: storage.statObject,
        readObject: storage.readObject,
        putObject: storage.putObject,
      },
      getNumber: getConfigNumber,
    });
  }
  return singleton;
}
