import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { holdEscrow } from '../../src/modules/gateway-webhooks/gateway-webhooks.ledger';
import { CancellationPolicyService } from '../../src/modules/cancellation-policy/cancellation-policy.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * cancellation-policy on real PostgreSQL 16 (SRS §5.2 rows 1–3): the cancel, the partial refund through BE-3's
 * escrow ledger, the cancellation_outcomes row (migration 0014) and GET /refunds. Fixed clock and rules.
 * (Test users are not deleted.)
 */
describe('cancellation-policy (integration)', () => {
  let pool: Pool;
  let customerId: string;
  let profileId: string;
  let serviceId: string;
  let slot = 0;
  let now = 0;
  const HOUR = 3_600_000;
  const CONFIG: Record<string, number> = {
    CUSTOMER_CANCEL_FREE_HOURS: 12,
    CUSTOMER_CANCEL_LATE_HOURS: 2,
    CUSTOMER_CANCEL_NEAR_FEE_RATE: 0.2,
    CUSTOMER_CANCEL_NEAR_NURSE_RATE: 0.15,
    CUSTOMER_CANCEL_LATE_FEE_RATE: 0.5,
    CUSTOMER_CANCEL_LATE_NURSE_RATE: 0.4,
    NURSE_CANCEL_FREE_HOURS: 12,
    NURSE_LATE_CANCEL_FINE_RATE: 0.2,
    NO_SHOW_GRACE_MINUTES: 30,
    NO_SHOW_PENALTY: 50_000,
    ICU_TRAVEL_SUPPORT: 50_000,
    TRUST_PENALTY_NURSE_CANCEL_EARLY: 5,
    TRUST_PENALTY_NURSE_CANCEL_LATE: 20,
    MIN_BILLABLE_HOURS: 1,
  };

  const service = () =>
    new CancellationPolicyService({
      read: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      getNumber: async (k) => {
        if (CONFIG[k] === undefined) throw new Error(`missing ${k}`);
        return CONFIG[k]!;
      },
      now: () => now,
    });

  beforeAll(async () => {
    pool = createTestPool();
    customerId = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, location_type, data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Bệnh nhân test', 'HOME', TRUE, now()) RETURNING id`,
      [customerId],
    );
    profileId = p.rows[0].id;
    serviceId = (await pool.query("SELECT id FROM service_categories WHERE code = 'SRV_SHIFT_4H'")).rows[0].id;
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

  /** A 400,000 VND booking starting `hoursAhead` after "now" (each on its own day). */
  async function booking(opts: { hoursAhead: number; payment?: 'BANK_TRANSFER' | 'CASH'; status?: string; nurse?: boolean }): Promise<string> {
    slot += 1;
    const start = Date.UTC(2027, 4, slot, 2, 0, 0);
    now = start - opts.hoursAhead * HOUR;
    const payment = opts.payment ?? 'BANK_TRANSFER';
    const nurseId = opts.nurse === false ? null : await createNurse();
    const status = opts.status ?? (nurseId ? 'CONFIRMED' : 'MATCHING');
    const prepaid = payment === 'BANK_TRANSFER' && status !== 'DRAFT';
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, 400000, 400000,
               $9::execution_status_enum, $10::payment_status_enum)
       RETURNING id`,
      [`HC-C${randomUUID().slice(0, 10)}`, customerId, profileId, nurseId, serviceId, payment, new Date(start), new Date(start + 4 * HOUR), status, prepaid ? 'ESCROW_HELD' : 'UNPAID'],
    );
    const id = rows[0].id;
    if (prepaid) {
      await runInTransaction(pool, (db) =>
        holdEscrow(db, { customerId, bookingId: id, amount: 400_000, idempotencyKey: `test-hold:${id}`, externalRef: null }),
      );
    }
    return id;
  }

  const row = async (id: string) =>
    (await pool.query('SELECT execution_status, payment_status, cancelled_by, cancellation_reason FROM bookings WHERE id = $1', [id])).rows[0];
  const ledger = async (id: string) =>
    (await pool.query("SELECT tx_type, amount FROM wallet_transactions WHERE booking_id = $1 ORDER BY created_at", [id])).rows.map(
      (r) => [r.tx_type, Number(r.amount)],
    );
  const outcome = async (id: string) => (await pool.query('SELECT * FROM cancellation_outcomes WHERE booking_id = $1', [id])).rows[0];

  async function codeOf(p: Promise<unknown>): Promise<string> {
    try {
      await p;
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      return (e as AppError).code;
    }
    throw new Error('expected an AppError');
  }

  it('row 1: more than 12h ahead — 100% refunded, REFUNDED, nothing pending', async () => {
    const id = await booking({ hoursAhead: 24 });
    const preview = await service().preview(customerId, id);
    expect(preview).toMatchObject({ scenario: 'CUSTOMER_CANCEL_EARLY', refundAmount: 400_000, refundPercent: 100, hoursBeforeStart: 24 });

    const res = await service().cancel(customerId, id);

    expect(res.booking).toMatchObject({ executionStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });
    expect(await row(id)).toMatchObject({ execution_status: 'CANCELLED', payment_status: 'REFUNDED', cancelled_by: customerId, cancellation_reason: 'CUSTOMER_CANCEL_EARLY' });
    expect(await ledger(id)).toEqual([['ESCROW_HOLD', 400_000], ['REFUND', 400_000]]);
    expect(await outcome(id)).toMatchObject({ scenario: 'CUSTOMER_CANCEL_EARLY', settlement_status: 'NOT_APPLICABLE' });
  });

  it('row 2: 5h ahead — 80% refunded; 15% nurse + 5% platform stay in escrow, PENDING settlement', async () => {
    const id = await booking({ hoursAhead: 5 });
    const res = await service().cancel(customerId, id);

    expect(res.outcome).toMatchObject({ scenario: 'CUSTOMER_CANCEL_NEAR', refundAmount: 320_000, nurseCompensation: 60_000, platformShare: 20_000 });
    expect(res.booking.paymentStatus).toBe('ESCROW_HELD');
    expect(await ledger(id)).toEqual([['ESCROW_HOLD', 400_000], ['REFUND', 320_000]]);
    const o = await outcome(id);
    expect(o.settlement_status).toBe('PENDING');
    expect([Number(o.refund_amount), Number(o.nurse_compensation), Number(o.platform_share)]).toEqual([320_000, 60_000, 20_000]);
    expect(res.refund).toMatchObject({ scenario: 'CUSTOMER_CANCEL_NEAR', amountPaid: 400_000, refundAmount: 320_000, refundPercent: 80 });
  });

  it('row 3: 1h ahead — 50% refunded, 40% nurse, 10% platform', async () => {
    const id = await booking({ hoursAhead: 1 });
    const res = await service().cancel(customerId, id);
    expect(res.outcome).toMatchObject({ scenario: 'CUSTOMER_CANCEL_LATE', refundAmount: 200_000, nurseCompensation: 160_000, platformShare: 40_000 });
    expect(await ledger(id)).toEqual([['ESCROW_HOLD', 400_000], ['REFUND', 200_000]]);
  });

  it('cash, 1h ahead: nothing refunded, the fee is recorded only', async () => {
    const id = await booking({ hoursAhead: 1, payment: 'CASH' });
    const res = await service().cancel(customerId, id);
    expect(res.refund).toBeNull();
    expect(res.outcome).toMatchObject({ feeAmount: 200_000, feeCollected: false, refundAmount: 0 });
    expect(await ledger(id)).toEqual([]);
    expect(await outcome(id)).toMatchObject({ fee_collected: false, settlement_status: 'NOT_APPLICABLE' });
  });

  it('still MATCHING (no nurse yet) 1h ahead: row 1, full refund, open offers closed', async () => {
    const id = await booking({ hoursAhead: 1, nurse: false });
    const other = await createNurse();
    await pool.query("INSERT INTO booking_offers (booking_id, nurse_id, offer_type, status) VALUES ($1, $2, 'JOB_BOARD', 'SENT')", [id, other]);

    const res = await service().cancel(customerId, id);

    expect(res.outcome.scenario).toBe('CUSTOMER_CANCEL_EARLY');
    expect(res.booking.paymentStatus).toBe('REFUNDED');
    const offers = await pool.query('SELECT status FROM booking_offers WHERE booking_id = $1', [id]);
    expect(offers.rows.map((r) => r.status)).toEqual(['EXPIRED']);
  });

  it('refuses a running shift, a second cancel, and someone else\'s booking', async () => {
    const running = await booking({ hoursAhead: -1, status: 'IN_PROGRESS' });
    expect(await codeOf(service().cancel(customerId, running))).toBe('SHIFT_IN_PROGRESS');
    expect(await codeOf(service().preview(customerId, running))).toBe('SHIFT_IN_PROGRESS');

    const id = await booking({ hoursAhead: 24 });
    await service().cancel(customerId, id);
    expect(await codeOf(service().cancel(customerId, id))).toBe('BOOKING_NOT_CANCELLABLE');
    expect(await ledger(id)).toEqual([['ESCROW_HOLD', 400_000], ['REFUND', 400_000]]);

    const stranger = await createTestUser(pool);
    expect(await codeOf(service().preview(stranger, id))).toBe('BOOKING_NOT_FOUND');
    expect(await codeOf(service().cancel(stranger, 'not-a-uuid'))).toBe('BOOKING_NOT_FOUND');
  });

  it('two concurrent cancels: one wins, one refund', async () => {
    const id = await booking({ hoursAhead: 24 });
    const results = await Promise.allSettled([service().cancel(customerId, id), service().cancel(customerId, id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await ledger(id)).filter(([t]) => t === 'REFUND')).toHaveLength(1);
  });

  it('GET /refunds lists the customer\'s refunds, newest first, with their scenario', async () => {
    const items = await service().listRefunds(customerId);
    expect(items.length).toBeGreaterThan(0);
    const near = items.find((i) => i.scenario === 'CUSTOMER_CANCEL_NEAR')!;
    expect(near).toMatchObject({ amountPaid: 400_000, refundAmount: 320_000, refundPercent: 80, nurseCompensation: 60_000, platformShare: 20_000, status: 'REFUNDED' });
    const stranger = await createTestUser(pool);
    expect(await service().listRefunds(stranger)).toEqual([]);
  });
});
