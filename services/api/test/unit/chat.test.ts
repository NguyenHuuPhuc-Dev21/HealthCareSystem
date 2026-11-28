import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { WebSocket } from 'ws';
import { MASKED_PHONE, isChatOpen, parseIceServers, participantRole, scanMessage, signalNeedsOpenChat, toConversationDto, toMessageDto } from '../../src/modules/chat/chat.policy';
import { ChatImageUnreadableError, sanitizeChatImage } from '../../src/modules/chat/chat.image';
import { ChatHub, ChatPublisher, attachChatSocket } from '../../src/modules/chat/chat.realtime';
import { callLogSchema, callSignalSchema, sendMessageSchema } from '../../src/modules/chat/chat.schema';

const B = {
  id: '11111111-2222-4333-8444-555555555555',
  booking_code: 'HC-261125-ABC123',
  customer_id: 'c1',
  nurse_id: 'n1',
  execution_status: 'CONFIRMED',
  customer_name: 'Trần Thị Mai',
  patient_name: 'Lê Văn Bảy',
  nurse_name: 'Nguyễn Thị Hoa',
};

describe('chat policy (FR-CHAT-01)', () => {
  it('open only while CONFIRMED / IN_PROGRESS', () => {
    expect(['DRAFT', 'MATCHING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'].filter(isChatOpen)).toEqual([
      'CONFIRMED',
      'IN_PROGRESS',
    ]);
  });

  it('participants: the customer and the CURRENT nurse only, each with the right role', () => {
    expect(participantRole(B, { id: 'c1', role: 'PATIENT' })).toBe('PATIENT');
    expect(participantRole(B, { id: 'n1', role: 'NURSE' })).toBe('NURSE');
    expect(participantRole(B, { id: 'n2', role: 'NURSE' })).toBe(null);
    expect(participantRole(B, { id: 'c1', role: 'NURSE' })).toBe(null); // role must match the side
    expect(participantRole({ ...B, nurse_id: null }, { id: 'n1', role: 'NURSE' })).toBe(null);
  });

  it('scan: phone numbers (also spaced), links, off-platform payment; clean text passes', () => {
    expect(scanMessage('Mai 8h em tới nhé').flagged).toBe(false);
    expect(scanMessage('gọi 0905123456').reasons).toEqual(['PHONE_NUMBER']);
    expect(scanMessage('số em 0 9 0 5 1 2 3 4 5 6').reasons).toEqual(['PHONE_NUMBER']);
    expect(scanMessage('add zalo.me/abc').reasons).toEqual(['EXTERNAL_LINK']);
    expect(scanMessage('chị chuyển khoản riêng cho em').reasons).toEqual(['OFF_PLATFORM_PAYMENT']);
    expect(scanMessage('gọi 0905123456').warning).toContain('số điện thoại cá nhân');
  });

  it('DTOs: roles instead of user ids, a status line first, the phone fully masked', () => {
    const row = {
      id: 'm1',
      booking_id: B.id,
      sender_id: 'n1',
      receiver_id: 'c1',
      message_type: 'VOICE_CALL_LOG' as any,
      content: 'COMPLETED',
      call_duration_sec: 61,
      is_flagged: false,
      is_read: false,
      read_at: null,
      created_at: new Date('2026-11-25T02:00:00Z'),
    };
    expect(toMessageDto(row, B)).toMatchObject({ senderRole: 'NURSE', content: 'Cuộc gọi trong ứng dụng · 1 phút 1 giây', conversationId: B.id });
    const conv = toConversationDto(B, 'NURSE', [row]);
    expect(conv).toMatchObject({ id: B.id, counterpartName: 'Trần Thị Mai', counterpartPhoneMasked: MASKED_PHONE, isOpen: true });
    expect(MASKED_PHONE).not.toMatch(/\d/);
    expect(conv.messages.map((m) => m.senderRole)).toEqual(['SYSTEM', 'NURSE']);
    expect(toConversationDto({ ...B, execution_status: 'COMPLETED' }, 'PATIENT', []).messages[0].content).toContain('Ca đã kết thúc');
  });

  it('IMAGE dto: placeholder text, never the object key; ICE servers parsed defensively; which signals need an open chat', () => {
    const img = { id: 'm2', booking_id: B.id, sender_id: 'c1', receiver_id: 'n1', message_type: 'IMAGE' as any, content: 'chat-image/c1/k.jpg',
      call_duration_sec: null, is_flagged: false, is_read: false, read_at: null, created_at: new Date('2026-11-25T02:00:00Z') };
    expect(toMessageDto(img, B)).toMatchObject({ type: 'IMAGE', content: '📷 Hình ảnh', imageUrl: null });
    expect(JSON.stringify(toMessageDto(img, B))).not.toContain('chat-image/');
    expect(parseIceServers(undefined)).toEqual([]);
    expect(parseIceServers('not json')).toEqual([]);
    expect(parseIceServers('[{"urls":"stun:a"},{"urls":["turn:b"],"username":"u","credential":"p"},{"x":1},null]')).toEqual([
      { urls: 'stun:a' },
      { urls: ['turn:b'], username: 'u', credential: 'p' },
    ]);
    expect(['RING', 'ACCEPT', 'OFFER', 'ANSWER', 'ICE_CANDIDATE', 'HANGUP', 'DECLINE', 'BUSY'].filter(signalNeedsOpenChat)).toEqual([
      'RING', 'ACCEPT', 'OFFER', 'ANSWER', 'ICE_CANDIDATE',
    ]);
  });

  it('photo re-encoding drops EXIF / GPS and rejects non-images', async () => {
    const sharp = (await import('sharp')).default;
    const withGps = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#c33' } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Make: 'PhoneCo', Model: 'X1' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '10/1 46/1 0/1' } } })
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();
    const clean = await sanitizeChatImage(withGps);
    const meta = await sharp(clean).metadata();
    expect([meta.format, meta.width, meta.height, meta.exif]).toEqual(['jpeg', 40, 30, undefined]);
    await expect(sanitizeChatImage(Buffer.from('<html>'))).rejects.toBeInstanceOf(ChatImageUnreadableError);
  });

  it('schemas: text 1–2000 characters or an IMAGE key; call duration ≤ 24h; call signals', () => {
    expect(sendMessageSchema.safeParse({ type: 'IMAGE', imageKey: 'chat-image/a/b.jpg' }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ type: 'IMAGE' }).success).toBe(false);
    const callId = '7d4b7a52-6f3a-4c1e-9f0e-1b2c3d4e5f60';
    expect(callSignalSchema.safeParse({ type: 'CALL_SIGNAL', callId, kind: 'OFFER', payload: { sdp: 'v=0' } }).success).toBe(true);
    expect(callSignalSchema.safeParse({ type: 'CALL_SIGNAL', callId, kind: 'DIAL', payload: '0905123456' }).success).toBe(false);
    expect(callSignalSchema.safeParse({ type: 'CALL_SIGNAL', callId, kind: 'RING', phone: '0905123456' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ content: 'ok' }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ content: '   ' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ content: 'x'.repeat(2001) }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ content: 'ok', type: 'IMAGE' }).success).toBe(false);
    expect(callLogSchema.safeParse({ durationSec: 30, outcome: 'COMPLETED' }).success).toBe(true);
    expect(callLogSchema.safeParse({ durationSec: -1, outcome: 'COMPLETED' }).success).toBe(false);
  });
});

