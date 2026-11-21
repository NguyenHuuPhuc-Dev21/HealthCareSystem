import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { closePool, runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { createBookingSchema, quoteSchema } from '../../src/modules/bookings/bookings.schema';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { PAYMENT_TIMEOUT_JOB } from '../../src/modules/bookings/bookings.types';
import { MatchingRadarService, activateMatching } from '../../src/modules/matching-radar/matching-radar.service';
import { RADAR_WAVE_JOB, type RadarWavePayload } from '../../src/modules/matching-radar/matching-radar.types';
import { createTestPool, createTestUser } from './helpers';

/**
 * Phase 3 (BE-2) trên PostgreSQL 16 thật (migration 0001 → 0009 + seed dịch vụ):
 * pricing-engine + bookings + matching-radar chạy cùng nhau.
 *  - giá do backend tính, lưu snapshot; đơn chuyển khoản = DRAFT giữ 15 phút; đơn tiền mặt vào MATCHING ngay;
 *  - dịch vụ cấm (Nhóm 3) bị chặn ở API (403) VÀ ở DB (trigger);
 *  - Radar: đợt 1 trong 5 km, đợt 2 mở rộng 10 km sau 5 phút, hết hạn sau 15 phút;
 *  - nhận ca: ai nhận trước được (2 người bấm cùng lúc → đúng 1 người thắng), backend kiểm lại
 *    ACTIVE / Tier / ký quỹ / lịch rảnh + đệm 60 phút ngay lúc nhận.
 * Đồng hồ giả: "bây giờ" = Thứ 2 2026-11-16 09:00 giờ VN. Hàng đợi job là bản giả ghi lại lịch hẹn.
 */
describe('bookings + pricing-engine + matching-radar (integration)', () => {
  let pool: Pool;
  let bookings: BookingsService;
  let radar: MatchingRadarService;

  const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
  const MON = '2026-11-16';
  const T0 = vn(MON, '09:00').getTime();
  let clock = T0;
  const MIN = 60_000;

  const scheduled: { jobName: string; payload: any; runAt: Date; key: string }[] = [];
  const scheduler = {
    async scheduleJob(jobName: string, payload: unknown, runAt: Date, key: string) {
      if (!scheduled.some((j) => j.key === key)) scheduled.push({ jobName, payload, runAt, key });
      return {};
    },
  };
  const waveJobs = (bookingId: string) =>
    scheduled.filter((j) => j.jobName === RADAR_WAVE_JOB && j.payload.bookingId === bookingId) as {
      payload: RadarWavePayload;
      runAt: Date;
    }[];

  // Care location: Bến Thành. ~1 km and ~7.8 km north of it.
  const CARE = { lat: 10.7769, lng: 106.7009 };
  const NEAR = { lat: CARE.lat + 0.009, lng: CARE.lng };
  const FAR = { lat: CARE.lat + 0.07, lng: CARE.lng };
  const OUTSIDE = { lat: CARE.lat + 0.2, lng: CARE.lng };

  async function createCustomer(kyc = 'VERIFIED'): Promise<{ id: string; homeProfile: string }> {
    const id = await createTestUser(pool);
    await pool.query('UPDATE users SET kyc_status = $2::kyc_status_enum WHERE id = $1', [id, kyc]);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Trần Văn Bình', '1950-01-01', 60, 'NORMAL', '1 Lê Lợi, Q1', 'HOME', $2, $3, TRUE, now()) RETURNING id`,
      [id, CARE.lat, CARE.lng],
    );
    return { id, homeProfile: p.rows[0].id };
  }

  async function createNurse(
    pos: { lat: number; lng: number },
    over: { tier?: string; deposit?: number; status?: string; gphnExpiry?: string | null; graceDays?: number; closing?: boolean } = {},
  ): Promise<string> {
    const phone = `05${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng radar', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id = rows[0].id;
    const tier = over.tier ?? 'TIER_1_BASIC';
    await pool.query(
      `INSERT INTO nurse_profiles (user_id, tier, gphn_number, gphn_expiry_date, profile_status, current_lat, current_lng)
       VALUES ($1, $2::nurse_tier_enum, $3, $4::date, $5::profile_status_enum, $6, $7)`,
      [
        id,
        tier,
        tier === 'TIER_2_SPECIALIST' ? `G-${id.slice(0, 6)}` : null,
        tier === 'TIER_2_SPECIALIST' ? (over.gphnExpiry === undefined ? '2028-12-31' : over.gphnExpiry) : null,
        over.status ?? 'ACTIVE',
        pos.lat,
        pos.lng,
      ],
    );
    await pool.query(
      `INSERT INTO wallets (user_id, deposit_balance, deposit_grace_expires_at, closure_requested_at)
       VALUES ($1, $2, $3, $4)`,
      [
        id,
        over.deposit ?? 300_000,
        over.graceDays === undefined ? null : new Date(clock + over.graceDays * 86_400_000),
        over.closing ? new Date(clock) : null,
      ],
    );
    // free all week
    await pool.query(
      `INSERT INTO nurse_availabilities (nurse_id, day_of_week, start_time, end_time, availability_type)
       SELECT $1, d, '00:00', '23:59', 'RECURRING_AVAILABLE' FROM generate_series(0, 6) AS d`,
      [id],
    );
    return id;
  }

  const body = (customer: { homeProfile: string }, over: Record<string, unknown> = {}) =>
    createBookingSchema.parse({
      serviceCode: 'SRV_WOUND_CARE',
      patientProfileId: customer.homeProfile,
      startAt: vn(MON, '11:00').toISOString(),
      endAt: vn(MON, '12:00').toISOString(),
      paymentMethod: 'CASH',
      ...over,
    });

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

  const row = async (id: string) =>
    (await pool.query('SELECT * FROM bookings WHERE id = $1', [id])).rows[0] as Record<string, any>;
  const offers = async (id: string) =>
    (await pool.query('SELECT nurse_id, offer_type, status, radius_km, round_no, expires_at FROM booking_offers WHERE booking_id = $1', [id]))
      .rows as Record<string, any>[];

  /** Creates an urgent cash booking and runs wave 1 (and wave 2 when asked). */
  async function urgentBooking(customer: { id: string; homeProfile: string }, waves: 1 | 2 = 1, over: Record<string, unknown> = {}) {
    const b = await bookings.create(customer.id, body(customer, over));
    const [w1] = waveJobs(b.id);
    await radar.runWave(w1.payload);
    if (waves === 2) {
      clock += 5 * MIN;
      await radar.runWave(waveJobs(b.id)[1].payload);
    }
    return b;
  }

  beforeAll(async () => {
    pool = createTestPool();
    const withTx = <T>(fn: (db: any) => Promise<T>) => runInTransaction(pool, fn);
    radar = new MatchingRadarService({ read: pool, withTx, scheduler, now: () => clock });
    bookings = new BookingsService({
      read: pool,
      withTx,
      scheduler,
      startRadar: (id) => radar.startRadar(id),
      storage: {
        statObject: async () => ({ sizeBytes: 1000 }),
        readObjectHead: async () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), // JPEG
      },
      createUploadUrl: async (key) => ({ url: `https://signed.test/${key}`, expiresInSeconds: 600 }),
      now: () => clock,
    });
  });

  afterAll(async () => {
    await pool.end();
    await closePool(); // the global pool core/config used to read system_configs
  });

  // ===========================================================================
  describe('pricing + booking creation', () => {
    it('quote: price comes from the catalog and system_configs (night share +20%, heavy patient +15%)', async () => {
      const c = await createCustomer();
      // SRV_SHIFT_4H = 400,000 per shift; 20:00–24:00 → half of it is night → +40,000
      const q = await bookings.quote(
        c.id,
        quoteSchema.parse({
          serviceCode: 'SRV_SHIFT_4H',
          patientProfileId: c.homeProfile,
          startAt: vn(MON, '20:00').toISOString(),
          endAt: vn('2026-11-17', '00:00').toISOString(),
        }),
      );
      expect(q).toMatchObject({ baseAmount: 400_000, nightSurcharge: 40_000, heavyPatientSurcharge: 0, totalAmount: 440_000, platformFee: 66_000 });

      await pool.query("UPDATE patient_profiles SET mobility_status = 'BEDRIDDEN' WHERE id = $1", [c.homeProfile]);
      const heavy = await bookings.quote(
        c.id,
        quoteSchema.parse({
          serviceCode: 'SRV_SHIFT_4H',
          patientProfileId: c.homeProfile,
          startAt: vn(MON, '13:00').toISOString(),
          endAt: vn(MON, '17:00').toISOString(),
        }),
      );
      expect(heavy).toMatchObject({ baseAmount: 400_000, heavyPatientSurcharge: 60_000, totalAmount: 460_000 });
    });

    it('bank transfer → DRAFT / UNPAID with a 15-minute hold, price snapshot stored, payment-timeout job scheduled', async () => {
      const c = await createCustomer();
      const view = await bookings.create(c.id, body(c, { paymentMethod: 'BANK_TRANSFER' }));

      expect(view).toMatchObject({
        executionStatus: 'DRAFT',
        paymentStatus: 'UNPAID',
        disputeStatus: 'NONE',
        matchingMode: null,
        paymentExpiresAt: new Date(T0 + 15 * MIN).toISOString(),
        pricing: { baseAmount: 200_000, totalAmount: 200_000, platformFee: 30_000 },
      });
      expect(view.code).toMatch(/^HC-261116-/);

      const r = await row(view.id);
      expect([Number(r.base_amount), Number(r.surcharge_amount), Number(r.platform_fee), Number(r.total_amount)]).toEqual([200_000, 0, 30_000, 200_000]);
      expect(r.nurse_id).toBeNull();

      const timeout = scheduled.find((j) => j.jobName === PAYMENT_TIMEOUT_JOB && j.payload.bookingId === view.id)!;
      expect(timeout.runAt.getTime()).toBe(T0 + 15 * MIN);
      expect(waveJobs(view.id)).toHaveLength(0); // no matching before payment

      // list + owner-only read
      expect((await bookings.list(c.id)).map((b) => b.id)).toEqual([view.id]);
      const other = await createCustomer();
      await rejectsWith(bookings.get(other.id, view.id), 403, 'FORBIDDEN');
    });

    it('matching for a bank transfer starts only after ESCROW_HELD (what BE-3’s webhook will do)', async () => {
      const c = await createCustomer();
      const view = await bookings.create(c.id, body(c, { paymentMethod: 'BANK_TRANSFER' }));
      await rejectsWith(runInTransaction(pool, (db) => activateMatching(db, view.id, clock)), 409, 'PAYMENT_REQUIRED');

      await pool.query("UPDATE bookings SET payment_status = 'ESCROW_HELD' WHERE id = $1", [view.id]);
      const r = await runInTransaction(pool, (db) => activateMatching(db, view.id, clock));
      expect(r).toEqual({ matchingMode: 'RADAR_DISPATCH', startRadar: true });
      expect((await row(view.id)).execution_status).toBe('MATCHING');
      // idempotent
      expect(await runInTransaction(pool, (db) => activateMatching(db, view.id, clock))).toEqual({ matchingMode: 'RADAR_DISPATCH', startRadar: false });
    });

    it('prohibited service (Group 3): API answers 403 and the DATABASE refuses the row too', async () => {
      const c = await createCustomer();
      await rejectsWith(bookings.create(c.id, body(c, { serviceCode: 'SRV_BLOOD_TRANSFUSION' })), 403, 'SERVICE_PROHIBITED');
      await rejectsWith(
        bookings.quote(c.id, quoteSchema.parse({ serviceCode: 'SRV_MINOR_SURGERY', patientProfileId: c.homeProfile, startAt: vn(MON, '11:00').toISOString(), endAt: vn(MON, '12:00').toISOString() })),
        403,
        'SERVICE_PROHIBITED',
      );

      // Any other path (Admin tool, script) hits the trigger.
      let dbError: Error | null = null;
      try {
        await pool.query(
          `INSERT INTO bookings (booking_code, customer_id, patient_profile_id, service_id, matching_mode, payment_method,
                                 start_time, end_time, base_amount, total_amount)
           SELECT 'HC-PROHIBITED-1', $1, $2, id, 'JOB_BOARD', 'CASH', now() + interval '1 day', now() + interval '25 hours', 0, 0
             FROM service_categories WHERE code = 'SRV_IV_HIGH_RISK'`,
          [c.id, c.homeProfile],
        );
      } catch (e) {
        dbError = e as Error;
      }
      expect(dbError?.message).toMatch(/prohibited/);
      const { rows } = await pool.query("SELECT count(*)::int AS n FROM bookings WHERE customer_id = $1", [c.id]);
      expect(rows[0].n).toBe(0);
    });

    it('home care needs customer eKYC; consent withdrawn blocks too; nothing is written', async () => {
      const unverified = await createCustomer('UNVERIFIED');
      await rejectsWith(bookings.create(unverified.id, body(unverified)), 403, 'EKYC_REQUIRED');

      const c = await createCustomer();
      await pool.query('UPDATE patient_profiles SET data_consent_accepted = FALSE, consent_withdrawn_at = now() WHERE id = $1', [c.homeProfile]);
      await rejectsWith(bookings.create(c.id, body(c)), 403, 'CONSENT_REQUIRED');

      const stranger = await createCustomer();
      await rejectsWith(bookings.create(stranger.id, body(c)), 403, 'FORBIDDEN');

      const { rows } = await pool.query('SELECT count(*)::int AS n FROM bookings WHERE customer_id = ANY($1::uuid[])', [[unverified.id, c.id, stranger.id]]);
      expect(rows[0].n).toBe(0);
    });

    it('invasive service: medical order required and at most 7 days old', async () => {
      const c = await createCustomer();
      const invasive = { serviceCode: 'SRV_IV_INJECTION' };
      const key = `prescription/${c.id}/${randomUUID()}.jpg`;
      await rejectsWith(bookings.create(c.id, body(c, invasive)), 400, 'PRESCRIPTION_REQUIRED');
      await rejectsWith(bookings.create(c.id, body(c, { ...invasive, prescription: { imageKey: key, issuedDate: '2026-11-08' } })), 400, 'PRESCRIPTION_EXPIRED');
      await rejectsWith(
        bookings.create(c.id, body(c, { ...invasive, prescription: { imageKey: `prescription/00000000-0000-4000-8000-000000000000/${randomUUID()}.jpg`, issuedDate: MON } })),
        400,
        'INVALID_FILE_KEY',
      );

      const view = await bookings.create(c.id, body(c, { ...invasive, prescription: { imageKey: key, issuedDate: '2026-11-10' } }));
      expect(view.isInvasive).toBe(true);
      const r = await row(view.id);
      expect(r.prescription_image_url).toBe(key);
      expect(r.prescription_verified_by_nurse).toBe(false);
    });

    it('slot rules: past start and odd shift lengths are refused', async () => {
      const c = await createCustomer();
      await rejectsWith(bookings.create(c.id, body(c, { startAt: vn(MON, '08:00').toISOString(), endAt: vn(MON, '08:30').toISOString() })), 400, 'START_IN_PAST');
      await rejectsWith(
        bookings.create(c.id, body(c, { serviceCode: 'SRV_SHIFT_4H', startAt: vn(MON, '13:00').toISOString(), endAt: vn(MON, '18:00').toISOString() })),
        400,
        'INVALID_DURATION',
      );
    });

    it('cash, more than 6 h ahead → MATCHING on the Job Board, no Radar', async () => {
      const c = await createCustomer();
      const view = await bookings.create(c.id, body(c, { startAt: vn(MON, '18:00').toISOString(), endAt: vn(MON, '19:00').toISOString() }));
      expect(view).toMatchObject({ executionStatus: 'MATCHING', paymentStatus: 'UNPAID', matchingMode: 'JOB_BOARD', paymentExpiresAt: null });
      expect(waveJobs(view.id)).toHaveLength(0);

      // The shared claim transaction also serves the Job Board (BE-3 calls it with via = JOB_BOARD).
      const nurse = await createNurse(OUTSIDE);
      await expect(radar.claimBooking(nurse, view.id, 'JOB_BOARD')).resolves.toMatchObject({ bookingId: view.id });
      expect(await row(view.id)).toMatchObject({ execution_status: 'CONFIRMED', nurse_id: nurse });
    });

    it('direct request to a chosen nurse: stored as an offer, no Radar broadcast while it is open', async () => {
      const c = await createCustomer();
      const chosen = await createNurse(NEAR);
      const view = await bookings.create(c.id, body(c, { invitedNurseId: chosen }));
      expect(view).toMatchObject({ executionStatus: 'MATCHING', matchingMode: 'DIRECT_REQUEST', invitedNurse: { nurseId: chosen } });
      expect(waveJobs(view.id)).toHaveLength(0);
      expect(await offers(view.id)).toEqual([expect.objectContaining({ nurse_id: chosen, offer_type: 'DIRECT_REQUEST', status: 'SENT' })]);

      const suspended = await createNurse(NEAR, { status: 'SUSPENDED' });
      await rejectsWith(bookings.create(c.id, body(c, { invitedNurseId: suspended })), 400, 'INVITED_NURSE_NOT_AVAILABLE');
    });
  });

  // ===========================================================================
  describe('Radar Dispatch (urgent, <= 6 h)', () => {
    it('wave 1 offers eligible nurses within 5 km; wave 2 (+5 min) adds those within 10 km; offers end at +15 min', async () => {
      clock = T0;
      const c = await createCustomer();
      const near = await createNurse(NEAR);
      const far = await createNurse(FAR);
      const outside = await createNurse(OUTSIDE);
      const lowDeposit = await createNurse(NEAR, { deposit: 299_999 });
      const suspended = await createNurse(NEAR, { status: 'SUSPENDED' });
      const onLeave = await createNurse(NEAR);
      await pool.query(
        `INSERT INTO nurse_availabilities (nurse_id, specific_date, start_time, end_time, availability_type)
         VALUES ($1, $2::date, '00:00', '23:59', 'TIME_OFF_EXCEPTION')`,
        [onLeave, MON],
      );
      const busy = await createNurse(NEAR); // confirmed shift ends 10:30 → less than 60 min before 11:00
      const other = await createCustomer();
      await pool.query(
        `INSERT INTO bookings (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
                               start_time, end_time, base_amount, total_amount, execution_status)
         SELECT $1, $2, $3, $4, id, 'JOB_BOARD', 'CASH', $5, $6, 200000, 200000, 'CONFIRMED' FROM service_categories WHERE code = 'SRV_WOUND_CARE'`,
        [`BUSY-${busy.slice(0, 8)}`, other.id, other.homeProfile, busy, vn(MON, '09:30'), vn(MON, '10:30')],
      );
      const mine = [near, far, outside, lowDeposit, suspended, onLeave, busy];

      const view = await bookings.create(c.id, body(c));
      expect(view).toMatchObject({ executionStatus: 'MATCHING', matchingMode: 'RADAR' });
      const [w1] = waveJobs(view.id);
      expect(w1.payload).toMatchObject({ wave: 1, startedAt: new Date(T0).toISOString() });

      const r1 = await radar.runWave(w1.payload);
      expect(r1.radiusKm).toBe(5);
      expect(r1.offered.filter((n) => mine.includes(n))).toEqual([near]);

      // wave 2 is scheduled 5 minutes after the start
      const w2 = waveJobs(view.id)[1];
      expect(w2.payload.wave).toBe(2);
      expect(w2.runAt.getTime()).toBe(T0 + 5 * MIN);

      clock = T0 + 5 * MIN;
      const r2 = await radar.runWave(w2.payload);
      expect(r2.radiusKm).toBe(10);
      expect(r2.offered.filter((n) => mine.includes(n))).toEqual([far]); // near is not offered twice

      const sent = (await offers(view.id)).filter((o) => mine.includes(o.nurse_id));
      expect(sent.map((o) => [o.nurse_id, o.radius_km, o.round_no, o.status]).sort()).toEqual(
        [
          [near, 5, 1, 'SENT'],
          [far, 10, 2, 'SENT'],
        ].sort(),
      );
      expect(sent.every((o) => new Date(o.expires_at).getTime() === T0 + 15 * MIN)).toBe(true);

      // GET /nurse/radar
      const job = await radar.getRadarJob(far);
      expect(job).toMatchObject({
        id: view.id,
        wave: 2,
        serviceName: expect.any(String),
        date: MON,
        startTime: '11:00',
        endTime: '12:00',
        patientName: 'Bình', // given name only before the claim
        totalAmount: 200_000,
        netAmount: 170_000,
        paymentMethod: 'CASH',
        expiresInSeconds: 600,
      });
      expect(job!.distanceKm).toBeGreaterThan(7);
      expect(await radar.getRadarJob(outside)).toBeNull();

      // running a wave again changes nothing (job retry)
      const again = await radar.runWave(w2.payload);
      expect(again.offered.filter((n) => mine.includes(n))).toEqual([]);
    });

    it('first accept wins: two nurses claim at the same moment → exactly one gets the shift', async () => {
      clock = T0;
      const c = await createCustomer();
      const a = await createNurse(NEAR);
      const b = await createNurse(NEAR);
      const view = await urgentBooking(c);

      const results = await Promise.allSettled([radar.claimBooking(a, view.id, 'RADAR'), radar.claimBooking(b, view.id, 'RADAR')]);
      const won = results.filter((r) => r.status === 'fulfilled');
      const lost = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect([(lost[0].reason as AppError).status, (lost[0].reason as AppError).code]).toEqual([409, 'ALREADY_CLAIMED']);

      const r = await row(view.id);
      expect(r.execution_status).toBe('CONFIRMED');
      expect([a, b]).toContain(r.nurse_id);
      const mine = (await offers(view.id)).filter((o) => [a, b].includes(o.nurse_id));
      expect(mine.find((o) => o.nurse_id === r.nurse_id)!.status).toBe('ACCEPTED');
      expect(mine.find((o) => o.nurse_id !== r.nurse_id)!.status).toBe('LOST_RACE');

      // the winner no longer sees it on the radar; the booking cannot be claimed again
      expect(await radar.getRadarJob(a)).toBeNull();
      await rejectsWith(radar.claimBooking(a, view.id, 'RADAR'), 409, 'ALREADY_CLAIMED');
    });

    it('the gate is re-checked at the moment of the claim', async () => {
      clock = T0;
      const c = await createCustomer();
      const turnedSuspended = await createNurse(NEAR);
      const spentDeposit = await createNurse(NEAR);
      const gotBusy = await createNurse(NEAR);
      const noOffer = await createNurse(OUTSIDE);
      const ok = await createNurse(NEAR);
      const view = await urgentBooking(c);

      // things change between the offer and the tap on "Accept"
      await pool.query("UPDATE nurse_profiles SET profile_status = 'SUSPENDED' WHERE user_id = $1", [turnedSuspended]);
      await pool.query('UPDATE wallets SET deposit_balance = 100000 WHERE user_id = $1', [spentDeposit]);
      const other = await createCustomer();
      await pool.query(
        `INSERT INTO bookings (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
                               start_time, end_time, base_amount, total_amount, execution_status)
         SELECT $1, $2, $3, $4, id, 'JOB_BOARD', 'CASH', $5, $6, 200000, 200000, 'CONFIRMED' FROM service_categories WHERE code = 'SRV_WOUND_CARE'`,
        [`BUSY-${gotBusy.slice(0, 8)}`, other.id, other.homeProfile, gotBusy, vn(MON, '12:30'), vn(MON, '13:30')],
      );

      await rejectsWith(radar.claimBooking(turnedSuspended, view.id, 'RADAR'), 403, 'NURSE_NOT_ACTIVE');
      await rejectsWith(radar.claimBooking(spentDeposit, view.id, 'RADAR'), 403, 'DEPOSIT_SHORTFALL');
      const conflict = await rejectsWith(radar.claimBooking(gotBusy, view.id, 'RADAR'), 409, 'SCHEDULE_CONFLICT');
      expect(conflict.details).toEqual({ reason: 'TRAVEL_BUFFER' }); // next shift starts 30 min after this one ends
      await rejectsWith(radar.claimBooking(noOffer, view.id, 'RADAR'), 403, 'NO_ACTIVE_OFFER');
      expect((await row(view.id)).execution_status).toBe('MATCHING'); // still open

      // after the 15-minute window the offer can no longer be claimed
      clock = T0 + 15 * MIN;
      await rejectsWith(radar.claimBooking(ok, view.id, 'RADAR'), 403, 'NO_ACTIVE_OFFER');
      clock = T0 + 14 * MIN;
      await expect(radar.claimBooking(ok, view.id, 'RADAR')).resolves.toMatchObject({ bookingCode: view.code });
    });

    it('invasive service: only Tier 2 with a GPHN valid on the shift date is offered or may claim', async () => {
      clock = T0;
      const c = await createCustomer();
      const tier1 = await createNurse(NEAR);
      const tier2 = await createNurse(NEAR, { tier: 'TIER_2_SPECIALIST' });
      const expiring = await createNurse(NEAR, { tier: 'TIER_2_SPECIALIST', gphnExpiry: MON }); // expires on the shift date
      const view = await urgentBooking(c, 1, {
        serviceCode: 'SRV_IV_INJECTION',
        prescription: { imageKey: `prescription/${c.id}/${randomUUID()}.jpg`, issuedDate: MON },
      });

      const offered = (await offers(view.id)).map((o) => o.nurse_id);
      expect(offered).toContain(tier2);
      expect(offered).not.toContain(tier1);
      expect(offered).not.toContain(expiring);

      // Even through the open Job Board path the backend refuses the wrong tier (HTTP 403).
      await rejectsWith(radar.claimBooking(tier1, view.id, 'JOB_BOARD'), 403, 'TIER_MISMATCH');
      await rejectsWith(radar.claimBooking(expiring, view.id, 'JOB_BOARD'), 403, 'TIER_MISMATCH');
      await expect(radar.claimBooking(tier2, view.id, 'RADAR')).resolves.toMatchObject({ bookingId: view.id });
    });

    it('deposit grace (ADR-0004): a short deposit reaches BANK_TRANSFER bookings only, max 3 held + completed; closing accounts get nothing', async () => {
      clock = T0;
      const c = await createCustomer();
      const full = await createNurse(NEAR);
      const grace = await createNurse(NEAR, { deposit: 0, graceDays: 10 });
      const graceOver = await createNurse(NEAR, { deposit: 0, graceDays: -1 });
      const closing = await createNurse(NEAR, { closing: true });
      const mine = [full, grace, graceOver, closing];

      // cash, urgent → only the nurse with the full deposit
      const cash = await urgentBooking(c);
      expect((await offers(cash.id)).map((o) => o.nurse_id).filter((n) => mine.includes(n))).toEqual([full]);
      await rejectsWith(radar.claimBooking(grace, cash.id, 'JOB_BOARD'), 403, 'DEPOSIT_SHORTFALL');
      await rejectsWith(radar.claimBooking(closing, cash.id, 'JOB_BOARD'), 403, 'ACCOUNT_CLOSING');

      // bank transfer, urgent, paid → the grace nurse is offered too
      const transfer = await bookings.create(c.id, body(c, { paymentMethod: 'BANK_TRANSFER', startAt: vn(MON, '13:00').toISOString(), endAt: vn(MON, '14:00').toISOString() }));
      await pool.query("UPDATE bookings SET payment_status = 'ESCROW_HELD' WHERE id = $1", [transfer.id]);
      const act = await runInTransaction(pool, (db) => activateMatching(db, transfer.id, clock));
      expect(act.startRadar).toBe(true);
      await radar.startRadar(transfer.id);
      await radar.runWave(waveJobs(transfer.id)[0].payload);
      expect((await offers(transfer.id)).map((o) => o.nurse_id).filter((n) => mine.includes(n)).sort()).toEqual([full, grace].sort());
      await expect(radar.claimBooking(grace, transfer.id, 'RADAR')).resolves.toMatchObject({ bookingId: transfer.id });

      // the cap counts shifts already held: with 2 completed + this 1 held, a 4th is refused
      await pool.query('UPDATE wallets SET deposit_grace_shifts_used = 2 WHERE user_id = $1', [grace]);
      const another = await bookings.create(c.id, body(c, { paymentMethod: 'BANK_TRANSFER', startAt: vn(MON, '17:00').toISOString(), endAt: vn(MON, '18:00').toISOString() }));
      await pool.query("UPDATE bookings SET payment_status = 'ESCROW_HELD' WHERE id = $1", [another.id]);
      await runInTransaction(pool, (db) => activateMatching(db, another.id, clock));
      await rejectsWith(radar.claimBooking(grace, another.id, 'JOB_BOARD'), 403, 'DEPOSIT_SHORTFALL');
      await rejectsWith(radar.claimBooking(graceOver, another.id, 'JOB_BOARD'), 403, 'DEPOSIT_SHORTFALL');
    });

    it('dismiss hides the offer; redispatch sends an urgent booking back to Radar without the released nurse', async () => {
      clock = T0;
      const c = await createCustomer();
      const first = await createNurse(NEAR);
      const second = await createNurse(NEAR);
      const view = await urgentBooking(c);

      expect(await radar.dismissRadar(second, view.id)).toEqual({ dismissed: true });
      expect(await radar.getRadarJob(second)).toBeNull();
      await rejectsWith(radar.claimBooking(second, view.id, 'RADAR'), 403, 'NO_ACTIVE_OFFER');

      await radar.claimBooking(first, view.id, 'RADAR');
      // tier-lifecycle takes the nurse off the booking (GPHN expired) and schedules a redispatch
      await pool.query("UPDATE bookings SET nurse_id = NULL, execution_status = 'MATCHING' WHERE id = $1", [view.id]);
      clock = T0 + 20 * MIN;
      const before = waveJobs(view.id).length;
      const r = await radar.redispatch({ bookingId: view.id, reason: 'NURSE_TIER_DEMOTED', releasedNurseId: first, matchingMode: 'RADAR_DISPATCH' as any });
      expect(r.matchingMode).toBe('RADAR_DISPATCH');
      const fresh = waveJobs(view.id).slice(before);
      expect(fresh).toHaveLength(1);
      expect(fresh[0].payload).toMatchObject({ wave: 1, excludeNurseIds: [first], startedAt: new Date(clock).toISOString() });

      // a booking that is no longer waiting for a nurse is left alone
      await pool.query("UPDATE bookings SET execution_status = 'CANCELLED' WHERE id = $1", [view.id]);
      expect((await radar.redispatch({ bookingId: view.id, reason: 'NURSE_TIER_DEMOTED', releasedNurseId: first, matchingMode: 'RADAR_DISPATCH' as any })).matchingMode).toBeNull();
    });
  });
});
