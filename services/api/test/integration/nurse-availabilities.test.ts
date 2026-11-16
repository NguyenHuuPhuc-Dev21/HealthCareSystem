import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import {
  checkNurseAvailability,
  findAvailableNurses,
  getEffectiveAvailability,
} from '../../src/modules/availability-engine/availability-engine.service';
import { putAvailabilitiesSchema } from '../../src/modules/nurse-availabilities/nurse-availabilities.schema';
import { NurseAvailabilitiesService } from '../../src/modules/nurse-availabilities/nurse-availabilities.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * Phase 2 (BE-2) trên PostgreSQL 16 thật, đã chạy migration 0001 → 0008:
 *  - PUT/GET /nurse/availabilities: thay toàn bộ lịch trong 1 transaction, khung qua đêm, mở rảnh riêng,
 *    409 AVAILABILITY_LOCKED khi bỏ khung đang có ca CONFIRMED;
 *  - availability-engine đọc DB thật + system_configs TRAVEL_BUFFER_MINUTES;
 *  - 3 tiêu chí hoàn thành Phase 2: ngày nghỉ bị loại, đệm < 60 phút bị loại,
 *    kết quả "tìm kiếm" (findAvailableNurses) và "điều phối" (checkNurseAvailability) khớp 100%.
 * Đồng hồ giả: "bây giờ" = Thứ 5 2026-11-12 09:00 giờ VN. Thứ 2 2026-11-16 là ngày kiểm tra.
 */