describe('WebSocket /ws/chat', () => {
  let server: Server;
  let port: number;
  const hub = new ChatHub();
  const users: Record<string, { id: string; role: any }> = {
    'tok-c': { id: 'c1', role: 'PATIENT' },
    'tok-n': { id: 'n1', role: 'NURSE' },
    'tok-a': { id: 'a1', role: 'ADMIN' },
    'tok-x': { id: 'x', role: 'PATIENT' },
  };
  let socket: { close(): Promise<void> };

  beforeAll(async () => {
    server = createServer();
    const publisher = new ChatPublisher(hub, null);
    socket = attachChatSocket(server, {
      verify: async (t) => users[t] ?? null,
      canWatch: async (id, u) => id === B.id && ['c1', 'n1', 'a1'].includes(u.id),
      // stands in for ChatService.handleSocketSignal: participants only, to the other side
      onSignal: async (id, u, raw: any) => {
        if (u.id === 'a1') throw Object.assign(new Error('Conversation not found'), { code: 'CONVERSATION_NOT_FOUND' });
        publisher.publish(id, { type: 'CALL_SIGNAL', conversationId: id, callId: raw.callId, kind: raw.kind, fromRole: u.role, at: 'now' }, u.id === 'c1' ? 'n1' : 'c1');
      },
      hub,
    });
    await new Promise<void>((r) => server.listen(0, r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(async () => {
    await socket.close();
    await new Promise<void>((r) => server.close(() => r()));
  });

  const connect = (q: string) =>
    new Promise<{ ws?: WebSocket; status?: number }>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/chat?${q}`);
      ws.on('open', () => resolve({ ws }));
      ws.on('unexpected-response', (_r: unknown, res: { statusCode: number }) => resolve({ status: res.statusCode }));
      ws.on('error', () => undefined);
    });

  it('401 without token, 403 for someone else, 400 for a bad id', async () => {
    expect((await connect(`conversationId=${B.id}`)).status).toBe(401);
    expect((await connect(`conversationId=${B.id}&access_token=tok-x`)).status).toBe(403);
    expect((await connect(`conversationId=bad&access_token=tok-c`)).status).toBe(400);
  });

  it('delivers NEW_MESSAGE to the participant; isWatching knows who is in the conversation', async () => {
    const { ws } = await connect(`conversationId=${B.id}&access_token=tok-c`);
    expect(hub.isWatching(B.id, 'c1')).toBe(true);
    expect(hub.isWatching(B.id, 'n1')).toBe(false);
    const got = new Promise<any>((resolve) => ws!.on('message', (m: Buffer) => resolve(JSON.parse(m.toString()))));
    new ChatPublisher(hub, null).publish(B.id, { type: 'NEW_MESSAGE', message: { id: 'm', conversationId: B.id, senderRole: 'NURSE', type: 'TEXT' as any, content: 'hi', createdAt: 'x' } });
    expect(await got).toMatchObject({ type: 'NEW_MESSAGE', message: { content: 'hi' } });
    ws!.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(hub.isWatching(B.id, 'c1')).toBe(false);
  });

  it('CALL_SIGNAL goes to the other participant only (not the sender, not an Admin watcher); other client messages are refused', async () => {
    const c = (await connect(`conversationId=${B.id}&access_token=tok-c`)).ws!;
    const n = (await connect(`conversationId=${B.id}&access_token=tok-n`)).ws!;
    const a = (await connect(`conversationId=${B.id}&access_token=tok-a`)).ws!;
    const inbox = { c: [] as any[], n: [] as any[], a: [] as any[] };
    c.on('message', (m: Buffer) => inbox.c.push(JSON.parse(m.toString())));
    n.on('message', (m: Buffer) => inbox.n.push(JSON.parse(m.toString())));
    a.on('message', (m: Buffer) => inbox.a.push(JSON.parse(m.toString())));
    const callId = '7d4b7a52-6f3a-4c1e-9f0e-1b2c3d4e5f60';
    c.send(JSON.stringify({ type: 'CALL_SIGNAL', callId, kind: 'RING' }));
    c.send(JSON.stringify({ type: 'NEW_MESSAGE', content: 'sneaky' }));
    c.send('not json');
    a.send(JSON.stringify({ type: 'CALL_SIGNAL', callId, kind: 'RING' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(inbox.n).toEqual([expect.objectContaining({ type: 'CALL_SIGNAL', kind: 'RING', fromRole: 'PATIENT', callId })]);
    expect(inbox.c.map((m) => [m.type, m.code])).toEqual([
      ['CALL_ERROR', 'NOT_SUPPORTED'],
      ['CALL_ERROR', 'BAD_MESSAGE'],
    ]);
    expect(inbox.a).toEqual([expect.objectContaining({ type: 'CALL_ERROR', code: 'CONVERSATION_NOT_FOUND', callId })]);
    for (const ws of [c, n, a]) ws.close();
    await new Promise((r) => setTimeout(r, 50));
  });
});
