import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { UserRole } from '@healthcare-system/shared';
import { runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { ShiftExtendService, confirmExtensionPayment } from '../../src/modules/shift-extend/shift-extend.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * shift-extend on real PostgreSQL 16 (FR-SHIFT-03): request → nurse answer → (transfer) → in effect, with
 * pricing-engine, BE-3's escrow ledger, the one-open-extension index and the nurse no-overlap constraint.
 * Fixed clock and rates; no holidays in 2027 January seeds. (Test users are not deleted.)
 */
describe('shift-extend (integration)', () => {
  let pool: Pool;
  let customerId: string;
  let profileId: string;
  let shift4hId: string;
  let slot = 0;
  let now = 0;
  const HOUR = 3_600_000;
  const CONFIG: Record<string, number> = {
    EXTENSION_REQUEST_DEADLINE_MINUTES: 30,
    MAX_EXTENSION_HOURS: 4,
    TRAVEL_BUFFER_MINUTES: 60,
    PAYMENT_TIMEOUT_MINUTES: 15,
  };
  const RATES = { night: 0.2, holidayMajor: 3, holidayMinor: 2, heavyPatient: 0.15, commission: 0.15 };

  const service = () =>
    new ShiftExtendService({
      read: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      getNumber: async (k) => {
        if (CONFIG[k] === undefined) throw new Error(`missing ${k}`);
        return CONFIG[k]!;
      },
      loadRates: async () => RATES,
      receivingAccount: () => ({ bankBin: '970436', bankName: 'Ngân hàng test', accountNumber: '0123456789', accountName: 'CARENEST' }),
      now: () => now,
    });

  const pay = (code: string, amount: number, ref = `REF-${randomUUID().slice(0, 8)}`) =>
    runInTransaction(pool, (db) => confirmExtensionPayment(db, { paymentCode: code, amount, providerRef: ref }, { nowMs: now, bufferMinutes: 60 }));

  beforeAll(async () => {
    pool = createTestPool();
    customerId = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, location_type, mobility_status, data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Bệnh nhân test', 'HOME', 'NORMAL', TRUE, now()) RETURNING id`,
      [customerId],
    );
    profileId = p.rows[0].id;
    shift4hId = (await pool.query("SELECT id FROM service_categories WHERE code = 'SRV_SHIFT_4H'")).rows[0].id; // 400,000 / 4h
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createNurse(): Promise<string> {
    const phone = `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng test', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    await pool.query("INSERT INTO nurse_profiles (user_id, profile_status) VALUES ($1, 'ACTIVE')", [rows[0].id]);
    return rows[0].id;
  }

  /** A running 4-hour shift 09:00–13:00 Vietnam time on its own day; "now" = 11:00 (2 h before the end). */
  async function runningShift(nurseId: string, payment: 'CASH' | 'BANK_TRANSFER' = 'CASH'): Promise<{ id: string; end: number }> {
    slot += 1;
    const start = Date.UTC(2027, 0, slot, 2, 0, 0);
    const end = start + 4 * HOUR;
    now = end - 2 * HOUR;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, platform_fee, execution_status, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, 400000, 400000, 60000, 'IN_PROGRESS',
               $9::payment_status_enum)
       RETURNING id`,
      [
        `HC-T${randomUUID().slice(0, 10)}`,
        customerId,
        profileId,
        nurseId,
        shift4hId,
        payment,
        new Date(start),
        new Date(end),
        payment === 'BANK_TRANSFER' ? 'ESCROW_HELD' : 'UNPAID',
      ],
    );
    return { id: rows[0].id, end };
  }

  const booking = async (id: string) =>
    (await pool.query('SELECT end_time, base_amount, platform_fee, total_amount FROM bookings WHERE id = $1', [id])).rows[0];

  async function codeOf(p: Promise<unknown>): Promise<string> {
    try {
      await p;
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      return (e as AppError).code;
    }
    throw new Error('expected an AppError');
  }

  const asNurse = (id: string) => ({ id, role: UserRole.NURSE });

  it('quotes 1 extra hour of a 4-hour shift at the per-hour rate, with the platform fee inside the total', async () => {
    const nurse = await createNurse();
    const b = await runningShift(nurse);
    const q = await service().quote(customerId, b.id, 1);
    expect(q).toMatchObject({ extraHours: 1, baseAmount: 100_000, nightSurcharge: 0, totalAmount: 100_000, platformFee: 15_000 });
    expect(q.from).toBe(new Date(b.end).toISOString());
  });

  it('cash: request → nurse accepts → in effect at once (end +1h, amounts +)', async () => {
    const nurse = await createNurse();
    const b = await runningShift(nurse);

    const req = await service().request(customerId, b.id, 1);
    expect(req).toMatchObject({ status: 'AWAITING_NURSE', hours: 1, amount: 100_000, paymentCode: null, bankTransfer: null });

    const ok = await service().respond(nurse, b.id, { extensionId: req.id, approved: true });
    expect(ok.status).toBe('CONFIRMED');
    const row = await booking(b.id);
    expect(new Date(row.end_time).getTime()).toBe(b.end + HOUR);
    expect(Number(row.total_amount)).toBe(500_000);
    expect(Number(row.base_amount)).toBe(500_000);
    expect(Number(row.platform_fee)).toBe(75_000);
  });

  it('bank transfer: accept → waits for payment → paid into escrow → in effect; the same reference twice is ignored', async () => {
    const nurse = await createNurse();
    const b = await runningShift(nurse, 'BANK_TRANSFER');
    const req = await service().request(customerId, b.id, 2);
    expect(req.paymentCode).toMatch(/-GH1$/);

    const accepted = await service().respond(nurse, b.id, { extensionId: req.id, approved: true, bookingId: b.id });
    expect(accepted.status).toBe('AWAITING_PAYMENT');
    expect(accepted.bankTransfer).toMatchObject({ transferContent: req.paymentCode });
    expect(accepted.paymentExpiresAt).toBe(new Date(now + 15 * 60_000).toISOString());
    expect(new Date((await booking(b.id)).end_time).getTime()).toBe(b.end); // not in effect yet

    now += 5 * 60_000;
    const ref = `REF-${randomUUID().slice(0, 8)}`;
    expect(await pay(req.paymentCode!, req.amount, ref)).toBe('EXTENSION_PAID');
    expect(await pay(req.paymentCode!, req.amount, ref)).toBe('DUPLICATE');

    expect(new Date((await booking(b.id)).end_time).getTime()).toBe(b.end + 2 * HOUR);
    const held = await pool.query(
      "SELECT amount FROM wallet_transactions WHERE booking_id = $1 AND tx_type = 'ESCROW_HOLD'",
      [b.id],
    );
    expect(held.rows.map((r) => Number(r.amount))).toEqual([req.amount]);
    const list = await service().list({ id: customerId, role: UserRole.PATIENT }, b.id);
    expect(list.map((e) => e.status)).toEqual(['CONFIRMED']);
  });

  it('a transfer that arrives after the payment window is refunded in full and the extension expires', async () => {
    const nurse = await createNurse();
    const b = await runningShift(nurse, 'BANK_TRANSFER');
    const req = await service().request(customerId, b.id, 1);
    await service().respond(nurse, b.id, { extensionId: req.id, approved: true });

    now += 16 * 60_000;
    expect(await pay(req.paymentCode!, req.amount)).toBe('LATE_PAYMENT_REFUNDED');

    expect(new Date((await booking(b.id)).end_time).getTime()).toBe(b.end);
    const moves = await pool.query("SELECT tx_type FROM wallet_transactions WHERE booking_id = $1 ORDER BY created_at", [b.id]);
    expect(moves.rows.map((r) => r.tx_type)).toEqual(['ESCROW_HOLD', 'REFUND']);
    const list = await service().list(asNurse(nurse), b.id);
    expect(list[0]!.status).toBe('EXPIRED');
  });

  it('a wrong amount moves nothing', async () => {
    const nurse = await createNurse();
    const b = await runningShift(nurse, 'BANK_TRANSFER');
    const req = await service().request(customerId, b.id, 1);
    await service().respond(nurse, b.id, { extensionId: req.id, approved: true });
    expect(await pay(req.paymentCode!, req.amount - 1)).toBe('AMOUNT_MISMATCH');
    const moves = await pool.query('SELECT count(*)::int AS n FROM wallet_transactions WHERE booking_id = $1', [b.id]);
    expect(moves.rows[0].n).toBe(0);
  });

  it('declined: nothing changes and a new request is possible; only one open request at a time', async () => {
    const nurse = await createNurse();
    const b = await runningShift(nurse);
    const first = await service().request(customerId, b.id, 1);
    expect(await codeOf(service().request(customerId, b.id, 1))).toBe('EXTENSION_PENDING');

    const no = await service().respond(nurse, b.id, { extensionId: first.id, approved: false, declineReason: 'Có việc gia đình' });
    expect(no).toMatchObject({ status: 'DECLINED', declineReason: 'Có việc gia đình' });
    expect(new Date((await booking(b.id)).end_time).getTime()).toBe(b.end);
    expect(await codeOf(service().respond(nurse, b.id, { extensionId: first.id, approved: true }))).toBe('EXTENSION_NOT_PENDING');

    await expect(service().request(customerId, b.id, 1)).resolves.toMatchObject({ status: 'AWAITING_NURSE' });
  });

  it('refuses when the nurse has another shift right after (incl. the 60-minute travel buffer)', async () => {
    const nurse = await createNurse();
    const b = await runningShift(nurse);
    await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'CASH', $6, $7, 1, 1, 'CONFIRMED')`,
      [`HC-N${randomUUID().slice(0, 10)}`, customerId, profileId, nurse, shift4hId, new Date(b.end + 90 * 60_000), new Date(b.end + 4 * HOUR)],
    );
    expect(await codeOf(service().request(customerId, b.id, 1))).toBe('NEXT_SHIFT_CONFLICT'); // 1h + 60 min buffer > 90 min
  });

  it('time window, hours and access rules', async () => {
    const nurse = await createNurse();
    const other = await createNurse();
    const stranger = await createTestUser(pool);
    const b = await runningShift(nurse);

    expect(await codeOf(service().request(customerId, b.id, 5))).toBe('INVALID_EXTENSION_HOURS');
    expect(await codeOf(service().request(stranger, b.id, 1))).toBe('BOOKING_NOT_FOUND');
    const req = await service().request(customerId, b.id, 1);
    expect(await codeOf(service().respond(other, b.id, { extensionId: req.id, approved: true }))).toBe('NOT_ASSIGNED_NURSE');
    expect(await codeOf(service().list(asNurse(other), b.id))).toBe('BOOKING_NOT_FOUND');

    const late = await runningShift(nurse);
    now = late.end - 20 * 60_000;
    expect(await codeOf(service().request(customerId, late.id, 1))).toBe('EXTENSION_WINDOW_CLOSED');
  });

  it('an unanswered request expires at the scheduled end', async () => {
    const nurse = await createNurse();
    const b = await runningShift(nurse);
    const req = await service().request(customerId, b.id, 1);
    now = b.end + 60_000;
    const list = await service().list({ id: customerId, role: UserRole.PATIENT }, b.id);
    expect(list.find((e) => e.id === req.id)!.status).toBe('EXPIRED');
  });
});
