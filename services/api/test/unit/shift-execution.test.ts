import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { WebSocket } from 'ws';
import { checkInOpensAt, checkInProblem, distanceToCare, selfieProblem, withinRadius } from '../../src/modules/check-in/check-in.policy';
import { checkInSchema } from '../../src/modules/check-in/check-in.schema';
import { checkOutOpensAt, checkOutProblem } from '../../src/modules/check-out/check-out.policy';
import { checkOutSchema } from '../../src/modules/check-out/check-out.schema';
import {
  ageOn,
  completeItems,
  defaultChecklist,
  isConditionSurchargePaymentCode,
  measuredAtProblem,
  missingMandatory,
  mismatchWindowOpen,
  setItem,
  surchargeDelta,
  surchargePaymentCode,
  surchargeViewStatus,
  watermarkText,
  withinRecordWindow,
} from '../../src/modules/shift-logs/shift-logs.policy';
import { ShiftHub, ShiftPublisher, attachShiftSocket } from '../../src/modules/shift-logs/shift-logs.realtime';
import { assessmentSchema, vitalsSchema } from '../../src/modules/shift-logs/shift-logs.schema';
import { SelfieUnreadableError, stampSelfie, stampSvg } from '../../src/modules/check-in/check-in.watermark';
import sharp from 'sharp';

const MIN = 60_000;
const HOUR = 60 * MIN;
const vn = (hhmm: string, date = '2026-11-16') => new Date(`${date}T${hhmm}:00+07:00`).getTime();

describe('check-in policy (FR-SHIFT-01)', () => {
  const b = { nurseId: 'n1', executionStatus: 'CONFIRMED', startMs: vn('08:00'), endMs: vn('12:00') };

  it('opens CHECKIN_OPENS_BEFORE_START_MINUTES before the start, closes at the scheduled end', () => {
    expect(checkInOpensAt(vn('08:00'), 30)).toBe(vn('07:30'));
    expect(checkInProblem(b, 'n1', vn('07:29'), 30)).toBe('TOO_EARLY_TO_CHECK_IN');
    expect(checkInProblem(b, 'n1', vn('07:30'), 30)).toBe(null);
    expect(checkInProblem(b, 'n1', vn('11:59'), 30)).toBe(null);
    expect(checkInProblem(b, 'n1', vn('12:00'), 30)).toBe('SHIFT_ALREADY_ENDED');
  });

  it('only the assigned nurse, only a CONFIRMED booking', () => {
    expect(checkInProblem(b, 'n2', vn('08:00'), 30)).toBe('NOT_ASSIGNED_NURSE');
    expect(checkInProblem({ ...b, executionStatus: 'IN_PROGRESS' }, 'n1', vn('08:00'), 30)).toBe('ALREADY_CHECKED_IN');
    expect(checkInProblem({ ...b, executionStatus: 'MATCHING' }, 'n1', vn('08:00'), 30)).toBe('BOOKING_NOT_CONFIRMED');
    expect(checkInProblem({ ...b, executionStatus: 'CANCELLED' }, 'n1', vn('08:00'), 30)).toBe('BOOKING_NOT_CONFIRMED');
  });

  it('Haversine distance; 200 m is still inside, 200.1 m is not', () => {
    const care = { lat: 10.7769, lng: 106.7009 };
    expect(distanceToCare(care, care)).toBe(0);
    const d = distanceToCare({ lat: care.lat + 0.0018, lng: care.lng }, care);
    expect(d).toBeGreaterThan(199);
    expect(d).toBeLessThan(201);
    expect(withinRadius(200, 200)).toBe(true);
    expect(withinRadius(200.1, 200)).toBe(false);
  });

  it('selfie: issued for this booking + nurse, unused, at most N minutes old', () => {
    const u = { object_key: 'k', booking_id: 'b1', nurse_id: 'n1', content_type: 'image/jpeg', issued_at: new Date(vn('07:50')), used_at: null };
    const p = { bookingId: 'b1', nurseId: 'n1', nowMs: vn('08:00'), maxAgeMinutes: 10 };
    expect(selfieProblem(u, p)).toBe(null);
    expect(selfieProblem(u, { ...p, nowMs: vn('08:00') + 1 })).toBe('SELFIE_EXPIRED');
    expect(selfieProblem({ ...u, used_at: new Date() }, p)).toBe('SELFIE_ALREADY_USED');
    expect(selfieProblem({ ...u, booking_id: 'b2' }, p)).toBe('SELFIE_NOT_ISSUED');
    expect(selfieProblem({ ...u, nurse_id: 'n2' }, p)).toBe('SELFIE_NOT_ISSUED');
    expect(selfieProblem(null, p)).toBe('SELFIE_NOT_ISSUED');
  });

  it('schema: a selfie key is required, base64 photos are not accepted (1 MB body limit)', () => {
    expect(checkInSchema.safeParse({ latitude: 10.7, longitude: 106.7, isMockLocation: false, selfieKey: 'k' }).success).toBe(true);
    expect(checkInSchema.safeParse({ latitude: 10.7, longitude: 106.7, isMockLocation: false }).success).toBe(false);
    expect(checkInSchema.safeParse({ latitude: 10.7, longitude: 106.7, isMockLocation: false, selfieKey: 'k', selfieImageBase64: 'xx' }).success).toBe(false);
    expect(checkInSchema.safeParse({ latitude: 91, longitude: 106.7, isMockLocation: false, selfieKey: 'k' }).success).toBe(false);
  });
});

