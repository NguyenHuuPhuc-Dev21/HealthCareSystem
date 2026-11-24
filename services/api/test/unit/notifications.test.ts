import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { NotificationPriority } from '@healthcare-system/shared';
import {
  commissionOverdue,
  depositRefundStatus,
  disputeOpened,
  disputeRebutted,
  disputeResolved,
  penaltyAppealResolved,
  settlementDone,
  vnd,
  withdrawalUpdate,
} from '../../src/modules/notifications/notifications.notices';
import { decodeCursor, encodeCursor, legacyNotify, sendNotices, toItem } from '../../src/modules/notifications/notifications.service';
import { tokenFromUpgrade, toSocketMessage } from '../../src/modules/notifications/notifications.socket';
import type { InboxRow, Notice } from '../../src/modules/notifications/notifications.types';

/** notifications (BE-3 · Phase 6 · FR-NOTIF-01): pure parts — cursor, DTO, socket message, notice builders. */
const U = '11111111-1111-4111-8111-111111111111';
const N = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const ref = { disputeId: 'd1', bookingId: 'b1', bookingCode: 'HC-001' };

describe('notifications — cursor & DTO', () => {
  it('the keyset cursor round-trips with full microsecond precision; garbage is a 400', () => {
    const at = '2026-11-24 15:01:03.480516+00';
    expect(decodeCursor(encodeCursor({ at_text: at, id: U }))).toEqual({ at, id: U });
    const utc = '2026-11-24T15:01:03.480516Z'; // what the repo emits
    expect(decodeCursor(encodeCursor({ at_text: utc, id: U }))).toEqual({ at: utc, id: U });
    expect(decodeCursor(encodeCursor({ at_text: '2026-11-24 22:01:03.48+07', id: U })).at).toBe('2026-11-24 22:01:03.48+07');
    expect(() => decodeCursor('not-a-cursor')).toThrowError(expect.objectContaining({ status: 400, code: 'INVALID_CURSOR' }));
    expect(() => decodeCursor(Buffer.from(`${at}|nope`).toString('base64url'))).toThrow();
  });

  it('a stored row becomes the NotificationDto nurse-web expects', () => {
    const row: InboxRow = {
      id: U,
      type: null,
      priority: NotificationPriority.NORMAL,
      title: 'T',
      body: null,
      data: { disputeId: 'd1' },
      booking_id: 'b1',
      read_at: null,
      is_read: false,
      created_at: new Date('2026-11-24T08:00:00Z'),
      at_text: '',
    };
    expect(toItem(row)).toEqual({
      id: U,
      type: 'SYSTEM',
      priority: 'NORMAL',
      title: 'T',
      body: '',
      data: { disputeId: 'd1', bookingId: 'b1' },
      readAt: null,
      createdAt: '2026-11-24T08:00:00.000Z',
    });
    expect(toItem({ ...row, is_read: true, read_at: null }).readAt).toBe('2026-11-24T08:00:00.000Z');
  });

  it('socket message: NEW_NOTIFICATION with the same DTO', () => {
    const m = toSocketMessage({ notificationId: U, title: 'T', body: 'B', priority: NotificationPriority.HIGH, bookingId: 'b1', type: 'DISPUTE_OPENED', data: { disputeId: 'd1' }, createdAt: '2026-11-24T08:00:00.000Z' });
    expect(m).toEqual({
      type: 'NEW_NOTIFICATION',
      notification: { id: U, type: 'DISPUTE_OPENED', priority: 'HIGH', title: 'T', body: 'B', data: { disputeId: 'd1', bookingId: 'b1' }, readAt: null, createdAt: '2026-11-24T08:00:00.000Z' },
    });
  });

  it('the WebSocket token comes from ?access_token=, ?token= or the "bearer, <jwt>" subprotocol', () => {
    const req = (url: string, protocol?: string) => ({ url, headers: protocol ? { 'sec-websocket-protocol': protocol } : {} }) as unknown as IncomingMessage;
    expect(tokenFromUpgrade(req('/ws/notifications?access_token=abc'))).toBe('abc');
    expect(tokenFromUpgrade(req('/ws/notifications?token=xyz'))).toBe('xyz');
    expect(tokenFromUpgrade(req('/ws/notifications', 'bearer, jwt.value'))).toBe('jwt.value');
    expect(tokenFromUpgrade(req('/ws/notifications', 'bearer'))).toBeNull();
    expect(tokenFromUpgrade(req('/ws/notifications'))).toBeNull();
  });
});

