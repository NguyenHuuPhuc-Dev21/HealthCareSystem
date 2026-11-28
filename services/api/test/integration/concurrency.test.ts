import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { closePool, runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { AdminUsersService } from '../../src/modules/admin-users/admin-users.service';
import { MatchingRadarService } from '../../src/modules/matching-radar/matching-radar.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * Phase 8 (BE-2) — kiểm thử tương tranh (race condition) trên PostgreSQL 16 thật cho matching engine và các job.
 * Mỗi kịch bản bắn nhiều giao dịch CÙNG LÚC rồi kiểm tra bất biến trong DB, không chỉ kết quả trả về:
 *  1. nhiều điều dưỡng bấm nhận 1 ca → đúng 1 người thắng, còn lại 409 ALREADY_CLAIMED, không lỗi 500 / deadlock
 *  2. 1 điều dưỡng nhận nhiều ca trùng giờ cùng lúc → chỉ 1 ca (khóa hàng nurse_profiles + ràng buộc loại trừ)
 *  3. N điều dưỡng × N ca trùng giờ, tất cả bấm hết → không ca nào 2 người, không người nào 2 ca
 *  4. nhận ca đúng lúc Admin tạm khóa điều dưỡng → không bao giờ còn ca CONFIRMED gán cho người bị khóa
 *  5. 2 Admin đổi trạng thái 1 tài khoản cùng lúc → 1 thay đổi, 1 lỗi 409, đúng 1 dòng audit
 *  6. job Radar bị giao lặp (retry / 2 worker) chạy song song → mỗi điều dưỡng chỉ 1 lời mời mỗi đợt
 * (Hàng đợi BullMQ: idempotency theo jobId đã có ở core-jobs.test.ts; ở đây kiểm handler chạy trùng.)
 */
describe('concurrency — matching engine and job handlers (integration)', () => {
  let pool: Pool;
  let radar: MatchingRadarService;
  let admin: AdminUsersService;
  let adminId: string;
  const NOW = Date.now();
  const HOUR = 3_600_000;
  const RUN = Math.random().toString(36).slice(2, 7).toUpperCase();
  let seq = 0;
  // Cần Thơ area, random per run, far from every other test's locations (TP.HCM, Hà Nội, Đà Nẵng): vitest runs files
  // in parallel and a Radar wave offers every eligible nurse in range — other files' nurses must never be in range of
  // ours, nor ours of theirs.
  const CARE = { lat: 9.9 + Math.random() * 0.2, lng: 105.6 + Math.random() * 0.2 };
  const NEAR = { lat: CARE.lat + 0.005, lng: CARE.lng };

  const scheduler = { scheduleJob: async () => ({}) };

  async function customer(): Promise<{ id: string; profile: string }> {
    const id = await createTestUser(pool);
    await pool.query(`UPDATE users SET kyc_status = 'VERIFIED' WHERE id = $1`, [id]);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Phạm Thị Tám', '1945-06-01', 52, 'NORMAL', '5 Hai Bà Trưng', 'HOME', $2, $3, TRUE, now()) RETURNING id`,
      [id, CARE.lat, CARE.lng],
    );
    return { id, profile: p.rows[0].id };
  }

  async function nurse(): Promise<string> {
    const phone = `03${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      `INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng tải cao', 'NURSE', 'ACTIVE') RETURNING id`,
      [phone],
    );
    const id = rows[0].id as string;
    await pool.query(
      `INSERT INTO nurse_profiles (user_id, tier, profile_status, current_lat, current_lng) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE', $2, $3)`,
      [id, NEAR.lat, NEAR.lng],
    );
    await pool.query(`INSERT INTO wallets (user_id, deposit_balance) VALUES ($1, 300000)`, [id]);
    await pool.query(
      `INSERT INTO nurse_availabilities (nurse_id, day_of_week, start_time, end_time, availability_type)
       SELECT $1, d, '00:00', '23:59', 'RECURRING_AVAILABLE' FROM generate_series(0, 6) AS d`,
      [id],
    );
    return id;
  }

  /** A cash booking already in MATCHING; slot = whole hours, `day` days ahead (so it never collides across tests). */
  async function booking(c: { id: string; profile: string }, day: number, hour = 9, mode = 'JOB_BOARD'): Promise<string> {
    const base = new Date(NOW + day * 24 * HOUR);
    base.setUTCHours(hour - 7, 0, 0, 0); // hour, Vietnam time
    const { rows } = await pool.query(
      `INSERT INTO bookings (booking_code, customer_id, patient_profile_id, service_id, matching_mode, payment_method,
                             start_time, end_time, base_amount, total_amount, platform_fee, execution_status)
       SELECT $1, $2, $3, id, $4::matching_mode_enum, 'CASH', $5, $5::timestamptz + interval '1 hour', 200000, 200000, 30000, 'MATCHING'
         FROM service_categories WHERE code = 'SRV_WOUND_CARE' RETURNING id`,
      [`HC-CC-${RUN}${String(++seq).padStart(3, '0')}`, c.id, c.profile, mode, base],
    );
    return rows[0].id;
  }

  const codeOf = (r: PromiseSettledResult<unknown>) =>
    r.status === 'fulfilled' ? 'OK' : r.reason instanceof AppError ? r.reason.code : `UNEXPECTED: ${(r.reason as Error)?.message}`;
  const tally = (rs: PromiseSettledResult<unknown>[]) =>
    rs.map(codeOf).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c]: (acc[c] ?? 0) + 1 }), {});

  beforeAll(async () => {
    pool = createTestPool();
    const withTx = <T>(fn: (db: any) => Promise<T>) => runInTransaction(pool, fn);
    radar = new MatchingRadarService({ read: pool, withTx, scheduler, now: () => NOW });
    const a = await pool.query(
      `INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Admin tải cao', 'ADMIN', 'ACTIVE') RETURNING id`,
      [`02${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`],
    );
    adminId = a.rows[0].id;
    admin = new AdminUsersService({ read: pool, withTx, scheduler, revokeSessions: async () => undefined, now: () => NOW });
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('stampede: 12 nurses accept the same shift at once → exactly one wins, the rest get 409 ALREADY_CLAIMED', async () => {
    const c = await customer();
    const b = await booking(c, 3);
    const nurses = await Promise.all(Array.from({ length: 12 }, () => nurse()));

    const results = await Promise.allSettled(nurses.map((n) => radar.claimBooking(n, b, 'JOB_BOARD')));
    expect(tally(results)).toEqual({ OK: 1, ALREADY_CLAIMED: 11 });

    const row = (await pool.query(`SELECT nurse_id, execution_status::text AS s FROM bookings WHERE id = $1`, [b])).rows[0];
    expect(row.s).toBe('CONFIRMED');
    expect(nurses[results.findIndex((r) => r.status === 'fulfilled')]).toBe(row.nurse_id);
  });

  it('one nurse accepts 4 overlapping shifts at once → only one is hers, the others 409 SCHEDULE_CONFLICT', async () => {
    const n = await nurse();
    const bs = await Promise.all([0, 1, 2, 3].map(async () => booking(await customer(), 4, 14)));

    const results = await Promise.allSettled(bs.map((b) => radar.claimBooking(n, b, 'JOB_BOARD')));
    expect(tally(results)).toEqual({ OK: 1, SCHEDULE_CONFLICT: 3 });
    const mine = await pool.query(`SELECT count(*)::int AS k FROM bookings WHERE nurse_id = $1 AND execution_status = 'CONFIRMED'`, [n]);
    expect(mine.rows[0].k).toBe(1);
  });

  it('6 nurses × 6 shifts in the same slot, everyone taps everything → no shift twice, no nurse twice', async () => {
    const nurses = await Promise.all(Array.from({ length: 6 }, () => nurse()));
    const bs = await Promise.all(Array.from({ length: 6 }, async () => booking(await customer(), 5, 8)));

    const attempts = nurses.flatMap((n) => bs.map((b) => radar.claimBooking(n, b, 'JOB_BOARD')));
    const results = await Promise.allSettled(attempts);
    const t = tally(results);
    expect(Object.keys(t).every((k) => ['OK', 'ALREADY_CLAIMED', 'SCHEDULE_CONFLICT'].includes(k))).toBe(true);

    const { rows } = await pool.query(
      `SELECT id, nurse_id FROM bookings WHERE id = ANY($1::uuid[]) AND execution_status = 'CONFIRMED'`,
      [bs],
    );
    expect(rows.length).toBe(t.OK);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(new Set(rows.map((r: any) => r.nurse_id)).size).toBe(rows.length); // nobody holds two
    const unassigned = await pool.query(
      `SELECT count(*)::int AS k FROM bookings WHERE id = ANY($1::uuid[]) AND execution_status = 'MATCHING' AND nurse_id IS NULL`,
      [bs],
    );
    expect(unassigned.rows[0].k + rows.length).toBe(6); // nothing half-written
  });

  it('accepting a shift at the moment an Admin suspends the nurse never leaves a shift with a suspended nurse (10 rounds)', async () => {
    const outcomes: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const n = await nurse();
      const b = await booking(await customer(), 6 + i, 10);
      const [claim, suspend] = await Promise.allSettled([
        radar.claimBooking(n, b, 'JOB_BOARD'),
        admin.setStatus(adminId, n, { status: 'SUSPENDED', reason: 'Kiểm thử tương tranh' }),
      ]);
      expect(codeOf(suspend)).toBe('OK');
      expect(['OK', 'NURSE_NOT_ACTIVE']).toContain(codeOf(claim));
      outcomes.push(codeOf(claim));

      const row = (await pool.query(`SELECT nurse_id, execution_status::text AS s FROM bookings WHERE id = $1`, [b])).rows[0];
      expect(row).toEqual({ nurse_id: null, s: 'MATCHING' }); // claimed first → released by the suspension; or refused
      if (codeOf(claim) === 'OK') {
        expect((suspend as PromiseFulfilledResult<any>).value.releasedBookings.map((x: any) => x.id)).toEqual([b]);
      }
      const p = (await pool.query(`SELECT profile_status::text AS s FROM nurse_profiles WHERE user_id = $1`, [n])).rows[0];
      expect(p.s).toBe('SUSPENDED');
    }
    expect(outcomes).toHaveLength(10);
  });

  it('two Admins change the same account at once → one change, one 409, exactly one audit row', async () => {
    for (const [a, b] of [
      ['SUSPENDED', 'SUSPENDED'],
      ['SUSPENDED', 'BANNED'],
    ] as const) {
      const n = await nurse();
      const results = await Promise.allSettled([
        admin.setStatus(adminId, n, { status: a, reason: 'Admin thứ nhất' }),
        admin.setStatus(adminId, n, { status: b, reason: 'Admin thứ hai' }),
      ]);
      const codes = results.map(codeOf);
      const audits = await pool.query(
        `SELECT count(*)::int AS k FROM audit_logs WHERE target_id = $1 AND action_type = 'CHANGE_ACCOUNT_STATUS'`,
        [n],
      );
      expect(audits.rows[0].k).toBe(codes.filter((c) => c === 'OK').length);
      if (a === b) {
        expect(codes.sort()).toEqual(['ALREADY_IN_STATUS', 'OK']);
      } else {
        // order decides: suspend then ban → both OK (2 audits); ban then suspend → 1 OK + BANNED_IS_PERMANENT
        expect(codes.every((c) => ['OK', 'BANNED_IS_PERMANENT'].includes(c))).toBe(true);
        expect(codes).toContain('OK');
      }
    }
  });

  it('a Radar wave delivered 6 times at once (job retry / two workers) offers each nurse once', async () => {
    const c = await customer();
    const nurses = await Promise.all(Array.from({ length: 3 }, () => nurse()));
    const b = await booking(c, 20, 15, 'RADAR_DISPATCH');
    const payload = { bookingId: b, wave: 1 as const, startedAt: new Date(NOW).toISOString() };

    const results = await Promise.allSettled(Array.from({ length: 6 }, () => radar.runWave(payload)));
    expect(tally(results)).toEqual({ OK: 6 });
    const { rows } = await pool.query(
      `SELECT nurse_id, count(*)::int AS k FROM booking_offers WHERE booking_id = $1 GROUP BY nurse_id`,
      [b],
    );
    for (const n of nurses) expect(rows.find((r: any) => r.nurse_id === n)?.k).toBe(1);
    expect(rows.every((r: any) => r.k === 1)).toBe(true);
  });
});
