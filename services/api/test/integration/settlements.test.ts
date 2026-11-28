import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { TxType } from '@healthcare-system/shared';
import { closePool, query, withTransaction, type Queryable } from '../../src/core/database';
import { holdEscrow, refundEscrow } from '../../src/modules/gateway-webhooks/gateway-webhooks.ledger';
import {
  SettlementInconsistencyError,
  SettlementsService,
  settleCancellationShare,
  settleShift,
} from '../../src/modules/settlements/settlements.service';
import { postNurseEntry } from '../../src/modules/wallets-ledger/wallets-ledger.ledger';
import { WalletsLedgerService } from '../../src/modules/wallets-ledger/wallets-ledger.service';
import { createTestPool, createTestUser, findOrCreateAdmin } from './helpers';

/**
 * settlements (BE-3 · Phase 5 · FR-PAY-02 · ADR-0004 D2) trên PostgreSQL 16 thật (migration 0001 → 0018):
 *  - check-out + 24h, không tranh chấp → trả 85% (giữ 30% vào ký quỹ khi còn thiếu, đếm lượt ân hạn), đúng 1 lần;
 *  - khách xác nhận sớm → trả ngay; tranh chấp mở → đóng băng; tranh chấp xử cho điều dưỡng → trả;
 *  - escrow lệch → không trả gì (lỗi để báo động);
 *  - phần chia khi khách hủy (dòng 2–3) đang PENDING → trả cho điều dưỡng, DONE.
 */
