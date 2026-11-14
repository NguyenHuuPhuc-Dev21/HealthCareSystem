import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { runInTransaction } from '../../src/core/database';
import { recalculateNurseRatingAvg } from '../../src/modules/reviews-trustscore/reviews-trustscore.repo';
import { createTestPool, createTestUser } from './helpers';

/**
 * reviews-trustscore on real PostgreSQL 16: the cached nurse rating (FR-RATE-01, FR-SEARCH-01).
 * Only visible customer reviews on COMPLETED bookings count.
 * (Test users are not deleted: other tests' audit rows may reference users.)
 */
describe('reviews-trustscore — cached rating_avg (integration)', () => {
  let pool: Pool;
  let customerId: string;
  let profileId: string;
  let serviceId: string;
  let slot = 0;

  beforeAll(async () => {
    pool = createTestPool();
    customerId = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, location_type, data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Bệnh nhân test', 'HOME', TRUE, now()) RETURNING id`,
      [customerId],
    );
    profileId = p.rows[0].id;
    const s = await pool.query(
      "SELECT id FROM service_categories WHERE NOT is_invasive AND NOT is_prohibited ORDER BY code LIMIT 1",
    );
    serviceId = s.rows[0].id;
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

  /** One past booking for the nurse; each call uses its own day so shifts never overlap. */
  async function createBooking(nurseId: string, status = 'COMPLETED'): Promise<string> {
    slot += 1;
    const start = new Date(Date.UTC(2026, 0, slot, 2, 0, 0));
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'BANK_TRANSFER', $6, $7, 300000, 300000, $8::execution_status_enum)
       RETURNING id`,
      [`R-${randomUUID().slice(0, 12)}`, customerId, profileId, nurseId, serviceId, start, new Date(start.getTime() + 7_200_000), status],
    );
    return rows[0].id;
  }

  /** Customer → nurse review. */
  async function review(nurseId: string, rating: number, opts: { visible?: boolean; status?: string } = {}): Promise<string> {
    const bookingId = await createBooking(nurseId, opts.status);
    const { rows } = await pool.query(
      `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, reviewer_role, rating, is_visible)
       VALUES ($1, $2, $3, 'PATIENT', $4, $5) RETURNING id`,
      [bookingId, customerId, nurseId, rating, opts.visible ?? true],
    );
    return rows[0].id;
  }

  const stored = async (nurseId: string) =>
    Number((await pool.query('SELECT rating_avg FROM nurse_profiles WHERE user_id = $1', [nurseId])).rows[0].rating_avg);

  it('stores 0 for a nurse with no reviews', async () => {
    const nurse = await createNurse();
    await expect(recalculateNurseRatingAvg(pool, nurse)).resolves.toBe(0);
    expect(await stored(nurse)).toBe(0);
  });

  it('averages visible reviews on COMPLETED bookings, rounded to 2 decimals', async () => {
    const nurse = await createNurse();
    await review(nurse, 5);
    await review(nurse, 4);
    await review(nurse, 4);

    await expect(recalculateNurseRatingAvg(pool, nurse)).resolves.toBe(4.33);
    expect(await stored(nurse)).toBe(4.33);
  });

  it('ignores blind reviews, reviews on bookings that are not COMPLETED, and the nurse\'s own review of the customer', async () => {
    const nurse = await createNurse();
    await review(nurse, 5);
    await review(nurse, 1, { visible: false }); // still blind
    await review(nurse, 1, { status: 'CANCELLED' }); // booking never completed
    const bookingId = await createBooking(nurse);
    await pool.query(
      `INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, reviewer_role, rating, is_visible)
       VALUES ($1, $2, $3, 'NURSE', 1, TRUE)`,
      [bookingId, nurse, customerId], // nurse rates the customer: not the nurse's rating
    );

    await expect(recalculateNurseRatingAvg(pool, nurse)).resolves.toBe(5);
  });

  it('follows the reviews when one becomes visible, and does not touch other nurses', async () => {
    const nurse = await createNurse();
    const other = await createNurse();
    await review(other, 2);
    await recalculateNurseRatingAvg(pool, other);
    await review(nurse, 5);
    const blind = await review(nurse, 2, { visible: false });
    await expect(recalculateNurseRatingAvg(pool, nurse)).resolves.toBe(5);

    await runInTransaction(pool, async (tx) => {
      await tx.query('UPDATE reviews SET is_visible = TRUE WHERE id = $1', [blind]);
      await recalculateNurseRatingAvg(tx, nurse);
    });

    expect(await stored(nurse)).toBe(3.5);
    expect(await stored(other)).toBe(2);
  });

  it('rolls back together with the transaction that changed the reviews', async () => {
    const nurse = await createNurse();
    await review(nurse, 4);
    await recalculateNurseRatingAvg(pool, nurse);
    const blind = await review(nurse, 1, { visible: false });

    await expect(
      runInTransaction(pool, async (tx) => {
        await tx.query('UPDATE reviews SET is_visible = TRUE WHERE id = $1', [blind]);
        await recalculateNurseRatingAvg(tx, nurse);
        throw new Error('simulated failure after recalculation');
      }),
    ).rejects.toThrow('simulated failure');

    expect(await stored(nurse)).toBe(4);
  });

  it('returns null for a user without a nurse profile', async () => {
    await expect(recalculateNurseRatingAvg(pool, customerId)).resolves.toBeNull();
  });
});
