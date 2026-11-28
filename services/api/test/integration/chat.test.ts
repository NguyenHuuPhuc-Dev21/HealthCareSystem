import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { closePool, runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { ChatService } from '../../src/modules/chat/chat.service';
import type { ChatNotice, ChatStorage } from '../../src/modules/chat/chat.types';
import { createTestPool } from './helpers';

/**
 * Phase 6 (BE-2) trên PostgreSQL 16 thật (migration 0026): chat & log cuộc gọi trong ứng dụng (FR-CHAT-01, RISK-06).
 *  - chỉ mở khi đơn CONFIRMED / IN_PROGRESS; trước đó và sau khi kết thúc ca thì khóa (409 CONVERSATION_CLOSED)
 *  - số điện thoại thật không bao giờ xuất hiện trong response (chỉ "•••• ••• •••", không một chữ số)
 *  - ảnh: tải qua presigned PUT, server mã hóa lại (bỏ EXIF/GPS), chỉ trả URL tạm; gọi điện: WebRTC, tín hiệu chỉ
 *    chuyển cho người kia trong ca, không ai thấy số điện thoại
 *  - tin có số điện thoại / link / gợi ý chuyển khoản riêng: vẫn gửi, gắn cờ, cảnh báo người gửi, ghi chat_flags
 *  - lịch sử không xóa, không sửa (trigger); Admin xem phải ghi audit_logs VIEW_CHAT_HISTORY
 */
describe('chat (integration)', () => {
  let pool: Pool;
  let chat: ChatService;
  const notices: ChatNotice[] = [];
  const events: { bookingId: string; m: any; to?: string }[] = [];
  const objects = new Map<string, Buffer>();
  let keySeq = 0;
  const storage: ChatStorage = {
    buildObjectKey: (owner, type) =>
      `chat-image/${owner}/00000000-0000-4000-8000-${String(++keySeq).padStart(12, '0')}.${type === 'image/png' ? 'png' : 'jpg'}`,
    createUploadUrl: async (key) => ({ url: `https://s3.test/put/${key}`, expiresInSeconds: 900 }),
    createDownloadUrl: async (key) => `https://s3.test/get/${key}?sig=1`,
    objectKeyBelongsTo: (key, userId) => key.split('/')[1] === userId,
    statObject: async (key) => (objects.has(key) ? { sizeBytes: objects.get(key)!.length } : null),
    readObject: async (key) => objects.get(key) ?? null,
    putObject: async (key, body) => {
      objects.set(key, body);
    },
  };
  const watching = new Set<string>();
  let clock = Date.parse('2026-11-25T02:00:00Z');

  let seq = 0;
  const RUN = Math.random().toString(36).slice(2, 5).toUpperCase().padEnd(3, 'X');
  const phone = () => `09${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;

  async function user(role: 'PATIENT' | 'NURSE' | 'ADMIN', name: string) {
    const p = phone();
    const { rows } = await pool.query(`INSERT INTO users (phone, full_name, role, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`, [p, name, role]);
    return { id: rows[0].id as string, role, phone: p };
  }

  async function booking(status: string, withNurse = true) {
    const customer = await user('PATIENT', 'Trần Thị Mai');
    const nurse = await user('NURSE', 'Nguyễn Thị Hoa');
    const profile = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Lê Văn Bảy', '1948-03-20', 58, 'NORMAL', '12 Lê Lợi', 'HOME', 10.77, 106.70, TRUE, now()) RETURNING id`,
      [customer.id],
    );
    seq += 1;
    const code = `HC-261125-${RUN}${String(seq).padStart(3, '0')}`;
    const { rows } = await pool.query(
      `INSERT INTO bookings (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
                             start_time, end_time, base_amount, total_amount, execution_status)
       SELECT $1, $2, $3, $4, id, 'JOB_BOARD', 'CASH', now() + interval '1 day', now() + interval '1 day 4 hours', 400000, 400000,
              $5::execution_status_enum
         FROM service_categories WHERE code = 'SRV_SHIFT_4H' RETURNING id`,
      [code, customer.id, profile.rows[0].id, withNurse ? nurse.id : null, status],
    );
    return { id: rows[0].id as string, code, customer, nurse };
  }

  const setStatus = (id: string, s: string) => pool.query(`UPDATE bookings SET execution_status = $2::execution_status_enum WHERE id = $1`, [id, s]);

  async function rejectsWith(p: Promise<unknown>, status: number, code: string) {
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect([(err as AppError).status, (err as AppError).code]).toEqual([status, code]);
  }

  beforeAll(() => {
    pool = createTestPool();
    chat = new ChatService({
      read: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      publish: (bookingId, m, to) => {
        events.push({ bookingId, m, to });
      },
      notify: async (n) => {
        notices.push(n);
      },
      isWatching: (bookingId, userId) => watching.has(`${bookingId}:${userId}`),
      storage,
      sanitizeImage: async (img) => {
        if (img.subarray(0, 4).toString() !== 'IMG:') throw new (await import('../../src/modules/chat/chat.image')).ChatImageUnreadableError('bad');
        return Buffer.from(`CLEAN:${img.subarray(4).toString()}`);
      },
      getNumber: async (key) => Number((await pool.query(`SELECT config_value FROM system_configs WHERE config_key = $1`, [key])).rows[0].config_value),
      iceServers: () => [{ urls: 'stun:stun.test:3478' }],
      now: () => (clock += 1000),
    });
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('closed before CONFIRMED: readable by the customer, no sending; a nurse who is not assigned sees nothing', async () => {
    const b = await booking('MATCHING', false);
    const conv = await chat.getConversation(b.customer, b.id);
    expect(conv.isOpen).toBe(false);
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]).toMatchObject({ senderRole: 'SYSTEM', type: 'SYSTEM_ALERT' });
    expect(conv.messages[0].content).toContain('chưa được xác nhận');
    await rejectsWith(chat.send(b.customer, b.id, 'Chào chị'), 409, 'CONVERSATION_CLOSED');
    await rejectsWith(chat.getConversation(b.nurse, b.id), 404, 'CONVERSATION_NOT_FOUND');
  });

  it('CONFIRMED: both sides chat; names shown, real phone numbers never returned', async () => {
    const b = await booking('CONFIRMED');
    const sent = await chat.send(b.customer, b.id, 'Chào điều dưỡng, mai 8h nhà tôi có người mở cửa.');
    expect(sent).toMatchObject({ conversationId: b.id, senderRole: 'PATIENT', type: 'TEXT', flagged: false, warning: null });
    const reply = await chat.send(b.nurse, b.id, 'Dạ em sẽ đến đúng giờ ạ.');
    expect(reply.senderRole).toBe('NURSE');

    const forNurse = await chat.getConversation(b.nurse, b.id);
    expect(forNurse).toMatchObject({ id: b.id, bookingCode: b.code, counterpartName: 'Trần Thị Mai', isOpen: true });
    expect(forNurse.counterpartPhoneMasked).toBe('•••• ••• •••'); // SRS: fully masked, no digit
    expect(forNurse.messages.map((m) => m.senderRole)).toEqual(['SYSTEM', 'PATIENT', 'NURSE']);
    const forCustomer = await chat.getConversation(b.customer, b.id);
    expect(forCustomer.counterpartName).toBe('Nguyễn Thị Hoa');
    for (const dto of [forNurse, forCustomer, sent, reply]) {
      const json = JSON.stringify(dto);
      expect(json.includes(b.customer.phone)).toBe(false);
      expect(json.includes(b.nurse.phone)).toBe(false);
      expect(json.includes(b.customer.id) || json.includes(b.nurse.id)).toBe(false); // roles only, no user ids
    }
    const stored = await pool.query(`SELECT sender_id, receiver_id FROM conversations_messages WHERE booking_id = $1 ORDER BY created_at`, [b.id]);
    expect(stored.rows).toEqual([
      { sender_id: b.customer.id, receiver_id: b.nurse.id },
      { sender_id: b.nurse.id, receiver_id: b.customer.id },
    ]);
    // outsiders see nothing
    await rejectsWith(chat.getConversation(await user('PATIENT', 'Khác'), b.id), 404, 'CONVERSATION_NOT_FOUND');
    await rejectsWith(chat.send(await user('NURSE', 'Khác'), b.id, 'hi'), 404, 'CONVERSATION_NOT_FOUND');
  });

  it('a phone number, an external link or off-platform payment is delivered but flagged, warned and logged', async () => {
    const b = await booking('IN_PROGRESS');
    const r = await chat.send(b.nurse, b.id, 'Lần sau chị gọi thẳng em 0905 123 456 hoặc zalo.me/emhoa, chuyển khoản riêng cho rẻ');
    expect(r.flagged).toBe(true);
    expect(r.warning!.reasons.sort()).toEqual(['EXTERNAL_LINK', 'OFF_PLATFORM_PAYMENT', 'PHONE_NUMBER']);
    expect(r.warning!.message).toContain('FR-CHAT-01');
    const flag = await pool.query(`SELECT sender_id, to_jsonb(reasons) AS reasons, to_jsonb(matches) AS matches FROM chat_flags WHERE message_id = $1`, [r.id]);
    expect(flag.rows[0].sender_id).toBe(b.nurse.id);
    expect(flag.rows[0].reasons.sort()).toEqual(['EXTERNAL_LINK', 'OFF_PLATFORM_PAYMENT', 'PHONE_NUMBER']);
    expect(flag.rows[0].matches).toContain('0905 123 456');
    // the receiver still gets it, marked
    const conv = await chat.getConversation(b.customer, b.id);
    expect(conv.messages.at(-1)).toMatchObject({ id: r.id, flagged: true });
  });

  it('call logs, read receipts, realtime events and notifications only when the receiver is away', async () => {
    const b = await booking('CONFIRMED');
    notices.length = 0;
    const m1 = await chat.send(b.customer, b.id, 'Em ơi');
    expect(notices.map((n) => [n.userId, n.type, n.data.conversationId])).toEqual([[b.nurse.id, 'NEW_MESSAGE', b.id]]);
    watching.add(`${b.id}:${b.nurse.id}`);
    const m2 = await chat.send(b.customer, b.id, 'Em có ở đó không');
    expect(notices).toHaveLength(1); // nurse has the conversation open: socket only

    const call = await chat.logCall(b.nurse, b.id, { durationSec: 192, outcome: 'COMPLETED' });
    expect(call).toMatchObject({ type: 'VOICE_CALL_LOG', senderRole: 'NURSE', content: 'Cuộc gọi trong ứng dụng · 3 phút 12 giây' });
    const missed = await chat.logCall(b.customer, b.id, { durationSec: 40, outcome: 'MISSED' });
    expect(missed.content).toBe('Cuộc gọi nhỡ');
    expect((await pool.query(`SELECT call_duration_sec FROM conversations_messages WHERE id = $1`, [missed.id])).rows[0].call_duration_sec).toBe(0);

    await chat.markRead(b.nurse, b.id, m2.id);
    const conv = await chat.getConversation(b.customer, b.id);
    const byId = new Map(conv.messages.map((m) => [m.id, m]));
    expect(byId.get(m1.id)!.readAt).not.toBe(null);
    expect(byId.get(m2.id)!.readAt).not.toBe(null);
    expect(byId.get(call.id)!.readAt).toBe(null); // sent by the nurse: read by the customer only
    await rejectsWith(chat.markRead(b.nurse, b.id, '00000000-0000-4000-8000-000000000000'), 404, 'MESSAGE_NOT_FOUND');

    const mine = events.filter((e) => e.bookingId === b.id).map((e) => e.m.type);
    expect(mine).toEqual(['NEW_MESSAGE', 'NEW_MESSAGE', 'NEW_MESSAGE', 'NEW_MESSAGE', 'READ']);
    expect(events.at(-1)!.m).toMatchObject({ type: 'READ', conversationId: b.id, readerRole: 'NURSE' });
  });

  it('closes when the shift ends; history stays readable; rows can never be deleted or edited', async () => {
    const b = await booking('IN_PROGRESS');
    const m = await chat.send(b.customer, b.id, 'Cảm ơn em');
    await setStatus(b.id, 'COMPLETED');
    await rejectsWith(chat.send(b.nurse, b.id, 'Dạ'), 409, 'CONVERSATION_CLOSED');
    await rejectsWith(chat.logCall(b.nurse, b.id, { durationSec: 10, outcome: 'COMPLETED' }), 409, 'CONVERSATION_CLOSED');
    const conv = await chat.getConversation(b.nurse, b.id);
    expect(conv.isOpen).toBe(false);
    expect(conv.messages[0].content).toContain('Ca đã kết thúc');
    expect(conv.messages.map((x) => x.id)).toContain(m.id);

    let deleteErr: any;
    await pool.query(`DELETE FROM conversations_messages WHERE id = $1`, [m.id]).catch((e) => (deleteErr = e));
    expect(String(deleteErr?.message)).toContain('cannot be deleted');
    let editErr: any;
    await pool.query(`UPDATE conversations_messages SET content = 'sửa' WHERE id = $1`, [m.id]).catch((e) => (editErr = e));
    expect(String(editErr?.message)).toContain('only the read receipt can change');
    await pool.query(`UPDATE conversations_messages SET is_read = TRUE, read_at = now() WHERE id = $1`, [m.id]); // allowed

    for (const s of ['CANCELLED', 'EXPIRED']) {
      await setStatus(b.id, s);
      expect((await chat.getConversation(b.customer, b.id)).isOpen).toBe(false);
    }
  });

  it('a nurse replaced on the booking loses access; the Admin evidence view is audit-logged', async () => {
    const b = await booking('CONFIRMED');
    const flagged = await chat.send(b.customer, b.id, 'stk của tôi 0123456789 nhé');
    const replacement = await user('NURSE', 'Phạm Văn Nam');
    await pool.query(`UPDATE bookings SET nurse_id = $2 WHERE id = $1`, [b.id, replacement.id]);
    await rejectsWith(chat.getConversation(b.nurse, b.id), 404, 'CONVERSATION_NOT_FOUND');
    expect((await chat.getConversation(replacement, b.id)).messages.map((m) => m.id)).toContain(flagged.id);

    const admin = await user('ADMIN', 'Quản trị viên');
    const view = await chat.adminConversation(admin.id, b.id, '10.0.0.7');
    expect(view).toMatchObject({ bookingId: b.id, bookingCode: b.code, customerName: 'Trần Thị Mai', nurseName: 'Phạm Văn Nam', flaggedCount: 1 });
    expect(view.messages[0]).toMatchObject({ id: flagged.id, senderName: 'Trần Thị Mai', receiverRole: 'NURSE', flagged: true });
    expect(view.messages[0].flagReasons).toContain('OFF_PLATFORM_PAYMENT');
    const audit = await pool.query(
      `SELECT actor_id, action_type::text AS action, target_id, ip_address FROM audit_logs WHERE target_id = $1 AND action_type = 'VIEW_CHAT_HISTORY'`,
      [b.id],
    );
    expect(audit.rows).toEqual([{ actor_id: admin.id, action: 'VIEW_CHAT_HISTORY', target_id: b.id, ip_address: '10.0.0.7' }]);
  });

  it('photos: presigned upload, own key only, a re-encoded copy is stored and served, never the raw upload', async () => {
    const b = await booking('CONFIRMED');
    const up = await chat.requestImageUploadUrl(b.customer, b.id, 'image/png');
    expect(up.objectKey.startsWith(`chat-image/${b.customer.id}/`)).toBe(true);
    await rejectsWith(chat.requestImageUploadUrl(b.customer, b.id, 'application/pdf'), 400, 'CONTENT_TYPE_NOT_ALLOWED');
    await rejectsWith(chat.sendImage(b.customer, b.id, up.objectKey), 400, 'IMAGE_NOT_UPLOADED');
    objects.set(up.objectKey, Buffer.from('IMG:photo-with-gps'));
    await rejectsWith(chat.sendImage(b.nurse, b.id, up.objectKey), 400, 'IMAGE_KEY_INVALID'); // someone else's upload

    const bad = await chat.requestImageUploadUrl(b.customer, b.id, 'image/jpeg');
    objects.set(bad.objectKey, Buffer.from('<html>not an image'));
    await rejectsWith(chat.sendImage(b.customer, b.id, bad.objectKey), 400, 'IMAGE_UNREADABLE');

    notices.length = 0;
    const m = await chat.sendImage(b.customer, b.id, up.objectKey);
    expect(m).toMatchObject({ type: 'IMAGE', senderRole: 'PATIENT', content: '📷 Hình ảnh', warning: null });
    expect(m.imageUrl).toMatch(/^https:\/\/s3\.test\/get\/chat-image\//);
    expect(m.imageUrl).not.toContain(up.objectKey); // the raw upload (with metadata) is never served
    const stored = (await pool.query(`SELECT content FROM conversations_messages WHERE id = $1`, [m.id])).rows[0].content as string;
    expect(stored).not.toBe(up.objectKey);
    expect(objects.get(stored)!.toString()).toBe('CLEAN:photo-with-gps');
    expect(notices[0]).toMatchObject({ userId: b.nurse.id, body: '📷 Hình ảnh' });

    const conv = await chat.getConversation(b.nurse, b.id);
    expect(conv.messages.at(-1)).toMatchObject({ id: m.id, type: 'IMAGE', imageUrl: `https://s3.test/get/${stored}?sig=1` });
  });

  it('in-app call: config, signals relayed to the other participant only, refused when closed or foreign', async () => {
    const b = await booking('CONFIRMED');
    const cfg = await chat.callConfig(b.customer, b.id);
    expect(cfg).toEqual({ iceServers: [{ urls: 'stun:stun.test:3478' }], ringTimeoutSec: 45 });

    const callId = '7d4b7a52-6f3a-4c1e-9f0e-1b2c3d4e5f60';
    const before = events.length;
    await chat.handleSocketSignal(b.customer, b.id, { type: 'CALL_SIGNAL', callId, kind: 'RING' });
    await chat.handleSocketSignal(b.nurse, b.id, { type: 'CALL_SIGNAL', callId, kind: 'ACCEPT' });
    await chat.handleSocketSignal(b.customer, b.id, { type: 'CALL_SIGNAL', callId, kind: 'OFFER', payload: { type: 'offer', sdp: 'v=0' } });
    const sent = events.slice(before);
    expect(sent.map((e) => [e.m.kind, e.m.fromRole, e.to])).toEqual([
      ['RING', 'PATIENT', b.nurse.id],
      ['ACCEPT', 'NURSE', b.customer.id],
      ['OFFER', 'PATIENT', b.nurse.id],
    ]);
    expect(sent[2].m).toMatchObject({ type: 'CALL_SIGNAL', conversationId: b.id, callId, payload: { sdp: 'v=0' } });
    expect(JSON.stringify(sent)).not.toContain(b.customer.phone);
    expect(JSON.stringify(sent)).not.toContain(b.nurse.phone);

    await rejectsWith(chat.handleSocketSignal(b.customer, b.id, { type: 'CALL_SIGNAL', callId: 'x', kind: 'RING' }), 400, 'BAD_SIGNAL');
    await rejectsWith(
      chat.handleSocketSignal(b.customer, b.id, { type: 'CALL_SIGNAL', callId, kind: 'ICE_CANDIDATE', payload: 'x'.repeat(20000) }),
      400,
      'SIGNAL_TOO_LARGE',
    );
    const stranger = await user('NURSE', 'Người lạ');
    await rejectsWith(chat.handleSocketSignal(stranger, b.id, { type: 'CALL_SIGNAL', callId, kind: 'RING' }), 404, 'CONVERSATION_NOT_FOUND');

    await setStatus(b.id, 'COMPLETED');
    await rejectsWith(chat.handleSocketSignal(b.customer, b.id, { type: 'CALL_SIGNAL', callId, kind: 'RING' }), 409, 'CONVERSATION_CLOSED');
    await rejectsWith(chat.callConfig(b.customer, b.id), 409, 'CONVERSATION_CLOSED');
    await chat.handleSocketSignal(b.nurse, b.id, { type: 'CALL_SIGNAL', callId, kind: 'HANGUP' }); // ending is always relayed
    expect(events.at(-1)).toMatchObject({ to: b.customer.id, m: { kind: 'HANGUP', fromRole: 'NURSE' } });
  });
});