describe('selfie stamp (SRS RISK-05 / NFR-SEC-01: server time + GPS burnt into the photo)', () => {
  it('the band text is XML-escaped and sized to the photo', () => {
    const { svg, height } = stampSvg(1080, ['A & B <x>', '2026-11-16 07:58:00 · 10.77790, 106.70090 (GMT+7)']);
    const text = svg.toString();
    expect(text).toContain('A &amp; B &lt;x&gt;');
    expect(text).toContain('2026-11-16 07:58:00 · 10.77790, 106.70090 (GMT+7)');
    expect(height).toBeGreaterThan(80);
  });

  it('re-encodes as JPEG ≤ 1080×1440, applies EXIF rotation, drops metadata, darkens the bottom band', async () => {
    const photo = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: '#d0d0d0' } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Make: 'PhoneCam' } } })
      .toBuffer();
    const out = await stampSelfie(photo, ['HealthCareSystem · Check-in HC-261116-AB12CD', '2026-11-16 07:58:00 · 10.77790, 106.70090 (GMT+7)']);
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height, meta.exif]).toEqual(['jpeg', 1080, 1440, undefined]);
    const mean = async (top: number) =>
      (await sharp(await sharp(out).extract({ left: 0, top, width: 1080, height: 10 }).toBuffer()).stats()).channels[0].mean;
    expect(await mean(1428)).toBeLessThan((await mean(50)) - 60);
  });

  it('bytes that are not a photo → SelfieUnreadableError', async () => {
    let err: unknown;
    try {
      await stampSelfie(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]), ['x']);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SelfieUnreadableError);
  });
});

