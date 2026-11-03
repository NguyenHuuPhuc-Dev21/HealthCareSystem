import 'dotenv/config';
import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runGphnExpirySweep } from '../../src/modules/tier-lifecycle/tier-lifecycle.service';
import { toBusinessDate } from '../../src/modules/tier-lifecycle/tier-lifecycle.jobs';

const INVASIVE_SERVICE = '50000000-0000-0000-0000-000000000010';     // SRV_IV_INFUSION (seed)
const NON_INVASIVE_SERVICE = '50000000-0000-0000-0000-000000000001'; // SRV_WOUND_CARE (seed)

// Fake clock: "hôm nay" là 10/06/2030, 01:00 giờ VN
const TODAY = '2030-06-10';
const NOW = new Date('2030-06-10T01:00:00+07:00');

let client: Client;
let seq = 0;

beforeAll(async () => {
  client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
});
afterAll(async () => { await client.end(); });
beforeEach(async () => { await client.query('BEGIN'); });
afterEach(async () => { await client.query('ROLLBACK'); }); // không để lại dữ liệu

async function createUser(role: 'NURSE' | 'PATIENT'): Promise<string> {
  seq++;
  const { rows } = await client.query(
    `INSERT INTO users (phone, full_name, role, status) VALUES ($1, $2, $3, 'ACTIVE') RETURNING id`,
    [`t${Date.now() % 1e9}${seq}`, `Test ${role} ${seq}`, role],
  );
  return rows[0].id;
}

async function createNurse(tier: string, gphnExpiry: string | null): Promise<string> {
  const id = await createUser('NURSE');
  await client.query(
    `INSERT INTO nurse_profiles (user_id, tier, gphn_expiry_date, profile_status) VALUES ($1, $2, $3, 'ACTIVE')`,
    [id, tier, gphnExpiry],
  );
  return id;
}

async function createConfirmedBooking(nurseId: string, serviceId: string, startIso: string): Promise<string> {
  const customerId = await createUser('PATIENT');
  const { rows: p } = await client.query(
    `INSERT INTO patient_profiles (customer_id, full_name, location_type, data_consent_accepted, consent_timestamp)
     VALUES ($1, 'BN test', 'HOME', TRUE, now()) RETURNING id`,
    [customerId],
  );
  const { rows } = await client.query(
    `INSERT INTO bookings (booking_code, customer_id, patient_profile_id, nurse_id, service_id,
        matching_mode, payment_method, start_time, end_time, base_amount, total_amount,
        execution_status, payment_status)
     VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'BANK_TRANSFER',
        $6::timestamptz, $6::timestamptz + interval '2 hours', 350000, 350000,
        'CONFIRMED', 'ESCROW_HELD')
     RETURNING id`,
    [`TEST-${Date.now() % 1e9}-${seq}`, customerId, p[0].id, nurseId, serviceId, startIso],
  );
  return rows[0].id;
}

async function getNurse(id: string) {
  const { rows } = await client.query(`SELECT tier, profile_status FROM nurse_profiles WHERE user_id = $1`, [id]);
  return rows[0];
}
async function getBooking(id: string) {
  const { rows } = await client.query(
    `SELECT nurse_id, execution_status, payment_status FROM bookings WHERE id = $1`, [id]);
  return rows[0];
}

describe('tier-lifecycle — quét hạn GPHN (TC-AUTH-02)', () => {
  it('hạ Tier 2 hết hạn xuống Tier 1, hồ sơ vẫn ACTIVE; GPHN còn hạn thì giữ nguyên', async () => {
    const expired = await createNurse('TIER_2_SPECIALIST', '2030-06-09');
    const valid = await createNurse('TIER_2_SPECIALIST', '2031-01-01');

    const res = await runGphnExpirySweep(client, { today: TODAY, now: NOW });

    expect(res.demotedNurseIds).toContain(expired);
    expect(res.demotedNurseIds).not.toContain(valid);
    expect(await getNurse(expired)).toEqual({ tier: 'TIER_1_BASIC', profile_status: 'ACTIVE' });
    expect(await getNurse(valid)).toEqual({ tier: 'TIER_2_SPECIALIST', profile_status: 'ACTIVE' });
  });

  it('GPHN hết hạn đúng hôm nay thì chưa bị hạ (còn hiệu lực hết ngày)', async () => {
    const nurse = await createNurse('TIER_2_SPECIALIST', TODAY);
    const res = await runGphnExpirySweep(client, { today: TODAY, now: NOW });
    expect(res.demotedNurseIds).not.toContain(nurse);
  });

  it('ca xâm lấn CONFIRMED sau ngày hết hạn → MATCHING, gỡ điều dưỡng, không đụng tiền; ca không xâm lấn giữ nguyên', async () => {
    const nurse = await createNurse('TIER_2_SPECIALIST', '2030-06-09');
    const invasive = await createConfirmedBooking(nurse, INVASIVE_SERVICE, '2030-06-12T09:00:00+07:00');
    const nonInvasive = await createConfirmedBooking(nurse, NON_INVASIVE_SERVICE, '2030-06-13T09:00:00+07:00');

    const res = await runGphnExpirySweep(client, { today: TODAY, now: NOW });

    expect(res.releasedBookings.map((b) => b.id)).toEqual([invasive]);
    expect(await getBooking(invasive)).toEqual({
      nurse_id: null, execution_status: 'MATCHING', payment_status: 'ESCROW_HELD',
    });
    expect(await getBooking(nonInvasive)).toEqual({
      nurse_id: nurse, execution_status: 'CONFIRMED', payment_status: 'ESCROW_HELD',
    });
  });

  it('chạy lại lần 2 không thay đổi gì (idempotent)', async () => {
    const nurse = await createNurse('TIER_2_SPECIALIST', '2030-06-09');
    await createConfirmedBooking(nurse, INVASIVE_SERVICE, '2030-06-12T09:00:00+07:00');

    await runGphnExpirySweep(client, { today: TODAY, now: NOW });
    const second = await runGphnExpirySweep(client, { today: TODAY, now: NOW });

    expect(second.demotedNurseIds).toEqual([]);
    expect(second.releasedBookings).toEqual([]);
  });

  it('toBusinessDate tính ngày theo giờ VN (23:30 UTC = sáng hôm sau ở VN)', () => {
    expect(toBusinessDate(new Date('2030-06-09T23:30:00Z'))).toBe('2030-06-10');
  });
});