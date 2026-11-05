import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { runInTransaction } from '../../src/core/database';
import { runGphnExpirySweep } from '../../src/modules/tier-lifecycle/tier-lifecycle.jobs';
import { REDISPATCH_JOB } from '../../src/modules/tier-lifecycle/tier-lifecycle.types';
import { createTestPool, createTestUser } from './helpers';

/**
 * tier-lifecycle trên PostgreSQL 16 thật (đã chạy migration 0001 → 0007 + seed dịch vụ).
 * Kiểm tra đúng câu SQL: hạ Tier, giữ ACTIVE, chỉ gỡ ca xâm lấn CONFIRMED trong tương lai,
 * ghi audit TIER_DEMOTION, chạy lại không đổi gì (RTM TC-AUTH-02).
 * Đồng hồ giả: "bây giờ" là 2026-11-05 00:05 giờ VN; các ca được đặt quanh mốc đó.
 * (User test không bị xóa: audit_logs tham chiếu tới họ.)
 */
describe('tier-lifecycle — GPHN expiry sweep (integration)', () => {
  let pool: Pool;
  let customerId: string;
  let profileId: string;
  let invasiveServiceId: string;
  let basicServiceId: string;
  const NOW = Date.parse('2026-11-04T17:05:00Z'); // 2026-11-05 00:05 Asia/Ho_Chi_Minh
  const HOUR = 3_600_000;

  beforeAll(async () => {
    pool = createTestPool();
    customerId = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, location_type, data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Bệnh nhân test', 'HOME', TRUE, now()) RETURNING id`,
      [customerId],
    );
    profileId = p.rows[0].id;
    const inv = await pool.query("SELECT id FROM service_categories WHERE is_invasive AND NOT is_prohibited ORDER BY code LIMIT 1");
    const basic = await pool.query("SELECT id FROM service_categories WHERE NOT is_invasive AND required_tier = 'TIER_1_BASIC' ORDER BY code LIMIT 1");
    invasiveServiceId = inv.rows[0].id;
    basicServiceId = basic.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createNurse(gphnExpiry: string | null, status = 'ACTIVE'): Promise<string> {
    const phone = `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng test', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    await pool.query(
      `INSERT INTO nurse_profiles (user_id, tier, gphn_number, gphn_expiry_date, profile_status)
       VALUES ($1, 'TIER_2_SPECIALIST', $2, $3::date, $4::profile_status_enum)`,
      [rows[0].id, `GPHN-${randomUUID().slice(0, 6)}`, gphnExpiry, status],
    );
    return rows[0].id;
  }

  async function createBooking(nurseId: string, serviceId: string, start: Date, status: string): Promise<string> {
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status, prescription_verified_by_nurse)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'BANK_TRANSFER', $6, $7, 300000, 300000, $8::execution_status_enum, TRUE)
       RETURNING id`,
      [`T-${randomUUID().slice(0, 12)}`, customerId, profileId, nurseId, serviceId, start, new Date(start.getTime() + 2 * HOUR), status],
    );
    return rows[0].id;
  }

  const scheduled: { jobName: string; payload: any; key: string }[] = [];
  const sweep = () =>
    runGphnExpirySweep({
      withTx: (fn) => runInTransaction(pool, fn),
      read: pool,
      scheduler: {
        async scheduleJob(jobName: string, payload: unknown, _runAt: Date, key: string) {
          scheduled.push({ jobName, payload, key });
          return {};
        },
      },
      now: () => NOW,
      log: () => undefined,
    });

  it('demotes, keeps ACTIVE, releases only future invasive CONFIRMED shifts, audits, and is idempotent', async () => {
    const expired = await createNurse('2026-11-05'); // expires "today" → no longer Tier 2 today
    const valid = await createNurse('2027-06-30');
    const tomorrow = new Date(NOW + 24 * HOUR);

    const releasedId = await createBooking(expired, invasiveServiceId, tomorrow, 'CONFIRMED');
    const basicId = await createBooking(expired, basicServiceId, new Date(tomorrow.getTime() + 4 * HOUR), 'CONFIRMED');
    const validNurseBooking = await createBooking(valid, invasiveServiceId, tomorrow, 'CONFIRMED');

    const r1 = await sweep();
    expect(r1.failed).toBe(0);

    const nurses = await pool.query(
      'SELECT user_id, tier, profile_status FROM nurse_profiles WHERE user_id = ANY($1::uuid[])',
      [[expired, valid]],
    );
    const byNurse = Object.fromEntries(nurses.rows.map((n: any) => [n.user_id, n]));
    expect(byNurse[expired]).toMatchObject({ tier: 'TIER_1_BASIC', profile_status: 'ACTIVE' });
    expect(byNurse[valid].tier).toBe('TIER_2_SPECIALIST');

    const b = await pool.query(
      'SELECT id, nurse_id, execution_status, prescription_verified_by_nurse FROM bookings WHERE id = ANY($1::uuid[])',
      [[releasedId, basicId, validNurseBooking]],
    );
    const byBooking = Object.fromEntries(b.rows.map((x: any) => [x.id, x]));
    expect(byBooking[releasedId]).toMatchObject({ nurse_id: null, execution_status: 'MATCHING', prescription_verified_by_nurse: false });
    expect(byBooking[basicId]).toMatchObject({ nurse_id: expired, execution_status: 'CONFIRMED' });
    expect(byBooking[validNurseBooking]).toMatchObject({ nurse_id: valid, execution_status: 'CONFIRMED' });

    // No penalty: nothing in the ledger, trust score untouched.
    const ledger = await pool.query(
      'SELECT count(*)::int AS n FROM wallet_transactions wt JOIN wallets w ON w.id = wt.wallet_id WHERE w.user_id = $1',
      [expired],
    );
    expect(ledger.rows[0].n).toBe(0);
    const trust = await pool.query('SELECT trust_score FROM nurse_profiles WHERE user_id = $1', [expired]);
    expect(trust.rows[0].trust_score).toBe(100);

    const audit = await pool.query(
      "SELECT actor_id, new_value FROM audit_logs WHERE action_type = 'TIER_DEMOTION' AND target_id = $1",
      [expired],
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].actor_id).toBeNull();
    expect(audit.rows[0].new_value).toMatchObject({ tier: 'TIER_1_BASIC', reason: 'GPHN_EXPIRED', releasedBookingIds: [releasedId] });

    expect(scheduled.filter((s) => s.payload.bookingId === releasedId)).toEqual([
      expect.objectContaining({ jobName: REDISPATCH_JOB, key: `redispatch:${releasedId}:${expired}` }),
    ]);

    // Second run: nothing changes for this nurse.
    await sweep();
    const audit2 = await pool.query(
      "SELECT count(*)::int AS n FROM audit_logs WHERE action_type = 'TIER_DEMOTION' AND target_id = $1",
      [expired],
    );
    expect(audit2.rows[0].n).toBe(1);
  });

  it('a nurse whose GPHN expires tomorrow is not touched', async () => {
    const nurse = await createNurse('2026-11-06');
    await sweep();
    const { rows } = await pool.query('SELECT tier FROM nurse_profiles WHERE user_id = $1', [nurse]);
    expect(rows[0].tier).toBe('TIER_2_SPECIALIST');
  });

  it('a SUSPENDED nurse is demoted too, and stays SUSPENDED', async () => {
    const nurse = await createNurse('2026-10-01', 'SUSPENDED');
    await sweep();
    const { rows } = await pool.query('SELECT tier, profile_status FROM nurse_profiles WHERE user_id = $1', [nurse]);
    expect(rows[0]).toMatchObject({ tier: 'TIER_1_BASIC', profile_status: 'SUSPENDED' });
  });
});