describe('shift-logs policy (FR-SHIFT-02)', () => {
  it('checklist: verifying the medical order is added only for invasive services', () => {
    expect(defaultChecklist(false).map((i) => i.id)).toEqual(['INITIAL_VITALS', 'CARE_PROCEDURE', 'FINAL_VITALS_HANDOVER']);
    expect(defaultChecklist(true).map((i) => i.id)).toEqual(['INITIAL_VITALS', 'VERIFY_ORDER', 'CARE_PROCEDURE', 'FINAL_VITALS_HANDOVER']);
    expect(defaultChecklist(true).every((i) => i.mandatory && !i.completed)).toBe(true);
  });

  it('complete / toggle keep the first completion time; unknown ids are reported', () => {
    const items = defaultChecklist(false);
    const a = completeItems(items, ['INITIAL_VITALS', 'NOPE'], '2026-11-16T01:00:00.000Z');
    expect(a.unknown).toEqual(['NOPE']);
    const again = completeItems(a.items, ['INITIAL_VITALS'], '2026-11-16T02:00:00.000Z');
    expect(again.items[0].completedAt).toBe('2026-11-16T01:00:00.000Z');
    expect(missingMandatory(again.items)).toEqual(['CARE_PROCEDURE', 'FINAL_VITALS_HANDOVER']);
    const off = setItem(again.items, 'INITIAL_VITALS', false, 'x')!;
    expect(off[0]).toMatchObject({ completed: false, completedAt: null });
    expect(setItem(items, 'NOPE', true, 'x')).toBe(null);
  });

  it('discrepancy window: the first 30 minutes after check-in', () => {
    expect(mismatchWindowOpen(vn('08:00'), vn('08:30'), 30)).toBe(true);
    expect(mismatchWindowOpen(vn('08:00'), vn('08:30') + 1, 30)).toBe(false);
  });

  it('measurement time: not in the future, not before the check-in (5 min skew allowed)', () => {
    const checkin = vn('08:00');
    const now = vn('09:00');
    expect(measuredAtProblem(undefined, checkin, now)).toBe(false);
    expect(measuredAtProblem(new Date(vn('09:05')).toISOString(), checkin, now)).toBe(false);
    expect(measuredAtProblem(new Date(vn('09:06')).toISOString(), checkin, now)).toBe(true);
    expect(measuredAtProblem(new Date(vn('07:55')).toISOString(), checkin, now)).toBe(false);
    expect(measuredAtProblem(new Date(vn('07:54')).toISOString(), checkin, now)).toBe(true);
    expect(measuredAtProblem('not a date', checkin, now)).toBe(true);
  });

  it('surcharge = difference of two quotes (only the patient changes); never negative', () => {
    const declared = { baseAmount: 400_000, surchargeAmount: 0, platformFee: 60_000, totalAmount: 400_000 };
    const actual = { baseAmount: 400_000, surchargeAmount: 60_000, platformFee: 69_000, totalAmount: 460_000 };
    expect(surchargeDelta(declared, actual)).toEqual({ baseAmount: 0, surchargeAmount: 60_000, platformFee: 9_000, totalAmount: 60_000 });
    expect(surchargeDelta(actual, declared).totalAmount).toBe(0);
  });

  it('surcharge statuses and payment code', () => {
    expect(surchargeViewStatus({ status: 'REQUESTED' as any, applied_at: null })).toBe('AWAITING_FAMILY');
    expect(surchargeViewStatus({ status: 'ACCEPTED' as any, applied_at: null })).toBe('AWAITING_PAYMENT');
    expect(surchargeViewStatus({ status: 'ACCEPTED' as any, applied_at: new Date() })).toBe('IN_EFFECT');
    expect(surchargeViewStatus({ status: 'PAID' as any, applied_at: new Date() })).toBe('IN_EFFECT');
    expect(surchargeViewStatus({ status: 'REJECTED' as any, applied_at: null })).toBe('DECLINED');
    expect(surchargeViewStatus({ status: 'EXPIRED' as any, applied_at: null })).toBe('EXPIRED');
    expect(surchargePaymentCode('HC-261116-ABC123', 2)).toBe('HC-261116-ABC123-PT2');
    expect(isConditionSurchargePaymentCode('HC-261116-ABC123-PT2')).toBe(true);
    expect(isConditionSurchargePaymentCode('HC-261116-ABC123-GH2')).toBe(false); // extension
    expect(isConditionSurchargePaymentCode('HC-261116-ABC123')).toBe(false);
  });

  it('watermark = Vietnam server time + GPS, record window = until check-out + 12h', () => {
    expect(watermarkText(vn('08:02') + 11_000, 16.0717, 108.2208)).toBe('2026-11-16 08:02:11 · 16.07170, 108.22080');
    const done = { execution_status: 'COMPLETED' as any, checkout_time: new Date(vn('12:00')) };
    expect(withinRecordWindow(done, vn('12:00') + 12 * HOUR - 1, 12)).toBe(true);
    expect(withinRecordWindow(done, vn('12:00') + 12 * HOUR, 12)).toBe(false);
    expect(withinRecordWindow({ execution_status: 'IN_PROGRESS' as any, checkout_time: null }, vn('23:00'), 12)).toBe(true);
    expect(withinRecordWindow({ execution_status: 'CANCELLED' as any, checkout_time: null }, vn('09:00'), 12)).toBe(false);
  });

  it('age from a DATE column (string or local-midnight Date)', () => {
    expect(ageOn('1948-11-16', vn('09:00'))).toBe(78);
    expect(ageOn('1948-11-17', vn('09:00'))).toBe(77);
    expect(ageOn(new Date(1948, 10, 16), vn('09:00'))).toBe(78);
    expect(ageOn(null, vn('09:00'))).toBe(null);
  });

  it('vitals schema rejects typing mistakes, not abnormal patients', () => {
    const ok = { heartRate: 130, bloodPressureSystolic: 180, bloodPressureDiastolic: 110, temperature: 39.5, spo2: 88 };
    expect(vitalsSchema.safeParse(ok).success).toBe(true);
    expect(vitalsSchema.safeParse({ ...ok, heartRate: 1200 }).success).toBe(false);
    expect(vitalsSchema.safeParse({ ...ok, bloodPressureDiastolic: 190 }).success).toBe(false);
    expect(vitalsSchema.safeParse({ ...ok, bloodPressureDiastolic: 180 }).success).toBe(false); // not below systolic
    expect(vitalsSchema.safeParse({ ...ok, spo2: 101 }).success).toBe(false);
  });

  it('assessment schema: a discrepancy needs a reason and an action', () => {
    const v = { heartRate: 80, bloodPressureSystolic: 120, bloodPressureDiastolic: 80, temperature: 37, spo2: 98 };
    const base = { actualMobility: 'BEDRIDDEN', mentalStatus: 'Tỉnh', initialVitals: v };
    expect(assessmentSchema.safeParse({ ...base, isConditionMatched: true }).success).toBe(true);
    expect(assessmentSchema.safeParse({ ...base, isConditionMatched: false }).success).toBe(false);
    expect(assessmentSchema.safeParse({ ...base, isConditionMatched: false, mismatchReason: 'Liệt giường', requestedAction: 'SURCHARGE' }).success).toBe(true);
    expect(assessmentSchema.safeParse({ ...base, isConditionMatched: false, mismatchReason: 'Liệt giường', requestedAction: 'OTHER' }).success).toBe(false);
  });
});

