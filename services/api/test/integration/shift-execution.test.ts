import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { closePool, runInTransaction } from '../../src/core/database';
import { getConfigNumber } from '../../src/core/config';
import { AppError } from '../../src/core/errors';
import * as storage from '../../src/core/storage';
import { CheckInService } from '../../src/modules/check-in/check-in.service';
import { CheckOutService } from '../../src/modules/check-out/check-out.service';
import { holdEscrow } from '../../src/modules/gateway-webhooks/gateway-webhooks.ledger';
import { signData } from '../../src/modules/gateway-webhooks/gateway-webhooks.policy';
import { GatewayWebhooksService } from '../../src/modules/gateway-webhooks/gateway-webhooks.service';
import { settleShift } from '../../src/modules/settlements/settlements.service';
import { ShiftLogsService, confirmConditionSurchargePayment } from '../../src/modules/shift-logs/shift-logs.service';
import type { ShiftNotice } from '../../src/modules/shift-logs/shift-logs.types';
import { createTestPool, createTestUser } from './helpers';

/**
 * Phase 4 (BE-2) trên PostgreSQL 16 thật (migration 0001 → 0024 + seed dịch vụ):
 * check-in → đánh giá ban đầu / sai lệch tình trạng → sinh hiệu, checklist, ghi chú → check-out,
 * và các điểm nối với module khác: webhook BE-3 (phụ phí chuyển khoản), quyết toán BE-3 sau 24h,
 * cửa sổ xem bệnh án 12h (privacy-consent BE-3), hạn hoa hồng tiền mặt (cash-commission BE-3).
 * Đồng hồ giả: ca bắt đầu Thứ 2 2026-11-16 08:00 giờ VN.
 */
