import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { NurseCancelService } from '../../src/modules/cancellation-policy/cancellation-policy.nurse';
import { createTestPool, createTestUser } from './helpers';

/**
 * Nurse gives back an accepted shift (SRS §5.2 rows 6–7) on real PostgreSQL 16: booking back to MATCHING,
 * TrustScore event, row-7 fine from the deposit (deposits.deductPenalty) + urgent bonus, redispatch scheduled.
 * Fixed clock and rules. (Test users are not deleted.)
 */
describe('cancellation-policy — nurse cancel (integration)', () => {
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
    TRUST_SUSPEND_BELOW: 60,
    PENALTY_APPEAL_DAYS: 3,
  };
  const scheduled: { jobName: string; payload: any; key: string }[] = [];
  const notices: { userId: string; type: string }[] = [];

  const service = () =>
    new NurseCancelService({
      read: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      getNumber: async (k) => {
        if (CONFIG[k] === undefined) throw new Error(`missing ${k}`);
        return CONFIG[k]!;
      },
      scheduler: {
        async scheduleJob(jobName: string, payload: unknown, _runAt: Date, key: string) {
          scheduled.push({ jobName, payload, key });
          return {};
        },
      },
      notify: async (n) => void notices.push({ userId: n.userId, type: n.type }),
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

  async function createNurse(score = 100): Promise<string> {
    const phone = `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng test', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    await pool.query("INSERT INTO nurse_profiles (user_id, profile_status, trust_score) VALUES ($1, 'ACTIVE', $2)", [rows[0].id, score]);
    return rows[0].id;
  }

  /** A 400,000 VND cash shift for `nurseId`, starting `hoursAhead` after "now" (own day each, 2029). */
  async function confirmed(nurseId: string, hoursAhead: number, status = 'CONFIRMED'): Promise<string> {
    slot += 1;
    const start = Date.UTC(2029, 0, slot, 2, 0, 0);
    now = start - hoursAhead * HOUR;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status, payment_status, prescription_verified_by_nurse)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'CASH', $6, $7, 400000, 400000, $8::execution_status_enum, 'UNPAID', TRUE)
       RETURNING id`,
      [`HC-N${randomUUID().slice(0, 10)}`, customerId, profileId, nurseId, serviceId, new Date(start), new Date(start + 4 * HOUR), status],
    );
    return rows[0].id;
  }

  const booking = async (id: string) =>
    (await pool.query('SELECT execution_status, nurse_id, urgent_bonus_amount, prescription_verified_by_nurse FROM bookings WHERE id = $1', [id])).rows[0];
  const deposit = async (nurseId: string) =>
    Number((await pool.query('SELECT deposit_balance FROM wallets WHERE user_id = $1', [nurseId])).rows[0]?.deposit_balance ?? 0);
  const score = async (nurseId: string) =>
    (await pool.query('SELECT trust_score, profile_status FROM nurse_profiles WHERE user_id = $1', [nurseId])).rows[0];

  async function codeOf(p: Promise<unknown>): Promise<string> {
    try {
      await p;
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      return (e as AppError).code;
    }
    throw new Error('expected an AppError');
  }

  it('early (> 12 h): back to MATCHING, −5 TrustScore, no fine, redispatch scheduled, both sides told', async () => {
    const nurse = await createNurse();
    const id = await confirmed(nurse, 24);

    await expect(service().preview(nurse, id)).resolves.toMatchObject({ scenario: 'NURSE_CANCEL_EARLY', fine: 0, trustScoreDelta: -5, freeHours: 12 });
    const r = await service().cancel(nurse, id, 'Ốm đột xuất');
    expect(r).toMatchObject({ scenario: 'NURSE_CANCEL_EARLY', fine: 0, trustScoreDelta: -5, trustScore: 95, suspended: false, penaltyTransactionId: null });

    expect(await booking(id)).toMatchObject({ execution_status: 'MATCHING', nurse_id: null, prescription_verified_by_nurse: false });
    expect(Number((await booking(id)).urgent_bonus_amount)).toBe(0);
    expect(await score(nurse)).toMatchObject({ trust_score: 95 });
    expect(await deposit(nurse)).toBe(0);
    expect(scheduled.find((j) => j.key === `redispatch:${id}:${nurse}`)).toMatchObject({
      jobName: 'matching-radar.redispatch',
      payload: { bookingId: id, releasedNurseId: nurse, reason: 'NURSE_CANCELLED', matchingMode: 'JOB_BOARD' },
    });
    expect(notices.filter((n) => n.userId === customerId).at(-1)?.type).toBe('BOOKING_NURSE_CANCELLED');
    const row = (await pool.query('SELECT scenario, reason, fine_amount FROM nurse_cancellations WHERE booking_id = $1', [id])).rows[0];
    expect(row).toMatchObject({ scenario: 'NURSE_CANCEL_EARLY', reason: 'Ốm đột xuất' });
  });

  it('urgent (≤ 12 h): −20, 20% fine from the deposit (debt allowed), same amount as urgent bonus', async () => {
    const nurse = await createNurse();
    const id = await confirmed(nurse, 3);
    const r = await service().cancel(nurse, id, 'Kẹt xe');
    expect(r).toMatchObject({ scenario: 'NURSE_CANCEL_URGENT', fine: 80_000, finePercent: 20, trustScoreDelta: -20, trustScore: 80 });
    expect(r.penaltyTransactionId).toEqual(expect.any(String));

    expect(await deposit(nurse)).toBe(-80_000);
    expect(Number((await booking(id)).urgent_bonus_amount)).toBe(80_000);
    const tx = (await pool.query('SELECT tx_type, amount FROM wallet_transactions WHERE id = $1', [r.penaltyTransactionId])).rows[0];
    expect(tx).toMatchObject({ tx_type: 'PENALTY_DEDUCT' });
    expect(Number(tx.amount)).toBe(80_000);
  });

  it('exactly 12 h before the start is already urgent (boundary)', async () => {
    const nurse = await createNurse();
    const id = await confirmed(nurse, 12);
    await expect(service().preview(nurse, id)).resolves.toMatchObject({ scenario: 'NURSE_CANCEL_URGENT' });
  });

  it('a second nurse who takes the same booking and also gives it back is fined separately; bonuses add up', async () => {
    const a = await createNurse();
    const b = await createNurse();
    const id = await confirmed(a, 5);
    await service().cancel(a, id, 'Lý do A');
    await pool.query("UPDATE bookings SET nurse_id = $2, execution_status = 'CONFIRMED' WHERE id = $1", [id, b]);
    const r = await service().cancel(b, id, 'Lý do B');
    expect(r.fine).toBe(80_000);
    expect(await deposit(b)).toBe(-80_000);
    expect(Number((await booking(id)).urgent_bonus_amount)).toBe(160_000);
    expect((await pool.query('SELECT count(*)::int AS n FROM nurse_cancellations WHERE booking_id = $1', [id])).rows[0].n).toBe(2);
  });

  it('falling below 60 suspends the nurse', async () => {
    const nurse = await createNurse(70);
    const id = await confirmed(nurse, 2);
    await expect(service().cancel(nurse, id, 'Bận việc')).resolves.toMatchObject({ trustScore: 50, suspended: true });
    expect((await score(nurse)).profile_status).toBe('SUSPENDED');
  });

  it('refuses: another nurse (404), already started (422), in progress (409), cancelled (409); TrustScore untouched', async () => {
    const nurse = await createNurse();
    const other = await createNurse();
    const id = await confirmed(nurse, 5);
    expect(await codeOf(service().cancel(other, id, 'x'))).toBe('BOOKING_NOT_FOUND');
    expect(await codeOf(service().cancel(nurse, 'not-a-uuid', 'x'))).toBe('BOOKING_NOT_FOUND');

    now += 5 * HOUR; // start time reached
    expect(await codeOf(service().cancel(nurse, id, 'x'))).toBe('SHIFT_ALREADY_STARTED');

    const running = await confirmed(nurse, -1, 'IN_PROGRESS');
    expect(await codeOf(service().cancel(nurse, running, 'x'))).toBe('SHIFT_IN_PROGRESS');
    const gone = await confirmed(nurse, 10, 'CANCELLED');
    expect(await codeOf(service().preview(nurse, gone))).toBe('BOOKING_NOT_CANCELLABLE');
    expect(await score(nurse)).toMatchObject({ trust_score: 100 });
  });
});