describe('check-out policy (FR-SHIFT-04)', () => {
  const b = { nurseId: 'n1', executionStatus: 'IN_PROGRESS', serviceType: 'SHIFT_BASED', endMs: vn('12:00') };

  it('shift-based: from the scheduled end − tolerance; task-based: any time', () => {
    expect(checkOutOpensAt('SHIFT_BASED', vn('12:00'), 15)).toBe(vn('11:45'));
    expect(checkOutOpensAt('TASK_BASED', vn('12:00'), 15)).toBe(null);
    expect(checkOutProblem(b, 'n1', vn('11:44'), 15)).toBe('SHIFT_NOT_FINISHED');
    expect(checkOutProblem(b, 'n1', vn('11:45'), 15)).toBe(null);
    expect(checkOutProblem({ ...b, serviceType: 'TASK_BASED' }, 'n1', vn('08:10'), 15)).toBe(null);
  });

  it('only the assigned nurse, only a running shift', () => {
    expect(checkOutProblem(b, 'n2', vn('12:00'), 15)).toBe('NOT_ASSIGNED_NURSE');
    expect(checkOutProblem({ ...b, executionStatus: 'CONFIRMED' }, 'n1', vn('12:00'), 15)).toBe('NOT_CHECKED_IN');
    expect(checkOutProblem({ ...b, executionStatus: 'COMPLETED' }, 'n1', vn('12:00'), 15)).toBe('ALREADY_CHECKED_OUT');
    expect(checkOutProblem({ ...b, executionStatus: 'CANCELLED' }, 'n1', vn('12:00'), 15)).toBe('SHIFT_NOT_IN_PROGRESS');
  });

  it('schema: final vitals and a real handover note are mandatory', () => {
    const v = { heartRate: 80, bloodPressureSystolic: 120, bloodPressureDiastolic: 80, temperature: 37, spo2: 98 };
    expect(checkOutSchema.safeParse({ finalVitals: v, completedActivityIds: [], handoverNote: 'Ổn định, theo dõi thêm.' }).success).toBe(true);
    expect(checkOutSchema.safeParse({ completedActivityIds: [], handoverNote: 'Ổn định, theo dõi thêm.' }).success).toBe(false);
    expect(checkOutSchema.safeParse({ finalVitals: v, completedActivityIds: [], handoverNote: 'ok' }).success).toBe(false);
  });
});