describe('nurse-availabilities + availability-engine (integration)', () => {
  let pool: Pool;
  let service: NurseAvailabilitiesService;
  let customerId: string;
  let profileId: string;
  let serviceId: string;

  const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
  const NOW = vn('2026-11-12', '09:00').getTime();
  const MON = '2026-11-16';

  async function createNurse(): Promise<string> {
    const phone = `08${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng lịch', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    await pool.query(
      "INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')",
      [rows[0].id],
    );
    return rows[0].id;
  }

  async function createBooking(nurseId: string, start: Date, end: Date, status = 'CONFIRMED'): Promise<{ id: string; code: string }> {
    const code = `AV-${randomUUID().slice(0, 10)}`;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'BANK_TRANSFER', $6, $7, 300000, 300000, $8::execution_status_enum)
       RETURNING id`,
      [code, customerId, profileId, nurseId, serviceId, start, end, status],
    );
    return { id: rows[0].id, code };
  }

  const allWeek = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startTime: '00:00', endTime: '23:59' }));
  const put = (nurseId: string, body: unknown) => service.replaceSchedule(nurseId, putAvailabilitiesSchema.parse(body));

  async function rejectsWith(p: Promise<unknown>, status: number, code: string): Promise<AppError> {
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect([(err as AppError).status, (err as AppError).code]).toEqual([status, code]);
    return err as AppError;
  }

  beforeAll(async () => {
    pool = createTestPool();
    service = new NurseAvailabilitiesService({
      read: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      now: () => NOW,
    });
    customerId = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, location_type, data_consent_accepted, consent_timestamp)
       VALUES ($1, 'BN lịch', 'HOME', TRUE, now()) RETURNING id`,
      [customerId],
    );
    profileId = p.rows[0].id;
    const s = await pool.query("SELECT id FROM service_categories WHERE NOT is_prohibited ORDER BY code LIMIT 1");
    serviceId = s.rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  // ---------------------------------------------------------------------------
  it('PUT stores overnight windows, open hours and time-off; GET returns them with server ids', async () => {
    const nurse = await createNurse();
    const saved = await put(nurse, {
      recurringWindows: [
        { id: 'seed-w2', dayOfWeek: 1, startTime: '19:00', endTime: '06:00' },
        { id: 'seed-w8', dayOfWeek: 6, startTime: '00:00', endTime: '23:59' },
        { dayOfWeek: 5, startTime: '20:00', endTime: '06:00' }, // spills into Saturday: allowed, merged
      ],
      timeOffExceptions: [
        { specificDate: '2026-11-20', startTime: '00:00', endTime: '23:59' },
        { specificDate: '2026-10-01', startTime: '00:00', endTime: '23:59' }, // stale → dropped
      ],
      dateAvailabilities: [{ specificDate: '2026-11-18', startTime: '13:00', endTime: '17:00' }],
    });

    expect(saved.recurringWindows).toHaveLength(3);
    expect(saved.recurringWindows.find((w) => w.dayOfWeek === 1)).toMatchObject({ startTime: '19:00', endTime: '06:00' });
    expect(saved.recurringWindows.every((w) => /^[0-9a-f-]{36}$/.test(w.id))).toBe(true);
    expect(saved.timeOffExceptions.map((t) => t.specificDate)).toEqual(['2026-11-20']);
    expect(saved.dateAvailabilities).toEqual([expect.objectContaining({ specificDate: '2026-11-18', startTime: '13:00', endTime: '17:00' })]);

    const got = await service.getSchedule(nurse);
    expect(got).toEqual(saved);
  });

  it('PUT replaces the whole schedule (nothing from the old one survives)', async () => {
    const nurse = await createNurse();
    await put(nurse, { recurringWindows: allWeek });
    const second = await put(nurse, { recurringWindows: [{ dayOfWeek: 3, startTime: '08:00', endTime: '12:00' }] });
    expect(second.recurringWindows).toEqual([expect.objectContaining({ dayOfWeek: 3, startTime: '08:00', endTime: '12:00' })]);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM nurse_availabilities WHERE nurse_id = $1', [nurse]);
    expect(rows[0].n).toBe(1);
  });

  it('removing the window under a CONFIRMED shift → 409 AVAILABILITY_LOCKED, schedule unchanged (atomic)', async () => {
    const nurse = await createNurse();
    await put(nurse, { recurringWindows: allWeek });
    const b = await createBooking(nurse, vn(MON, '08:00'), vn(MON, '12:00'));

    const err = await rejectsWith(put(nurse, { recurringWindows: allWeek.filter((w) => w.dayOfWeek !== 1) }), 409, 'AVAILABILITY_LOCKED');
    expect(err.details).toMatchObject({ bookingCode: b.code, date: MON, startTime: '08:00', endTime: '12:00' });
    await rejectsWith(
      put(nurse, { recurringWindows: allWeek, timeOffExceptions: [{ specificDate: MON, startTime: '00:00', endTime: '23:59' }] }),
      409,
      'AVAILABILITY_LOCKED',
    );
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM nurse_availabilities WHERE nurse_id = $1', [nurse]);
    expect(rows[0].n).toBe(7);

    // GET shows the shift on the calendar in Vietnam time
    const view = await service.getSchedule(nurse);
    expect(view.bookings).toEqual([
      expect.objectContaining({ code: b.code, date: MON, startTime: '08:00', endTime: '12:00', status: 'CONFIRMED' }),
    ]);
  });

  it('a user without a nurse profile → 403 NURSE_PROFILE_REQUIRED', async () => {
    const notNurse = await createTestUser(pool);
    await rejectsWith(put(notNurse, { recurringWindows: [] }), 403, 'NURSE_PROFILE_REQUIRED');
    await rejectsWith(service.getSchedule(notNurse), 403, 'NURSE_PROFILE_REQUIRED');
  });

  // ---------------------------------------------------------------------------
  describe('Phase 2 exit criteria (engine on the real DB)', () => {
    let free: string; // available all week
    let onLeave: string; // all-day time-off on Monday
    let busy: string; // CONFIRMED shift Mon 07:00–10:00
    let working: string; // IN_PROGRESS shift Mon 08:00–09:45
    let cancelledOnly: string; // only a CANCELLED shift — must not block

    beforeAll(async () => {
      [free, onLeave, busy, working, cancelledOnly] = await Promise.all([1, 2, 3, 4, 5].map(() => createNurse()));
      for (const n of [free, busy, working, cancelledOnly]) await put(n, { recurringWindows: allWeek });
      await put(onLeave, {
        recurringWindows: allWeek,
        timeOffExceptions: [{ specificDate: MON, startTime: '00:00', endTime: '23:59' }],
      });
      await createBooking(busy, vn(MON, '07:00'), vn(MON, '10:00'));
      await createBooking(working, vn(MON, '08:00'), vn(MON, '09:45'), 'IN_PROGRESS');
      await createBooking(cancelledOnly, vn(MON, '10:00'), vn(MON, '12:00'), 'CANCELLED');
    });

    it('1 — a nurse with a TIME_OFF_EXCEPTION is excluded for that window', async () => {
      const ids = await findAvailableNurses(pool, { nurseIds: [free, onLeave], start: vn(MON, '14:00'), end: vn(MON, '18:00') });
      expect(ids).toEqual([free]);
      expect(await checkNurseAvailability(pool, onLeave, { start: vn(MON, '14:00'), end: vn(MON, '18:00') })).toEqual({
        available: false,
        reason: 'TIME_OFF',
      });
    });

    it('2 — less than 60 min after a CONFIRMED / IN_PROGRESS shift is excluded; exactly 60 is fine', async () => {
      // busy ends 10:00, working ends 09:45
      const at1030 = await findAvailableNurses(pool, {
        nurseIds: [free, busy, working, cancelledOnly],
        start: vn(MON, '10:30'),
        end: vn(MON, '12:00'),
      });
      expect(at1030).toEqual([free, cancelledOnly]);
      expect(await checkNurseAvailability(pool, busy, { start: vn(MON, '10:30'), end: vn(MON, '12:00') })).toEqual({
        available: false,
        reason: 'TRAVEL_BUFFER',
      });
      const at1100 = await findAvailableNurses(pool, {
        nurseIds: [free, busy, working],
        start: vn(MON, '11:00'),
        end: vn(MON, '12:00'),
      });
      expect(at1100).toEqual([free, busy, working]);
    });

    it('3 — search and dispatch answer identically for the same slots', async () => {
      const nurses = [free, onLeave, busy, working, cancelledOnly];
      const slots = [
        ['06:00', '08:00'],
        ['10:00', '11:00'],
        ['10:45', '12:45'],
        ['11:00', '15:00'],
        ['20:00', '23:00'],
      ].map(([a, b]) => ({ start: vn(MON, a), end: vn(MON, b) }));

      for (const slot of slots) {
        const searchView = await findAvailableNurses(pool, { nurseIds: nurses, ...slot });
        const dispatchView: string[] = [];
        for (const n of nurses) if ((await checkNurseAvailability(pool, n, slot)).available) dispatchView.push(n);
        expect(searchView).toEqual(dispatchView);
      }
    });

    it('getEffectiveAvailability: the day minus the shift ± 60 min', async () => {
      const free1 = await getEffectiveAvailability(pool, busy, vn(MON, '00:00'), vn('2026-11-17', '00:00'));
      expect(free1.map((i) => [i.start.toISOString(), i.end.toISOString()])).toEqual([
        [vn(MON, '00:00').toISOString(), vn(MON, '06:00').toISOString()],
        [vn(MON, '11:00').toISOString(), vn('2026-11-17', '00:00').toISOString()],
      ]);
    });
  });
});