describe('notifications — notices of the money and dispute flows', () => {
  it('formats VND the Vietnamese way', () => {
    expect(vnd(1_250_000)).toBe('1.250.000đ');
  });

  it('a new dispute is urgent for the other side; nurse and customer get their own types', () => {
    const toNurse = disputeOpened({ userId: N, isNurse: true }, { ...ref, rebuttalHours: 24 });
    expect(toNurse).toMatchObject({ userId: N, type: 'DISPUTE_OPENED', priority: 'HIGH', bookingId: 'b1', data: ref });
    expect(toNurse.body).toContain('24 giờ');
    expect(disputeOpened({ userId: C, isNurse: false }, { ...ref, rebuttalHours: 24 }).title).toContain('Điều dưỡng mở khiếu nại');
    expect(disputeRebutted({ userId: C, isNurse: false }, ref).type).toBe('DISPUTE_UPDATED');
    expect(disputeRebutted({ userId: N, isNurse: true }, ref).type).toBe('DISPUTE_OPENED'); // routes to the dispute page
  });

  it('RESOLVED_CUSTOMER: both sides + a separate deposit deduction notice for the nurse', () => {
    const out = disputeResolved(N, C, { ...ref, outcome: 'RESOLVED_CUSTOMER', refunded: 500_000, released: 0, trustScoreDelta: -25, depositDeducted: 50_000 });
    expect(out.map((n) => [n.userId, n.type])).toEqual([
      [N, 'DISPUTE_RESOLVED'],
      [C, 'DISPUTE_RESOLVED'],
      [N, 'DEPOSIT_PENALTY'],
    ]);
    expect(out[0].body).toContain('TrustScore -25');
    expect(out[1].body).toContain('500.000đ');
    expect(out[2].body).toContain('không kháng cáo');
  });

  it('RESOLVED_NURSE: the released amount, or the promise of settlement after check-out', () => {
    expect(disputeResolved(N, C, { ...ref, outcome: 'RESOLVED_NURSE', refunded: 0, released: 425_000, trustScoreDelta: 0, depositDeducted: 0 })[0].body).toContain('425.000đ');
    expect(disputeResolved(N, C, { ...ref, outcome: 'RESOLVED_NURSE', refunded: 0, released: 0, trustScoreDelta: 0, depositDeducted: 0 })[0].body).toContain('check-out');
  });

  it('penalty appeal, settlement, withheld part, withdrawal, deposit refund, overdue commission', () => {
    expect(penaltyAppealResolved(N, { disputeId: 'd', bookingId: 'b', upheld: true, amount: 50_000 })).toMatchObject({ type: 'PENALTY_REVERSED' });
    expect(penaltyAppealResolved(N, { disputeId: 'd', bookingId: 'b', upheld: false, amount: 50_000 })).toMatchObject({ type: 'DISPUTE_RESOLVED' });
    expect(settlementDone(N, { bookingId: 'b', bookingCode: 'HC-1', payout: 425_000, withheld: 0 }).map((n) => n.type)).toEqual(['SETTLEMENT_DONE']);
    expect(settlementDone(N, { bookingId: 'b', bookingCode: 'HC-1', payout: 297_500, withheld: 127_500 }).map((n) => n.type)).toEqual(['SETTLEMENT_DONE', 'DEPOSIT_WITHHELD']);
    expect(withdrawalUpdate(N, { withdrawalId: 'w', amount: 200_000, status: 'REJECTED', reason: 'Sai số tài khoản' }).body).toContain('Sai số tài khoản');
    expect(depositRefundStatus(N, { requestId: 'r', status: 'REFUNDED', amount: 300_000 }).title).toContain('300.000đ');
    expect(commissionOverdue(N)).toMatchObject({ type: 'COMMISSION_OVERDUE', priority: 'HIGH' });
  });

  it('sendNotices: a failing notice is logged and the others are still sent; no notifier = nothing', async () => {
    const sent: string[] = [];
    const notify = async (n: Notice) => {
      if (n.type === 'BAD') throw new Error('boom');
      sent.push(n.type);
    };
    await sendNotices(notify, [
      { userId: N, type: 'BAD', title: 't', body: 'b' },
      { userId: N, type: 'OK', title: 't', body: 'b' },
    ]);
    expect(sent).toEqual(['OK']);
    await expect(sendNotices(undefined, [{ userId: N, type: 'OK', title: 't', body: 'b' }])).resolves.toBeUndefined();
  });

  it('legacyNotify adds the type to an older module notice', async () => {
    const got: Notice[] = [];
    await legacyNotify('BOOKING_CANCELLED', async (n) => void got.push(n))({ userId: N, bookingId: 'b', title: 'T', body: null });
    expect(got).toEqual([{ userId: N, bookingId: 'b', type: 'BOOKING_CANCELLED', title: 'T', body: '' }]);
  });
});