describe('real-time shift updates (WebSocket /ws/shifts)', () => {
  let server: Server;
  let port: number;
  const hub = new ShiftHub();
  const BOOKING = '11111111-2222-4333-8444-555555555555';
  const users: Record<string, { id: string; role: any }> = { 'tok-family': { id: 'u-family', role: 'PATIENT' }, 'tok-other': { id: 'u-other', role: 'PATIENT' } };
  let socket: { close(): Promise<void>; clients(): number };

  beforeAll(async () => {
    server = createServer();
    socket = attachShiftSocket(server, {
      verify: async (t) => users[t] ?? null,
      canWatch: async (bookingId, user) => bookingId === BOOKING && user.id === 'u-family',
      hub,
    });
    await new Promise<void>((r) => server.listen(0, r));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    await socket.close();
    await new Promise<void>((r) => server.close(() => r()));
  });

  const connect = (query: string) =>
    new Promise<{ ws?: WebSocket; status?: number }>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/shifts?${query}`);
      ws.on('open', () => resolve({ ws }));
      ws.on('unexpected-response', (_req: unknown, res: { statusCode: number }) => resolve({ status: res.statusCode }));
      ws.on('error', () => undefined);
    });

  it('no token → 401, not the family of this booking → 403, bad booking id → 400', async () => {
    expect((await connect(`bookingId=${BOOKING}`)).status).toBe(401);
    expect((await connect(`bookingId=${BOOKING}&access_token=tok-other`)).status).toBe(403);
    expect((await connect(`bookingId=nope&access_token=tok-family`)).status).toBe(400);
  });

  it('the family receives SHIFT_UPDATED (no patient data) when the shift changes', async () => {
    const { ws } = await connect(`bookingId=${BOOKING}&access_token=tok-family`);
    const got = new Promise<any>((resolve) => ws!.on('message', (m: Buffer) => resolve(JSON.parse(m.toString()))));
    new ShiftPublisher(hub, null).publish(BOOKING, 'VITALS', 'IN_PROGRESS' as any);
    const msg = await got;
    expect(msg).toMatchObject({ type: 'SHIFT_UPDATED', bookingId: BOOKING, change: 'VITALS', executionStatus: 'IN_PROGRESS' });
    expect(Object.keys(msg).sort()).toEqual(['at', 'bookingId', 'change', 'executionStatus', 'type']);
    ws!.close();
  });
});