describe('check-in + shift-logs + check-out (integration)', () => {
  let pool: Pool;
  let shifts: ShiftLogsService;
  let checkIn: CheckInService;
  let checkOut: CheckOutService;
  let webhooks: GatewayWebhooksService;

  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const vn = (hhmm: string, date = '2026-11-16') => new Date(`${date}T${hhmm}:00+07:00`).getTime();
  let clock = vn('07:00');
  const SECRET = 'test-webhook-secret';

  const CARE = { lat: 10.7769, lng: 106.7009 };
  const AT_DOOR = { lat: CARE.lat + 0.001, lng: CARE.lng }; // ≈ 111 m
  const ACROSS_TOWN = { lat: CARE.lat + 0.003, lng: CARE.lng }; // ≈ 334 m

  const notices: ShiftNotice[] = [];
  const events: { bookingId: string; change: string; status: string }[] = [];
  const objects = new Map<string, { size: number; head: Buffer }>();
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
  const PDF = Buffer.from('%PDF-1.7 fake...');

  let serviceShift4h: string;
  let serviceWound: string;
  let seq = 0;
  const RUN = Math.random().toString(36).slice(2, 5).toUpperCase().padEnd(3, 'X'); // codes stay unique across runs

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

  async function createNurse(): Promise<string> {
    const phone = `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Nguyễn Thị Hoa', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [rows[0].id]);
    await pool.query(`INSERT INTO wallets (user_id, deposit_balance) VALUES ($1, 300000)`, [rows[0].id]);
    return rows[0].id;
  }

  /** A CONFIRMED booking, as matching leaves it. Transfer bookings have their escrow held, like after the webhook. */
  async function confirmedBooking(o: {
    service?: string;
    method?: 'CASH' | 'BANK_TRANSFER';
    start?: string;
    end?: string;
    total?: number;
    mobility?: string;
  } = {}): Promise<{ id: string; code: string; customerId: string; nurseId: string }> {
    const customerId = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Lê Văn Bảy', '1948-03-20', 58, $4::mobility_status_enum, '12 Lê Lợi, Q1', 'HOME', $2, $3, TRUE, now()) RETURNING id`,
      [customerId, CARE.lat, CARE.lng, o.mobility ?? 'NORMAL'],
    );
    const nurseId = await createNurse();
    const total = o.total ?? 400_000;
    const fee = Math.floor(total * 0.15);
    seq += 1;
    const code = `HC-261116-${RUN}${String(seq).padStart(3, '0')}`;
    const method = o.method ?? 'CASH';
    const { rows } = await pool.query(
      `INSERT INTO bookings (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
                             start_time, end_time, base_amount, surcharge_amount, platform_fee, total_amount,
                             execution_status, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'RADAR_DISPATCH', $6::payment_method_enum, $7, $8, $9, 0, $10, $9, 'CONFIRMED',
               $11::payment_status_enum)
       RETURNING id`,
      [
        code,
        customerId,
        p.rows[0].id,
        nurseId,
        o.service ?? serviceShift4h,
        method,
        new Date(vn(o.start ?? '08:00')),
        new Date(vn(o.end ?? '12:00')),
        total,
        fee,
        method === 'BANK_TRANSFER' ? 'ESCROW_HELD' : 'UNPAID',
      ],
    );
    if (method === 'BANK_TRANSFER') {
      await runInTransaction(pool, (db) =>
        holdEscrow(db, { customerId, bookingId: rows[0].id, amount: total, idempotencyKey: `escrow-hold:test-${code}`, externalRef: `test-${code}` }),
      );
    }
    return { id: rows[0].id, code, customerId, nurseId };
  }

  /** Issues a selfie URL and "uploads" a JPEG to the fake storage. */
  async function freshSelfie(nurseId: string, bookingId: string, head = JPEG): Promise<string> {
    const u = await checkIn.requestSelfieUploadUrl(nurseId, bookingId, 'image/jpeg');
    objects.set(u.objectKey, { size: 120_000, head });
    return u.objectKey;
  }

  async function checkedIn(o: Parameters<typeof confirmedBooking>[0] = {}) {
    const b = await confirmedBooking(o);
    clock = vn(o.start ?? '08:00') - 5 * MIN;
    const selfieKey = await freshSelfie(b.nurseId, b.id);
    await checkIn.checkIn(b.nurseId, b.id, { ...AT_DOOR, latitude: AT_DOOR.lat, longitude: AT_DOOR.lng, isMockLocation: false, selfieKey });
    return b;
  }

  const vitals = (over: Record<string, unknown> = {}) => ({
    heartRate: 82,
    bloodPressureSystolic: 128,
    bloodPressureDiastolic: 78,
    temperature: 36.8,
    spo2: 97,
    ...over,
  });
  const row = async (id: string) => (await pool.query('SELECT * FROM bookings WHERE id = $1', [id])).rows[0] as Record<string, any>;
  const log = async (id: string) => (await pool.query('SELECT * FROM shift_logs WHERE booking_id = $1', [id])).rows[0] as Record<string, any>;
  const wallet = async (userId: string) => (await pool.query('SELECT * FROM wallets WHERE user_id = $1', [userId])).rows[0] as Record<string, any>;

  beforeAll(async () => {
    pool = createTestPool();
    const withTx = <T>(fn: (db: any) => Promise<T>) => runInTransaction(pool, fn);
    const now = () => clock;
    const notify = async (n: ShiftNotice) => {
      notices.push(n);
    };
    const publish = (bookingId: string, change: string, status: string) => {
      events.push({ bookingId, change, status });
    };
    shifts = new ShiftLogsService({
      read: pool,
      withTx,
      getNumber: getConfigNumber,
      receivingAccount: () => ({ bankBin: '970422', bankName: 'MB', accountNumber: '0001', accountName: 'CARENEST' }),
      selfieUrl: async (key) => `https://signed.test/${key}`,
      listExtensions: async () => [],
      notify,
      publish,
      now,
    });
    checkIn = new CheckInService({
      read: pool,
      withTx,
      getNumber: getConfigNumber,
      storage: {
        buildObjectKey: storage.buildObjectKey,
        createUploadUrl: async (key) => ({ url: `https://upload.test/${key}`, expiresInSeconds: 600 }),
        statObject: async (key) => (objects.has(key) ? { sizeBytes: objects.get(key)!.size, contentType: 'image/jpeg' } : null),
        readObjectHead: async (key) => objects.get(key)?.head ?? null,
      },
      maxUploadBytes: storage.MAX_UPLOAD_BYTES,
      shifts,
      notify,
      publish,
      now,
    });
    checkOut = new CheckOutService({ read: pool, withTx, getNumber: getConfigNumber, shifts, notify, publish, now });
    webhooks = new GatewayWebhooksService({
      read: pool,
      withTx,
      secret: () => SECRET,
      receivingAccount: () => ({ bankBin: '970422', bankName: 'MB', accountNumber: '0001', accountName: 'CARENEST' }),
      startRadar: async () => undefined,
      now,
    });
    serviceShift4h = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_SHIFT_4H'`)).rows[0].id;
    serviceWound = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  describe('check-in (FR-SHIFT-01)', () => {
    it('opens 30 min before the start and only for the assigned nurse', async () => {
      const b = await confirmedBooking();
      clock = vn('07:29');
      const e = await rejectsWith(checkIn.requestSelfieUploadUrl(b.nurseId, b.id, 'image/jpeg'), 409, 'TOO_EARLY_TO_CHECK_IN');
      expect((e.details as any).opensAt).toBe(new Date(vn('07:30')).toISOString());
      clock = vn('07:30');
      const other = await createNurse();
      await rejectsWith(checkIn.requestSelfieUploadUrl(other, b.id, 'image/jpeg'), 403, 'NOT_ASSIGNED_NURSE');
      await rejectsWith(checkIn.requestSelfieUploadUrl(b.nurseId, b.id, 'application/pdf'), 400, 'CONTENT_TYPE_NOT_ALLOWED');
      const u = await checkIn.requestSelfieUploadUrl(b.nurseId, b.id, 'image/jpeg');
      expect(u.objectKey.startsWith(`checkin-selfie/${b.nurseId}/`)).toBe(true);
      const issued = await pool.query('SELECT booking_id, nurse_id, used_at FROM checkin_selfie_uploads WHERE object_key = $1', [u.objectKey]);
      expect(issued.rows[0]).toEqual({ booking_id: b.id, nurse_id: b.nurseId, used_at: null });
    });

    it('a mock location is refused, logged, and flagged on the shift log; the booking stays CONFIRMED', async () => {
      const b = await confirmedBooking();
      clock = vn('07:55');
      const selfieKey = await freshSelfie(b.nurseId, b.id);
      await rejectsWith(
        checkIn.checkIn(b.nurseId, b.id, { latitude: AT_DOOR.lat, longitude: AT_DOOR.lng, isMockLocation: true, selfieKey }),
        403,
        'MOCK_LOCATION_DETECTED',
      );
      const attempts = await pool.query('SELECT outcome, is_mock_location FROM checkin_attempts WHERE booking_id = $1', [b.id]);
      expect(attempts.rows).toEqual([{ outcome: 'MOCK_LOCATION_DETECTED', is_mock_location: true }]);
      expect((await log(b.id)).is_mock_location_detected).toBe(true);
      expect((await row(b.id)).execution_status).toBe('CONFIRMED');
    });

    it('more than 200 m from the care address (Haversine) → 403 OUT_OF_RADIUS with the distance', async () => {
      const b = await confirmedBooking();
      clock = vn('07:55');
      const selfieKey = await freshSelfie(b.nurseId, b.id);
      const e = await rejectsWith(
        checkIn.checkIn(b.nurseId, b.id, { latitude: ACROSS_TOWN.lat, longitude: ACROSS_TOWN.lng, isMockLocation: false, selfieKey }),
        403,
        'OUT_OF_RADIUS',
      );
      expect((e.details as any).maxRadiusMeters).toBe(200);
      expect((e.details as any).distanceMeters).toBeGreaterThan(330);
      expect((await pool.query('SELECT outcome FROM checkin_attempts WHERE booking_id = $1', [b.id])).rows).toEqual([{ outcome: 'OUT_OF_RADIUS' }]);
      expect((await row(b.id)).execution_status).toBe('CONFIRMED');
    });

    it('the selfie must be a fresh, unused upload issued for this shift, and a real image', async () => {
      const b = await confirmedBooking();
      clock = vn('07:50');
      const at = { latitude: AT_DOOR.lat, longitude: AT_DOOR.lng, isMockLocation: false };
      // a key the API never handed out (e.g. a gallery photo uploaded another way)
      const foreign = storage.buildObjectKey('checkin-selfie', b.nurseId, 'image/jpeg');
      objects.set(foreign, { size: 1000, head: JPEG });
      await rejectsWith(checkIn.checkIn(b.nurseId, b.id, { ...at, selfieKey: foreign }), 400, 'SELFIE_NOT_ISSUED');
      // issued 11 minutes ago
      const old = await freshSelfie(b.nurseId, b.id);
      clock += 11 * MIN;
      await rejectsWith(checkIn.checkIn(b.nurseId, b.id, { ...at, selfieKey: old }), 400, 'SELFIE_EXPIRED');
      // issued but never uploaded
      const missing = (await checkIn.requestSelfieUploadUrl(b.nurseId, b.id, 'image/jpeg')).objectKey;
      await rejectsWith(checkIn.checkIn(b.nurseId, b.id, { ...at, selfieKey: missing }), 400, 'FILE_NOT_UPLOADED');
      // not an image
      const pdf = await freshSelfie(b.nurseId, b.id, PDF);
      await rejectsWith(checkIn.checkIn(b.nurseId, b.id, { ...at, selfieKey: pdf }), 400, 'FILE_TYPE_NOT_ALLOWED');
      const outcomes = (await pool.query('SELECT outcome FROM checkin_attempts WHERE booking_id = $1', [b.id])).rows.map((r: any) => r.outcome);
      expect(outcomes).toEqual(['INVALID_SELFIE', 'INVALID_SELFIE', 'INVALID_SELFIE', 'INVALID_SELFIE']);
      expect((await row(b.id)).execution_status).toBe('CONFIRMED');
    });

    it('at the door with a live selfie → IN_PROGRESS, server time + GPS stamped, checklist created, family told', async () => {
      const b = await confirmedBooking();
      clock = vn('07:58');
      const selfieKey = await freshSelfie(b.nurseId, b.id);
      const state = await checkIn.checkIn(b.nurseId, b.id, {
        latitude: AT_DOOR.lat,
        longitude: AT_DOOR.lng,
        isMockLocation: false,
        selfieKey,
      });
      expect(state.executionStatus).toBe('IN_PROGRESS');
      expect(state.checkedInAt).toBe(new Date(vn('07:58')).toISOString());
      expect(state.checkInDistanceMeters).toBeGreaterThan(100);
      expect(state.checkInDistanceMeters).toBeLessThan(120);
      expect(state.checkInWatermark).toBe('2026-11-16 07:58:00 · 10.77790, 106.70090');
      expect(state.checkInSelfieUrl).toBe(`https://signed.test/${selfieKey}`);
      expect(state.careActivities.map((a) => [a.id, a.mandatory, a.completed])).toEqual([
        ['INITIAL_VITALS', true, false],
        ['CARE_PROCEDURE', true, false],
        ['FINAL_VITALS_HANDOVER', true, false],
      ]);
      const l = await log(b.id);
      expect(new Date(l.checkin_time).getTime()).toBe(vn('07:58'));
      expect(l.checkin_selfie_url).toBe(selfieKey);
      expect((await row(b.id)).execution_status).toBe('IN_PROGRESS');
      expect(events.at(-1)).toEqual({ bookingId: b.id, change: 'CHECKED_IN', status: 'IN_PROGRESS' });
      expect(notices.at(-1)).toMatchObject({ userId: b.customerId, type: 'SHIFT_CHECKED_IN' });
      // the family sees the stamped selfie
      const t = await shifts.tracking(b.customerId, b.id);
      expect(t.checkIn).toMatchObject({ selfieUrl: `https://signed.test/${selfieKey}`, watermark: '2026-11-16 07:58:00 · 10.77790, 106.70090' });
      // the same photo cannot check in again; a second check-in is refused
      await rejectsWith(
        checkIn.checkIn(b.nurseId, b.id, { latitude: AT_DOOR.lat, longitude: AT_DOOR.lng, isMockLocation: false, selfieKey }),
        409,
        'ALREADY_CHECKED_IN',
      );
      // somebody else's booking is invisible to this customer
      await rejectsWith(shifts.tracking(await createTestUser(pool), b.id), 404, 'BOOKING_NOT_FOUND');
    });
  });

  describe('shift logs (FR-SHIFT-02)', () => {
    it('assessment, vitals (idempotent), checklist, notes; nothing is accepted before check-in', async () => {
      const pre = await confirmedBooking();
      clock = vn('07:55');
      await rejectsWith(shifts.addVitals(pre.nurseId, pre.id, vitals()), 409, 'NOT_CHECKED_IN');

      const b = await checkedIn();
      clock = vn('08:10');
      let s = await shifts.submitAssessment(b.nurseId, b.id, {
        actualMobility: 'NORMAL' as any,
        mentalStatus: 'Tỉnh táo',
        isConditionMatched: true,
        initialVitals: vitals(),
      });
      expect(s.assessmentCompleted).toBe(true);
      expect(s.careActivities.find((a) => a.id === 'INITIAL_VITALS')!.completed).toBe(true);
      expect(s.vitalSigns).toHaveLength(1);
      await rejectsWith(
        shifts.submitAssessment(b.nurseId, b.id, { actualMobility: 'NORMAL' as any, mentalStatus: 'x', isConditionMatched: true, initialVitals: vitals() }),
        409,
        'ASSESSMENT_ALREADY_SUBMITTED',
      );

      const id = '7f1d2c3b-1111-4222-8333-944455556666';
      clock = vn('09:00');
      s = await shifts.addVitals(b.nurseId, b.id, { ...vitals({ heartRate: 90 }), id, timestamp: new Date(vn('08:58')).toISOString() });
      s = await shifts.addVitals(b.nurseId, b.id, { ...vitals({ heartRate: 90 }), id, timestamp: new Date(vn('08:58')).toISOString() }); // offline retry
      expect(s.vitalSigns.map((v) => v.heartRate)).toEqual([82, 90]);
      await rejectsWith(
        shifts.addVitals(b.nurseId, b.id, { ...vitals(), timestamp: new Date(vn('09:30')).toISOString() }),
        400,
        'INVALID_MEASUREMENT_TIME',
      );

      await rejectsWith(shifts.setActivity(b.nurseId, b.id, 'NOPE', true), 404, 'ACTIVITY_NOT_FOUND');
      s = await shifts.setActivity(b.nurseId, b.id, 'CARE_PROCEDURE', true);
      expect(s.careActivities.find((a) => a.id === 'CARE_PROCEDURE')).toMatchObject({ completed: true, completedAt: new Date(vn('09:00')).toISOString() });

      const noteId = '8a1d2c3b-1111-4222-8333-944455556666';
      await shifts.addNote(b.nurseId, b.id, { id: noteId, text: 'Đã thay băng, vết thương khô.' });
      s = await shifts.addNote(b.nurseId, b.id, { id: noteId, text: 'Đã thay băng, vết thương khô.' });
      expect(s.progressNotes).toEqual(['Đã thay băng, vết thương khô.']);

      const t = await shifts.tracking(b.customerId, b.id);
      expect(t.vitals.map((v) => v.pulse)).toEqual([90, 82]); // newest first
      expect(t.activities.map((a) => a.text)).toEqual([
        'Đã hoàn thành: Thực hiện quy trình chăm sóc theo dịch vụ đã đặt',
        'Đã thay băng, vết thương khô.',
        'Đã hoàn thành: Đo sinh hiệu ban đầu (mạch, huyết áp, nhiệt độ, SpO2)',
      ]);
      expect(events.filter((e) => e.bookingId === b.id).map((e) => e.change)).toEqual(['CHECKED_IN', 'ASSESSMENT', 'VITALS', 'ACTIVITY', 'NOTE']);
      // another nurse cannot write into this shift
      await rejectsWith(shifts.addVitals(await createNurse(), b.id, vitals()), 403, 'NOT_ASSIGNED_NURSE');
    });

    it('a discrepancy can be reported only in the first 30 minutes', async () => {
      const b = await checkedIn({ mobility: 'NORMAL' });
      clock = vn('07:55') + 31 * MIN;
      await rejectsWith(
        shifts.submitAssessment(b.nurseId, b.id, {
          actualMobility: 'BEDRIDDEN' as any,
          mentalStatus: 'Lơ mơ',
          isConditionMatched: false,
          mismatchReason: 'Người bệnh nằm liệt giường, không khai báo',
          requestedAction: 'SURCHARGE',
          initialVitals: vitals(),
        }),
        409,
        'MISMATCH_WINDOW_CLOSED',
      );
      expect((await log(b.id)).assessed_at).toBe(null);
    });

    it('SURCHARGE when the price does not change → 409 SURCHARGE_NOT_APPLICABLE, nothing stored', async () => {
      const b = await checkedIn({ mobility: 'NORMAL' });
      clock = vn('08:05');
      await rejectsWith(
        shifts.submitAssessment(b.nurseId, b.id, {
          actualMobility: 'PARTIAL' as any,
          mentalStatus: 'Tỉnh',
          isConditionMatched: false,
          mismatchReason: 'Người bệnh đi lại khó khăn hơn khai báo',
          requestedAction: 'SURCHARGE',
          initialVitals: vitals(),
        }),
        409,
        'SURCHARGE_NOT_APPLICABLE',
      );
      expect((await log(b.id)).assessed_at).toBe(null);
      expect((await pool.query(`SELECT 1 FROM booking_adjustments WHERE booking_id = $1`, [b.id])).rows).toHaveLength(0);
    });

    it('cash: bedridden patient → +15% surcharge asked, family accepts → added to the bill; refusing is then closed', async () => {
      const b = await checkedIn({ mobility: 'NORMAL' });
      clock = vn('08:10');
      let s = await shifts.submitAssessment(b.nurseId, b.id, {
        actualMobility: 'BEDRIDDEN' as any,
        mentalStatus: 'Lơ mơ',
        isConditionMatched: false,
        mismatchReason: 'Người bệnh nằm liệt giường, không khai báo',
        requestedAction: 'SURCHARGE',
        initialVitals: vitals(),
      });
      expect(s.conditionMismatchReported).toBe(true);
      expect(s.conditionSurcharge).toMatchObject({ status: 'AWAITING_FAMILY', amount: 60_000, actualMobility: 'BEDRIDDEN' });
      expect(notices.at(-1)).toMatchObject({ userId: b.customerId, type: 'CONDITION_SURCHARGE_REQUEST', priority: 'HIGH' });

      await rejectsWith(shifts.respondSurcharge(await createTestUser(pool), b.id, true), 404, 'BOOKING_NOT_FOUND');
      const v = await shifts.respondSurcharge(b.customerId, b.id, true);
      expect(v.status).toBe('IN_EFFECT');
      const bk = await row(b.id);
      expect([Number(bk.total_amount), Number(bk.surcharge_amount), Number(bk.platform_fee)]).toEqual([460_000, 60_000, 69_000]);
      expect(notices.at(-1)).toMatchObject({ userId: b.nurseId, type: 'CONDITION_SURCHARGE_ANSWERED' });
      await rejectsWith(shifts.respondSurcharge(b.customerId, b.id, true), 404, 'SURCHARGE_NOT_FOUND');
      await rejectsWith(shifts.refuse(b.nurseId, b.id, 'Không đủ dụng cụ'), 409, 'SURCHARGE_IN_EFFECT');
      s = await shifts.shiftState(b.nurseId, b.id);
      expect(s.totalAmount).toBe(460_000);
    });

    it('transfer: accepted surcharge waits for its own transfer (-PT1); the signed webhook puts it in effect once', async () => {
      const b = await checkedIn({ method: 'BANK_TRANSFER', mobility: 'NORMAL' });
      clock = vn('08:10');
      await shifts.submitAssessment(b.nurseId, b.id, {
        actualMobility: 'BEDRIDDEN' as any,
        mentalStatus: 'Lơ mơ',
        isConditionMatched: false,
        mismatchReason: 'Người bệnh nằm liệt giường, không khai báo',
        requestedAction: 'SURCHARGE',
        initialVitals: vitals(),
      });
      const v = await shifts.respondSurcharge(b.customerId, b.id, true);
      expect(v).toMatchObject({ status: 'AWAITING_PAYMENT', amount: 60_000, paymentCode: `${b.code}-PT1` });
      expect(v.bankTransfer).toEqual({ bankName: 'MB', accountNumber: '0001', accountName: 'CARENEST', transferContent: `${b.code}-PT1` });
      expect(v.qrImageUrl).toContain(`${b.code}-PT1`);
      expect(Number((await row(b.id)).total_amount)).toBe(400_000); // not before the money

      const data = { orderCode: `${b.code}-PT1`, amount: 60_000, reference: `FT-${b.code}`, description: 'phu thu' };
      const body = { code: '00', desc: 'success', success: true, data, signature: signData(data, SECRET) };
      expect((await webhooks.handleEscrowWebhook(body)).outcome).toBe('SURCHARGE_PAID');
      expect((await webhooks.handleEscrowWebhook(body)).outcome).toBe('DUPLICATE');
      const bk = await row(b.id);
      expect([Number(bk.total_amount), Number(bk.platform_fee)]).toEqual([460_000, 69_000]);
      expect(Number((await wallet(b.customerId)).escrow_locked_balance)).toBe(460_000);
      expect((await shifts.shiftState(b.nurseId, b.id)).conditionSurcharge!.status).toBe('IN_EFFECT');
    });

    it('family declines → nurse refuses without penalty: CANCELLED, transfer refunded 100%, deposit untouched', async () => {
      const b = await checkedIn({ method: 'BANK_TRANSFER', mobility: 'NORMAL' });
      clock = vn('08:10');
      await rejectsWith(shifts.refuse(b.nurseId, b.id), 409, 'NO_MISMATCH_REPORTED');
      await shifts.submitAssessment(b.nurseId, b.id, {
        actualMobility: 'BEDRIDDEN' as any,
        mentalStatus: 'Lơ mơ',
        isConditionMatched: false,
        mismatchReason: 'Người bệnh nằm liệt giường, không khai báo',
        requestedAction: 'SURCHARGE',
        initialVitals: vitals(),
      });
      expect((await shifts.respondSurcharge(b.customerId, b.id, false)).status).toBe('DECLINED');
      clock = vn('08:50'); // after the 30 minutes: refusing a reported mismatch is still allowed
      const s = await shifts.refuse(b.nurseId, b.id, 'Gia đình không đồng ý phụ phí');
      expect(s.executionStatus).toBe('CANCELLED');
      const bk = await row(b.id);
      expect([bk.execution_status, bk.payment_status, bk.cancellation_reason, bk.cancelled_by]).toEqual([
        'CANCELLED',
        'REFUNDED',
        'CONDITION_MISMATCH',
        b.nurseId,
      ]);
      expect(Number((await wallet(b.customerId)).escrow_locked_balance)).toBe(0);
      const refund = await pool.query(`SELECT tx_type, amount FROM wallet_transactions WHERE idempotency_key = $1`, [`escrow-refund:condition-mismatch:${b.id}`]);
      expect(refund.rows.map((r: any) => [r.tx_type, Number(r.amount)])).toEqual([['REFUND', 400_000]]);
      const nurseWallet = await wallet(b.nurseId);
      expect(Number(nurseWallet.deposit_balance)).toBe(300_000);
      expect((await pool.query(`SELECT 1 FROM wallet_transactions WHERE wallet_id = $1`, [nurseWallet.id])).rows).toHaveLength(0);
      expect((await log(b.id)).mismatch_option).toBe('REFUSE');
      expect(notices.at(-1)).toMatchObject({ userId: b.customerId, type: 'BOOKING_CANCELLED' });
      // the slot is free again for the nurse (exclusion constraint only covers CONFIRMED / IN_PROGRESS)
      await rejectsWith(shifts.addVitals(b.nurseId, b.id, vitals()), 409, 'SHIFT_NOT_IN_PROGRESS');
    });

    it('REFUSE straight from the assessment (cash) cancels at once', async () => {
      const b = await checkedIn({ mobility: 'NORMAL' });
      clock = vn('08:05');
      const s = await shifts.submitAssessment(b.nurseId, b.id, {
        actualMobility: 'NORMAL' as any,
        mentalStatus: 'Kích động',
        isConditionMatched: false,
        mismatchReason: 'Môi trường có hành vi bạo lực, không an toàn',
        requestedAction: 'REFUSE',
        initialVitals: vitals(),
      });
      expect(s.executionStatus).toBe('CANCELLED');
      expect((await row(b.id)).payment_status).toBe('UNPAID');
    });
  });

  describe('check-out (FR-SHIFT-04)', () => {
    const report = (over: Record<string, unknown> = {}) => ({
      finalVitals: vitals({ heartRate: 78 }),
      completedActivityIds: ['CARE_PROCEDURE'],
      handoverNote: 'Huyết áp ổn định. Nhắc người nhà cho uống nước mỗi 2 giờ.',
      ...over,
    });

    it('shift-based: not before end − 15 min; blocked until the care report is complete; then COMPLETED with the clocks', async () => {
      const b = await checkedIn({ method: 'CASH' });
      clock = vn('11:44');
      const e = await rejectsWith(checkOut.checkOut(b.nurseId, b.id, report()), 409, 'SHIFT_NOT_FINISHED');
      expect((e.details as any).opensAt).toBe(new Date(vn('11:45')).toISOString());

      clock = vn('11:50');
      const missing = await rejectsWith(checkOut.checkOut(b.nurseId, b.id, report({ completedActivityIds: [] })), 400, 'CARE_REPORT_INCOMPLETE');
      expect((missing.details as any).missingActivityIds).toEqual(['INITIAL_VITALS', 'CARE_PROCEDURE']);
      await rejectsWith(checkOut.checkOut(b.nurseId, b.id, report({ completedActivityIds: ['INITIAL_VITALS', 'CARE_PROCEDURE', 'X'] })), 400, 'UNKNOWN_ACTIVITY');
      await rejectsWith(checkOut.checkOut(await createNurse(), b.id, report()), 403, 'NOT_ASSIGNED_NURSE');

      const s = await checkOut.checkOut(b.nurseId, b.id, report({ completedActivityIds: ['INITIAL_VITALS', 'CARE_PROCEDURE'] }));
      expect(s.executionStatus).toBe('COMPLETED');
      expect(s.checkedOutAt).toBe(new Date(vn('11:50')).toISOString());
      expect(s.careActivities.every((a) => a.completed)).toBe(true);
      expect(s.finalVitalSigns!.heartRate).toBe(78);
      expect(s.handoverNotes).toContain('Huyết áp ổn định');
      expect(s.checkout).toEqual({
        checkedOutAt: new Date(vn('11:50')).toISOString(),
        settlementEarliestAt: null,
        commissionDueAt: new Date(vn('11:50') + 24 * HOUR).toISOString(),
        recordAccessUntil: new Date(vn('11:50') + 12 * HOUR).toISOString(),
        reviewOpen: true,
      });
      const bk = await row(b.id);
      expect(bk.execution_status).toBe('COMPLETED');
      expect(new Date(bk.commission_due_at).getTime()).toBe(vn('11:50') + 24 * HOUR);
      expect(new Date((await log(b.id)).checkout_time).getTime()).toBe(vn('11:50'));
      expect(events.at(-1)).toEqual({ bookingId: b.id, change: 'CHECKED_OUT', status: 'COMPLETED' });
      expect(notices.slice(-2).map((n) => [n.userId, n.type])).toEqual([
        [b.customerId, 'SHIFT_COMPLETED'],
        [b.nurseId, 'COMMISSION_DUE'],
      ]);

      await rejectsWith(checkOut.checkOut(b.nurseId, b.id, report()), 409, 'ALREADY_CHECKED_OUT');
      await rejectsWith(shifts.addVitals(b.nurseId, b.id, vitals()), 409, 'SHIFT_NOT_IN_PROGRESS');
      // 12h medical-record window (privacy-consent, BE-3) anchored on checkout_time
      clock = vn('11:50') + 12 * HOUR - MIN;
      expect((await shifts.shiftState(b.nurseId, b.id)).executionStatus).toBe('COMPLETED');
      clock = vn('11:50') + 12 * HOUR;
      await rejectsWith(shifts.shiftState(b.nurseId, b.id), 403, 'RECORD_ACCESS_DENIED');
      // and the list hides the address after the window
      const item = (await shifts.listMyShifts(b.nurseId, 'completed')).find((i) => i.bookingId === b.id)!;
      expect([item.patientAddress, item.patientLatitude, item.netAmount]).toEqual([null, null, 340_000]);
    });

    it('task-based: paid 100% when the checklist is done, even early; amounts unchanged', async () => {
      const b = await checkedIn({ service: serviceWound, start: '08:00', end: '09:00', total: 200_000 });
      clock = vn('08:25');
      const s = await checkOut.checkOut(b.nurseId, b.id, report({ completedActivityIds: ['INITIAL_VITALS', 'CARE_PROCEDURE'] }));
      expect(s.executionStatus).toBe('COMPLETED');
      expect(Number((await row(b.id)).total_amount)).toBe(200_000);
    });

    it('transfer: checkout_time starts the 24h settlement window used by settlements (BE-3): 400k → 340k to the nurse', async () => {
      const b = await checkedIn({ method: 'BANK_TRANSFER' });
      clock = vn('12:00');
      const s = await checkOut.checkOut(b.nurseId, b.id, report({ completedActivityIds: ['INITIAL_VITALS', 'CARE_PROCEDURE'] }));
      expect(s.checkout!.settlementEarliestAt).toBe(new Date(vn('12:00') + 24 * HOUR).toISOString());
      expect((await row(b.id)).commission_due_at).toBe(null);

      const early = await runInTransaction(pool, (db) => settleShift(db, b.id, 'COOLING_ELAPSED', vn('12:00') + 24 * HOUR - MIN));
      expect(early).toMatchObject({ settled: false, reason: 'COOLING' });
      const done = await runInTransaction(pool, (db) => settleShift(db, b.id, 'COOLING_ELAPSED', vn('12:00') + 24 * HOUR));
      expect(done.settled).toBe(true);
      expect(Number((await wallet(b.nurseId)).available_balance)).toBe(340_000);
      expect((await row(b.id)).payment_status).toBe('SETTLED');
    });

    it('a surcharge transfer that arrives after the check-out is refunded 100%', async () => {
      const b = await checkedIn({ method: 'BANK_TRANSFER', mobility: 'NORMAL' });
      clock = vn('08:10');
      await shifts.submitAssessment(b.nurseId, b.id, {
        actualMobility: 'BEDRIDDEN' as any,
        mentalStatus: 'Lơ mơ',
        isConditionMatched: false,
        mismatchReason: 'Người bệnh nằm liệt giường, không khai báo',
        requestedAction: 'SURCHARGE',
        initialVitals: vitals(),
      });
      await shifts.respondSurcharge(b.customerId, b.id, true);
      clock = vn('11:55');
      await checkOut.checkOut(b.nurseId, b.id, report({ completedActivityIds: ['CARE_PROCEDURE'] }));
      const late = await runInTransaction(pool, (db) =>
        confirmConditionSurchargePayment(db, { paymentCode: `${b.code}-PT1`, amount: 60_000, providerRef: `LATE-${b.code}` }, clock),
      );
      expect(late.outcome).toBe('LATE_PAYMENT_REFUNDED');
      expect(Number((await row(b.id)).total_amount)).toBe(400_000);
      expect(Number((await wallet(b.customerId)).escrow_locked_balance)).toBe(400_000);
    });
  });

  it('GET /nurse/shifts groups my shifts by status', async () => {
    const b = await checkedIn();
    const upcoming = await confirmedBooking({ start: '14:00', end: '18:00' });
    const mine = await shifts.listMyShifts(b.nurseId);
    expect(mine.map((i) => [i.bookingId, i.executionStatus])).toEqual([[b.id, 'IN_PROGRESS']]);
    expect((await shifts.listMyShifts(upcoming.nurseId, 'upcoming')).map((i) => i.timeRange)).toEqual(['14:00–18:00']);
    expect(await shifts.listMyShifts(upcoming.nurseId, 'completed')).toEqual([]);
  });
});