describe('settlements (integration)', () => {
  let pool: Pool;
  let service: SettlementsService;
  let wallets: WalletsLedgerService;
  let serviceId: string;
  let admin: string;
  let customer: { id: string; profile: string };
  const HOUR = 3_600_000;
  const tx = <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c));

  async function createNurse(deposit: number, graceDays: number | null = 20): Promise<string> {
    const phone = `03${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng quyết toán', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id: string = rows[0].id;
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [id]);
    await pool.query(`INSERT INTO wallets (user_id, deposit_grace_expires_at) VALUES ($1, $2)`, [
      id,
      graceDays === null ? null : new Date(Date.now() + graceDays * 24 * HOUR),
    ]);
    if (deposit > 0) {
      await tx((db) => postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: deposit, idempotencyKey: `test-set:${randomUUID()}`, externalRef: 'TEST' }));
    }
    return id;
  }

  /** A paid transfer booking: escrow really held through the ledger, optionally checked out `checkoutHoursAgo`. */
  async function heldShift(nurseId: string, o: { checkoutHoursAgo?: number | null; status?: string; total?: number; fee?: number; payment?: string; hold?: boolean } = {}) {
    const total = o.total ?? 500_000;
    const start = Date.now() - 30 * HOUR;
    const code = `HC-S${randomUUID().slice(0, 10)}`;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, platform_fee, total_amount, execution_status, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, $9, $10, $9, $11::execution_status_enum, $12::payment_status_enum)
       RETURNING id`,
      [code, customer.id, customer.profile, nurseId, serviceId, o.payment ?? 'BANK_TRANSFER', new Date(start), new Date(start + 4 * HOUR), total,
        o.fee ?? 75_000, o.status ?? 'COMPLETED', o.payment === 'CASH' ? 'UNPAID' : 'ESCROW_HELD'],
    );
    const id: string = rows[0].id;
    if (o.hold !== false && o.payment !== 'CASH') {
      await tx((db) => holdEscrow(db, { customerId: customer.id, bookingId: id, amount: total, idempotencyKey: `escrow-hold:test-${id}`, externalRef: 'FT-TEST' }));
    }
    if (o.checkoutHoursAgo !== null) {
      await pool.query(`INSERT INTO shift_logs (booking_id, checkin_time, checkout_time) VALUES ($1, $2, $3)`, [
        id, new Date(start), new Date(Date.now() - (o.checkoutHoursAgo ?? 25) * HOUR),
      ]);
    }
    return { id, code };
  }

  const walletOf = async (userId: string) =>
    (await pool.query(`SELECT available_balance::int AS a, deposit_balance::int AS d, deposit_grace_shifts_used AS g FROM wallets WHERE user_id = $1`, [userId])).rows[0];
  const bookingOf = async (id: string) =>
    (await pool.query(`SELECT payment_status::text AS p, settled_at FROM bookings WHERE id = $1`, [id])).rows[0];
  const heldFor = async (id: string) =>
    Number((await pool.query(`SELECT COALESCE(sum(balance_after - balance_before), 0) AS h FROM wallet_transactions WHERE booking_id = $1 AND balance_type = 'ESCROW_LOCKED'`, [id])).rows[0].h);

  beforeAll(async () => {
    pool = createTestPool();
    const deps = { read: { query }, withTx: <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c)) };
    service = new SettlementsService(deps);
    wallets = new WalletsLedgerService(deps);
    serviceId = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
    admin = await findOrCreateAdmin(pool);
    const id = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Đỗ Thị Mai', '1950-02-02', 52, 'NORMAL', '5 Hùng Vương', 'HOME', 16.07, 108.22, TRUE, now()) RETURNING id`,
      [id],
    );
    customer = { id, profile: p.rows[0].id };
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('ADR-0004 worked example: three grace shifts fill the deposit 127,500 → 255,000 → 300,000', async () => {
    const nurse = await createNurse(0);
    const a = await heldShift(nurse);
    const sweep = await service.runSweep();
    expect(sweep.shifts).toBeGreaterThanOrEqual(1);
    expect(await bookingOf(a.id)).toMatchObject({ p: 'SETTLED' });
    expect(await walletOf(nurse)).toEqual({ a: 297_500, d: 127_500, g: 1 });
    expect(await heldFor(a.id)).toBe(0);
    const s = (await pool.query(`SELECT kind, trigger, gross_amount::int g, commission_amount::int c, net_amount::int n, deposit_withheld::int w, payout_amount::int p, grace_shift FROM settlements WHERE booking_id = $1`, [a.id])).rows[0];
    expect(s).toEqual({ kind: 'SHIFT', trigger: 'COOLING_ELAPSED', g: 500_000, c: 75_000, n: 425_000, w: 127_500, p: 297_500, grace_shift: true });

    // Settled exactly once: a second pass changes nothing.
    expect(await tx((db) => settleShift(db, a.id, 'COOLING_ELAPSED', Date.now()))).toEqual({ settled: false, reason: 'ALREADY_SETTLED' });
    expect(await walletOf(nurse)).toEqual({ a: 297_500, d: 127_500, g: 1 });

    for (let i = 0; i < 2; i++) {
      const b = await heldShift(nurse);
      await tx((db) => settleShift(db, b.id, 'COOLING_ELAPSED', Date.now()));
    }
    expect(await walletOf(nurse)).toEqual({ a: 297_500 * 2 + 380_000, d: 300_000, g: 3 });

    const history = await wallets.listTransactions(nurse, { type: 'SETTLE' });
    expect(history.items.map((t) => [t.type, t.amount])).toContainEqual(['DEPOSIT_WITHHOLD', 45_000]);
  }, 60_000); // the sweep walks every due booking of the shared dev database, not only this test's

  it('the customer confirms early → paid now (full deposit: no withholding, no grace count); idempotent; owner only', async () => {
    const nurse = await createNurse(300_000, null);
    const b = await heldShift(nurse, { checkoutHoursAgo: 1 });
    expect(await tx((db) => settleShift(db, b.id, 'COOLING_ELAPSED', Date.now()))).toEqual({ settled: false, reason: 'COOLING' });

    await expect(service.confirmCompletion(await createTestUser(pool), b.id)).rejects.toMatchObject({ status: 403 });
    const r = await service.confirmCompletion(customer.id, b.id);
    expect(r).toMatchObject({ bookingId: b.id, bookingCode: b.code, settled: true });
    expect(await walletOf(nurse)).toEqual({ a: 425_000, d: 300_000, g: 0 });
    expect(await service.confirmCompletion(customer.id, b.id)).toEqual(r);
    expect((await pool.query(`SELECT trigger FROM settlements WHERE booking_id = $1`, [b.id])).rows[0].trigger).toBe('CUSTOMER_CONFIRMED');
  }, 30_000);

  it('an open dispute freezes the payout; resolved for the nurse → released', async () => {
    const nurse = await createNurse(300_000, null);
    const b = await heldShift(nurse, { checkoutHoursAgo: 30 });
    await pool.query(`UPDATE bookings SET dispute_status = 'OPEN' WHERE id = $1`, [b.id]);
    await expect(service.confirmCompletion(customer.id, b.id)).rejects.toMatchObject({ status: 409, code: 'DISPUTE_OPEN' });
    await service.runSweep();
    expect(await bookingOf(b.id)).toMatchObject({ p: 'ESCROW_HELD', settled_at: null });
    expect(await service.releaseAfterDispute(b.id)).toEqual({ settled: false, reason: 'DISPUTE_OPEN' });

    await pool.query(`UPDATE bookings SET dispute_status = 'RESOLVED_NURSE' WHERE id = $1`, [b.id]);
    expect(await service.releaseAfterDispute(b.id)).toMatchObject({ settled: true, split: { payout: 425_000 } });
    expect(await walletOf(nurse)).toMatchObject({ a: 425_000 });
  }, 60_000);

  it('refuses unfinished, cash and inconsistent bookings; nothing is written when the escrow does not match', async () => {
    const nurse = await createNurse(300_000, null);
    const running = await heldShift(nurse, { checkoutHoursAgo: null, status: 'IN_PROGRESS' });
    await expect(service.confirmCompletion(customer.id, running.id)).rejects.toMatchObject({ code: 'SHIFT_NOT_FINISHED' });
    const cash = await heldShift(nurse, { payment: 'CASH' });
    await expect(service.confirmCompletion(customer.id, cash.id)).rejects.toMatchObject({ status: 400, code: 'NOT_TRANSFER_BOOKING' });

    const broken = await heldShift(nurse, { hold: false }); // ESCROW_HELD on paper, no money in the ledger
    await expect(tx((db) => settleShift(db, broken.id, 'COOLING_ELAPSED', Date.now()))).rejects.toBeInstanceOf(SettlementInconsistencyError);
    expect(await bookingOf(broken.id)).toMatchObject({ p: 'ESCROW_HELD', settled_at: null });
    expect(await walletOf(nurse)).toMatchObject({ a: 0 });

    // The sweep alerts once and puts it on hold, so it never blocks the batches behind it again.
    const first = await service.runSweep();
    expect(first.failed).toBeGreaterThanOrEqual(1);
    const hold = async () => (await pool.query(`SELECT resolved_at FROM settlement_holds WHERE booking_id = $1`, [broken.id])).rows;
    expect(await hold()).toEqual([{ resolved_at: null }]);
    await expect(service.resolveHold(admin, broken.id, 'ngắn')).rejects.toMatchObject({ status: 400 });
    await service.resolveHold(admin, broken.id, 'Escrow kiểm tra lại với cổng thanh toán, booking thử nghiệm');
    expect((await hold())[0].resolved_at).not.toBeNull();
    await expect(service.resolveHold(admin, broken.id, 'Escrow kiểm tra lại lần hai')).rejects.toMatchObject({ status: 404 });
  }, 60_000);

  it('cancellation shares kept in escrow (row 2: 15% nurse / 5% platform) are paid once and marked DONE', async () => {
    const nurse = await createNurse(300_000, null);
    const b = await heldShift(nurse, { status: 'CANCELLED', checkoutHoursAgo: null });
    await tx((db) => refundEscrow(db, { customerId: customer.id, bookingId: b.id, amount: 400_000, idempotencyKey: `escrow-refund:cancel:${b.id}`, externalRef: null }));
    await pool.query(
      `INSERT INTO cancellation_outcomes (booking_id, scenario, actor, cancelled_by, hours_before_start, payment_method, amount_paid,
                                          fee_amount, fee_collected, refund_amount, nurse_compensation, platform_share, settlement_status)
       VALUES ($1, 'CUSTOMER_CANCEL_NEAR', 'CUSTOMER', $2, 5, 'BANK_TRANSFER', 500000, 100000, TRUE, 400000, 75000, 25000, 'PENDING')`,
      [b.id, customer.id],
    );

    // A cancelled booking is never settled as a shift.
    expect(await tx((db) => settleShift(db, b.id, 'CUSTOMER_CONFIRMED', Date.now()))).toEqual({ settled: false, reason: 'NOTHING_PENDING' });

    const r = await tx((db) => settleCancellationShare(db, b.id, Date.now()));
    expect(r).toMatchObject({ settled: true, kind: 'CANCELLATION', split: { gross: 100_000, commission: 25_000, net: 75_000, payout: 75_000, graceShift: false } });
    expect(await walletOf(nurse)).toEqual({ a: 75_000, d: 300_000, g: 0 });
    expect(await heldFor(b.id)).toBe(0);
    expect((await pool.query(`SELECT settlement_status FROM cancellation_outcomes WHERE booking_id = $1`, [b.id])).rows[0].settlement_status).toBe('DONE');
    expect(await tx((db) => settleCancellationShare(db, b.id, Date.now()))).toEqual({ settled: false, reason: 'NOTHING_PENDING' });
  });
});
