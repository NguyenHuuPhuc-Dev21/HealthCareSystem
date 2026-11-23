import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { UserRole } from '@healthcare-system/shared';
import { runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { ReviewsService, applyTrustScoreChange } from '../../src/modules/reviews-trustscore/reviews-trustscore.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * reviews-trustscore on real PostgreSQL 16 (FR-RATE-01): blind two-way reviews, reveal (both sides or
 * 7 days), cached rating, +2 recovery, TrustScore events, auto-suspension below 60.
 * Fixed clock and rules. (Test users are not deleted.)
 */
describe('reviews-trustscore — reviews and TrustScore (integration)', () => {
  let pool: Pool;
  let customerId: string;
  let profileId: string;
  let serviceId: string;
  let slot = 0;
  let now = 0;
  const DAY = 86_400_000;
  const CONFIG: Record<string, number> = {
    REVIEW_BLIND_DAYS: 7,
    REVIEW_WINDOW_DAYS: 7,
    TRUST_RECOVERY_GOOD_RATING: 2,
    TRUST_RECOVERY_MIN_STARS: 4,
    TRUST_SUSPEND_BELOW: 60,
  };

  const service = () =>
    new ReviewsService({
      read: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      getNumber: async (k) => {
        if (CONFIG[k] === undefined) throw new Error(`missing ${k}`);
        return CONFIG[k]!;
      },
      now: () => now,
    });

  const asCustomer = () => ({ id: customerId, role: UserRole.PATIENT });
  const asNurse = (id: string) => ({ id, role: UserRole.NURSE });

  beforeAll(async () => {
    pool = createTestPool();
    customerId = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, location_type, data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Bệnh nhân test', 'HOME', TRUE, now()) RETURNING id`,
      [customerId],
    );
    profileId = p.rows[0].id;
    serviceId = (await pool.query('SELECT id FROM service_categories WHERE NOT is_invasive AND NOT is_prohibited ORDER BY code LIMIT 1')).rows[0].id;
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

  /** A 2-hour shift on its own day (2028); returns the booking and its end. "now" = 1 hour after the end. */
  async function completedShift(nurseId: string, status = 'COMPLETED'): Promise<{ id: string; end: number }> {
    slot += 1;
    const start = Date.UTC(2028, 0, slot, 2, 0, 0);
    const end = start + 2 * 3_600_000;
    now = end + 3_600_000;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'CASH', $6, $7, 300000, 300000, $8::execution_status_enum)
       RETURNING id`,
      [`RV-${randomUUID().slice(0, 12)}`, customerId, profileId, nurseId, serviceId, new Date(start), new Date(end), status],
    );
    return { id: rows[0].id, end };
  }

  const nurseRow = async (id: string) =>
    (await pool.query('SELECT trust_score, rating_avg, profile_status, suspended_reason FROM nurse_profiles WHERE user_id = $1', [id])).rows[0];
  const visible = async (bookingId: string) =>
    (await pool.query('SELECT reviewer_role, is_visible FROM reviews WHERE booking_id = $1 ORDER BY reviewer_role', [bookingId])).rows;

  async function codeOf(p: Promise<unknown>): Promise<string> {
    try {
      await p;
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      return (e as AppError).code;
    }
    throw new Error('expected an AppError');
  }

  it('one side reviews → stays blind; the other side reviews → both visible, rating cached, +2 recovery', async () => {
    const nurse = await createNurse(90);
    const b = await completedShift(nurse);

    const first = await service().submit(asCustomer(), b.id, { rating: 5, comment: 'Rất tận tâm', tags: ['Đúng giờ'] });
    expect(first.isVisible).toBe(false);
    expect(await visible(b.id)).toEqual([{ reviewer_role: 'PATIENT', is_visible: false }]);
    expect(await service().receivedBy(nurse)).toEqual([]); // blind reviews never leave the server
    expect(Number((await nurseRow(nurse)).rating_avg)).toBe(0);

    const second = await service().submit(asNurse(nurse), b.id, { rating: 4 });
    expect(second.isVisible).toBe(true);
    expect((await visible(b.id)).every((r: { is_visible: boolean }) => r.is_visible)).toBe(true);

    const row = await nurseRow(nurse);
    expect(Number(row.rating_avg)).toBe(5);
    expect(row.trust_score).toBe(92);

    const ts = await service().trustScore(nurse);
    expect(ts).toMatchObject({ score: 92, ratingAvg: 5, ratingCount: 1, ratingDistribution: { star5: 1, star4: 0 } });
    expect(ts.history[0]).toMatchObject({ delta: 2, reason: 'GOOD_RATING_RECOVERY' });
    expect((await service().receivedBy(nurse))[0]).toMatchObject({ rating: 5, comment: 'Rất tận tâm', isVisible: true });
  });

  it('a second review by the same side → 409 ALREADY_REVIEWED', async () => {
    const nurse = await createNurse();
    const b = await completedShift(nurse);
    await service().submit(asCustomer(), b.id, { rating: 3 });
    expect(await codeOf(service().submit(asCustomer(), b.id, { rating: 5 }))).toBe('ALREADY_REVIEWED');
  });

  it('refuses: not COMPLETED (422), window closed (422), a stranger (404)', async () => {
    const nurse = await createNurse();
    const running = await completedShift(nurse, 'IN_PROGRESS');
    expect(await codeOf(service().submit(asCustomer(), running.id, { rating: 5 }))).toBe('BOOKING_NOT_COMPLETED');

    const b = await completedShift(nurse);
    now = b.end + 7 * DAY;
    expect(await codeOf(service().submit(asCustomer(), b.id, { rating: 5 }))).toBe('REVIEW_WINDOW_CLOSED');

    now = b.end + DAY;
    const stranger = await createNurse();
    expect(await codeOf(service().submit(asNurse(stranger), b.id, { rating: 5 }))).toBe('BOOKING_NOT_FOUND');
    expect(await codeOf(service().submit(asCustomer(), 'not-a-uuid', { rating: 5 }))).toBe('BOOKING_NOT_FOUND');
  });

  it('the window counts from check-out when there is one', async () => {
    const nurse = await createNurse();
    const b = await completedShift(nurse);
    await pool.query('INSERT INTO shift_logs (booking_id, checkin_time, checkout_time) VALUES ($1, $2, $3)', [
      b.id,
      new Date(b.end - 2 * 3_600_000),
      new Date(b.end + DAY), // checked out a day late
    ]);
    now = b.end + 7 * DAY + 1; // past end_time + 7 days, but within check-out + 7 days
    await expect(service().submit(asCustomer(), b.id, { rating: 4 })).resolves.toMatchObject({ isVisible: false });
  });

  it('reveal sweep: reveals after 7 days only, a low rating gives no recovery, and a re-run is a no-op', async () => {
    const nurse = await createNurse(80);
    const b = await completedShift(nurse);
    await service().submit(asCustomer(), b.id, { rating: 2 });

    now = b.end + 7 * DAY - 1;
    await service().revealSweep();
    expect(await visible(b.id)).toEqual([{ reviewer_role: 'PATIENT', is_visible: false }]);

    now = b.end + 7 * DAY;
    await service().revealSweep();
    expect(await visible(b.id)).toEqual([{ reviewer_role: 'PATIENT', is_visible: true }]);
    const row = await nurseRow(nurse);
    expect(Number(row.rating_avg)).toBe(2);
    expect(row.trust_score).toBe(80);

    await service().revealSweep();
    expect((await nurseRow(nurse)).trust_score).toBe(80);
  });

  it('pending / sent lists for the nurse', async () => {
    const nurse = await createNurse();
    const a = await completedShift(nurse);
    const b = await completedShift(nurse);
    await service().submit(asNurse(nurse), a.id, { rating: 5, tags: ['Hợp tác tốt'] });

    const pending = await service().pendingForNurse(nurse);
    expect(pending.map((p) => p.bookingId)).toEqual([b.id]);
    expect(pending[0]!.expiresAt).toBe(new Date(b.end + 7 * DAY).toISOString());

    const sent = await service().sentBy(nurse);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ rating: 5, tags: ['Hợp tác tốt'], isVisible: false });
  });

  it('applyTrustScoreChange: once per (nurse, reason, booking), clamps at 0, suspends below 60', async () => {
    const nurse = await createNurse(70);
    const b = await completedShift(nurse);
    const change = { nurseId: nurse, delta: -25, reason: 'DISPUTE_UPHELD' as const, bookingId: b.id };

    const out = await runInTransaction(pool, (db) => applyTrustScoreChange(db, change, 60));
    expect(out).toEqual({ applied: true, scoreBefore: 70, scoreAfter: 45, suspended: true });
    const again = await runInTransaction(pool, (db) => applyTrustScoreChange(db, change, 60));
    expect(again.applied).toBe(false);

    let row = await nurseRow(nurse);
    expect(row).toMatchObject({ trust_score: 45, profile_status: 'SUSPENDED', suspended_reason: 'TRUST_SCORE_BELOW_THRESHOLD' });

    // Recovery while suspended raises the score but never re-activates.
    await runInTransaction(pool, (db) =>
      applyTrustScoreChange(db, { nurseId: nurse, delta: 50, reason: 'ADMIN_ADJUSTMENT', note: 'test' }, 60),
    );
    row = await nurseRow(nurse);
    expect(row).toMatchObject({ trust_score: 95, profile_status: 'SUSPENDED' });

    const low = await runInTransaction(pool, (db) =>
      applyTrustScoreChange(db, { nurseId: nurse, delta: -200, reason: 'ADMIN_ADJUSTMENT' }, 60),
    );
    expect(low).toMatchObject({ scoreAfter: 0, suspended: false });
    const events = await pool.query('SELECT applied_delta FROM trust_score_events WHERE nurse_id = $1 ORDER BY created_at', [nurse]);
    expect(events.rows.map((r: { applied_delta: number }) => r.applied_delta)).toEqual([-25, 50, -95]);
  });

  it('trust_score_events is append-only', async () => {
    const nurse = await createNurse(100);
    await runInTransaction(pool, (db) => applyTrustScoreChange(db, { nurseId: nurse, delta: -5, reason: 'CANCEL_OVER_12H' }, 60));
    await expect(pool.query('UPDATE trust_score_events SET note = $2 WHERE nurse_id = $1', [nurse, 'x'])).rejects.toThrow(/append-only/);
    await expect(pool.query('DELETE FROM trust_score_events WHERE nurse_id = $1', [nurse])).rejects.toThrow(/append-only/);
  });
});
