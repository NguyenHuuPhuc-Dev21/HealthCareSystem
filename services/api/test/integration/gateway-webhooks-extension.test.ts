import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { closePool, runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { signData } from '../../src/modules/gateway-webhooks/gateway-webhooks.policy';
import { GatewayWebhooksService } from '../../src/modules/gateway-webhooks/gateway-webhooks.service';
import { ShiftExtendService } from '../../src/modules/shift-extend/shift-extend.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * gateway-webhooks ↔ shift-extend (BE-3 · FR-PAY-01 · FR-SHIFT-03) trên PostgreSQL thật:
 * chuyển khoản gia hạn ca (nội dung `<mã đơn>-GH<n>`) đi qua đúng webhook HMAC của đơn đặt,
 * được giữ vào escrow và gia hạn có hiệu lực; gửi lặp không ghi sổ 2 lần; sai số tiền không đụng tiền;
 * mã đơn thường lỡ kết thúc bằng -GH<số> vẫn đi luồng đơn đặt.
 * Đồng hồ cố định (tháng 3/2028, không có ngày lễ); mỗi ca có điều dưỡng riêng.
 */
describe('gateway-webhooks: shift-extension payments (integration)', () => {
  let pool: Pool;
  let customerId: string;
  let profileId: string;
  let shift4hId: string;
  let slot = 0;
  let now = 0;
  const HOUR = 3_600_000;
  const SECRET = 'extension-webhook-secret';
  const CONFIG: Record<string, number> = {
    EXTENSION_REQUEST_DEADLINE_MINUTES: 30,
    MAX_EXTENSION_HOURS: 4,
    TRAVEL_BUFFER_MINUTES: 60,
    PAYMENT_TIMEOUT_MINUTES: 15,
  };
  const RATES = { night: 0.2, holidayMajor: 3, holidayMinor: 2, heavyPatient: 0.15, commission: 0.15 };
  const ACCOUNT = { bankBin: '970436', bankName: 'Ngân hàng test', accountNumber: '0123456789', accountName: 'CARENEST' };

  const extend = () =>
    new ShiftExtendService({
      read: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      getNumber: async (k) => {
        if (CONFIG[k] === undefined) throw new Error(`missing ${k}`);
        return CONFIG[k]!;
      },
      loadRates: async () => RATES,
      receivingAccount: () => ACCOUNT,
      now: () => now,
    });

  const webhooks = () =>
    new GatewayWebhooksService({
      read: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      secret: () => SECRET,
      receivingAccount: () => ACCOUNT,
      startRadar: async () => {},
      now: () => now, // confirmExtensionPayment = the real default (shift-extend, BE-1)
    });

  const webhook = (orderCode: string, amount: number, reference: string, secret = SECRET) => {
    const data = { orderCode, amount, reference, description: orderCode, transactionDateTime: new Date(now).toISOString() };
    return { code: '00', desc: 'success', success: true, data, signature: signData(data, secret) };
  };
  const ref = () => `FT-EXT-${randomUUID().slice(0, 12)}`;

  async function createNurse(): Promise<string> {
    const phone = `05${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng gia hạn', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    await pool.query("INSERT INTO nurse_profiles (user_id, profile_status) VALUES ($1, 'ACTIVE')", [rows[0].id]);
    return rows[0].id;
  }

  /** A running, prepaid 4-hour shift 09:00–13:00 VN time; "now" = 11:00. */
  async function runningShift(nurseId: string): Promise<{ id: string; end: number }> {
    slot += 1;
    const start = Date.UTC(2028, 2, slot, 2, 0, 0);
    const end = start + 4 * HOUR;
    now = end - 2 * HOUR;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, platform_fee, execution_status, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'BANK_TRANSFER', $6, $7, 400000, 400000, 60000, 'IN_PROGRESS', 'ESCROW_HELD')
       RETURNING id`,
      [`HC-X${randomUUID().slice(0, 10)}`, customerId, profileId, nurseId, shift4hId, new Date(start), new Date(end)],
    );
    return { id: rows[0].id, end };
  }

  /** Bank-transfer extension accepted by the nurse, waiting for the transfer. */
  async function awaitingPayment(hours = 1) {
    const nurse = await createNurse();
    const b = await runningShift(nurse);
    const req = await extend().request(customerId, b.id, hours);
    const accepted = await extend().respond(nurse, b.id, { extensionId: req.id, approved: true });
    expect(accepted.status).toBe('AWAITING_PAYMENT');
    return { b, code: req.paymentCode!, amount: req.amount };
  }

  const endOf = async (id: string) => new Date((await pool.query('SELECT end_time FROM bookings WHERE id = $1', [id])).rows[0].end_time).getTime();
  const holds = async (id: string) =>
    (await pool.query(`SELECT amount, external_ref FROM wallet_transactions WHERE booking_id = $1 AND tx_type = 'ESCROW_HOLD'`, [id])).rows.map(
      (r) => ({ amount: Number(r.amount), ref: r.external_ref as string }),
    );

  beforeAll(async () => {
    pool = createTestPool();
    customerId = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, location_type, mobility_status, data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Bệnh nhân gia hạn', 'HOME', 'NORMAL', TRUE, now()) RETURNING id`,
      [customerId],
    );
    profileId = p.rows[0].id;
    shift4hId = (await pool.query("SELECT id FROM service_categories WHERE code = 'SRV_SHIFT_4H'")).rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
    await closePool(); // global pool used by core/config (TRAVEL_BUFFER_MINUTES)
  });

  it('paid through the escrow webhook → EXTENSION_PAID, held in escrow, shift extended; re-delivery → DUPLICATE', async () => {
    const { b, code, amount } = await awaitingPayment(1);
    expect(code).toMatch(/-GH1$/);
    const r = ref();

    now += 5 * 60_000;
    expect(await webhooks().handleEscrowWebhook(webhook(code, amount, r))).toEqual({ received: true, outcome: 'EXTENSION_PAID', bookingId: b.id });
    expect(await endOf(b.id)).toBe(b.end + HOUR);
    expect(await holds(b.id)).toEqual([{ amount, ref: r }]);

    expect((await webhooks().handleEscrowWebhook(webhook(code, amount, r))).outcome).toBe('DUPLICATE');
    expect(await holds(b.id)).toHaveLength(1);
    const ev = await pool.query(`SELECT outcome, booking_id FROM payment_webhook_events WHERE provider_ref = $1 ORDER BY received_at`, [r]);
    expect(ev.rows).toEqual([
      { outcome: 'EXTENSION_PAID', booking_id: b.id },
      { outcome: 'DUPLICATE', booking_id: b.id },
    ]);
  });

  it('wrong amount → AMOUNT_MISMATCH, nothing moves; bad signature → 401', async () => {
    const { b, code, amount } = await awaitingPayment(1);
    expect((await webhooks().handleEscrowWebhook(webhook(code, amount - 1000, ref()))).outcome).toBe('AMOUNT_MISMATCH');

    let err: unknown;
    try {
      await webhooks().handleEscrowWebhook(webhook(code, amount, ref(), 'wrong-secret'));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('INVALID_SIGNATURE');

    expect(await endOf(b.id)).toBe(b.end);
    expect(await holds(b.id)).toEqual([]);
  });

  it('after the 15-minute payment window → held and refunded 100% at once (LATE_PAYMENT_REFUNDED)', async () => {
    const { b, code, amount } = await awaitingPayment(1);
    now += 16 * 60_000;
    expect((await webhooks().handleEscrowWebhook(webhook(code, amount, ref()))).outcome).toBe('LATE_PAYMENT_REFUNDED');
    expect(await endOf(b.id)).toBe(b.end);
    const txs = await pool.query(`SELECT tx_type FROM wallet_transactions WHERE booking_id = $1 ORDER BY tx_type`, [b.id]);
    expect(txs.rows.map((t) => t.tx_type)).toEqual(['ESCROW_HOLD', 'REFUND']);
  });

  it('a booking code that happens to end in -GH<digits> still goes the booking way', async () => {
    now = Date.now();
    const code = `HC-X${randomUUID().slice(0, 6)}-GH7`;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, service_id, matching_mode, payment_method, start_time, end_time,
          base_amount, total_amount, platform_fee, execution_status, payment_status, hold_expires_at)
       VALUES ($1, $2, $3, $4, 'JOB_BOARD', 'BANK_TRANSFER', $5, $6, 400000, 400000, 60000, 'DRAFT', 'UNPAID', $7)
       RETURNING id`,
      [code, customerId, profileId, shift4hId, new Date(now + 10 * HOUR), new Date(now + 14 * HOUR), new Date(now + 15 * 60_000)],
    );
    // Wrong amount on purpose: the booking path answers AMOUNT_MISMATCH with this booking (the extension path would say UNKNOWN).
    expect(await webhooks().handleEscrowWebhook(webhook(code, 1, ref()))).toEqual({
      received: true,
      outcome: 'AMOUNT_MISMATCH',
      bookingId: rows[0].id,
    });
  });
});
