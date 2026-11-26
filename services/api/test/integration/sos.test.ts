import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { NotificationPriority, UserRole } from '@healthcare-system/shared';
import { closePool, query, withTransaction, type Queryable } from '../../src/core/database';
import { MockPushProvider, MockSmsProvider, URGENT_ACK_TIMEOUT_MS, createNotificationService, type NotificationService, type RealtimeEvent } from '../../src/core/notifications';
import { LocalRealtimeHub, PubSubRealtimeGateway } from '../../src/modules/notifications/notifications.realtime';
import type { Notify } from '../../src/modules/notifications/notifications.types';
import { SosService } from '../../src/modules/sos/sos.service';
import { FakeClockScheduler, createTestPool, createTestUser, findOrCreateAdmin } from './helpers';

/**
 * sos (BE-3 · Phase 4 · FR-SHIFT-05 · TC-SOS-01) trên PostgreSQL 16 thật, thông báo qua core/notifications thật:
 *  - điều dưỡng bấm SOS → gia đình + mọi Admin nhận cảnh báo HIGH (in-app + WebSocket + push) có GPS + sinh hiệu,
 *    tới WebSocket của gia đình < 2 giây; job SMS 60 giây được hẹn; biên bản RAISED trong emergency_incident_log;
 *  - bấm lại / app gửi lại hàng đợi offline / 5 lần song song → 1 cảnh báo, không báo trùng;
 *  - gia đình bấm → điều dưỡng nhận; người ngoài 403; ca đã xong 409;
 *  - gia đình xác nhận → ACKNOWLEDGED, SMS dự phòng của gia đình không gửi, điều dưỡng được báo;
 *  - điều dưỡng ghi biên bản; Admin đóng (kết quả + ghi chú) → CLOSED, audit, báo hai bên; sau đó bấm SOS mới được.
 */
describe('sos (integration)', () => {
  let pool: Pool;
  let admin: string;
  let serviceId: string;
  let hub: LocalRealtimeHub;
  let scheduler: FakeClockScheduler;
  let sms: MockSmsProvider;
  let dispatcher: NotificationService;
  let service: SosService;
  const HOUR = 3_600_000;
  const deps = { read: { query }, withTx: <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c)) };
  let slot = 0;

  async function shift(o: { status?: string } = {}) {
    const family = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Ngô Thị Bảy', '1940-01-01', 45, 'NORMAL', '7 Lê Lợi', 'HOME', 10.7760000, 106.7010000, TRUE, now()) RETURNING id`,
      [family],
    );
    const phone = `06${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const n = await pool.query("INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Trần Thị Mai', 'NURSE', 'ACTIVE') RETURNING id", [phone]);
    const nurse: string = n.rows[0].id;
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [nurse]);
    const start = Date.now() - HOUR - slot++ * 10 * HOUR;
    const code = `HC-S${randomUUID().slice(0, 10).toUpperCase()}`;
    const b = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method, start_time, end_time,
          base_amount, platform_fee, total_amount, execution_status, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', 'CASH', $6, $7, 500000, 75000, 500000, $8::execution_status_enum, 'UNPAID') RETURNING id`,
      [code, family, p.rows[0].id, nurse, serviceId, new Date(start), new Date(start + 4 * HOUR), o.status ?? 'IN_PROGRESS'],
    );
    const id: string = b.rows[0].id;
    await pool.query(
      `INSERT INTO shift_logs (booking_id, checkin_time, checkin_lat, checkin_lng, vital_signs_log)
       VALUES ($1, $2, 10.7761000, 106.7011000, $3::jsonb)`,
      [id, new Date(start), JSON.stringify([{ id: 'v1', kind: 'ROUTINE', recordedAt: new Date(start + 600_000).toISOString(), measuredAt: new Date(start).toISOString(), heartRate: 78, bloodPressureSystolic: 120, bloodPressureDiastolic: 80, temperature: 36.8, spo2: 97 }])],
    );
    return { id, code, family, nurse };
  }

  const sosNotices = async (alertId: string) =>
    (await pool.query(
      `SELECT user_id, channel::text AS channel, priority::text AS priority, title, body, data, acked_at FROM notifications WHERE type = 'SOS' AND data->>'alertId' = $1`,
      [alertId],
    )).rows;
  const incident = async (bookingId: string) => (await pool.query(`SELECT emergency_incident_log AS l FROM shift_logs WHERE booking_id = $1`, [bookingId])).rows[0].l as any[];

  beforeAll(async () => {
    pool = createTestPool();
    admin = await findOrCreateAdmin(pool);
    serviceId = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
  });

  beforeEach(() => {
    hub = new LocalRealtimeHub();
    scheduler = new FakeClockScheduler();
    sms = new MockSmsProvider();
    dispatcher = createNotificationService({ db: pool, push: new MockPushProvider(), sms, realtime: new PubSubRealtimeGateway(hub, null), scheduler, now: () => scheduler.now });
    const notify: Notify = async (n) => {
      await dispatcher.dispatch({ userId: n.userId, bookingId: n.bookingId ?? null, title: n.title, body: n.body, priority: n.priority, type: n.type, data: n.data });
    };
    service = new SosService({ ...deps, notify });
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('nurse raises SOS: family + Admins get a HIGH alert with GPS and vitals on their socket in < 2 s; SMS fallback scheduled; RAISED logged', async () => {
    const s = await shift();
    const received = new Promise<{ event: RealtimeEvent; ms: number }>((resolve) => {
      const t0 = Date.now();
      hub.subscribe(s.family, (event) => resolve({ event, ms: Date.now() - t0 }));
    });
    const r = await service.raise({ id: s.nurse, role: UserRole.NURSE }, s.id, { lat: 10.77612, lng: 106.70118, vitals: { heartRate: 132, spo2: 85, bloodPressureSystolic: 82, bloodPressureDiastolic: 48, temperature: 39.1 } });
    const { event, ms } = await received;
    expect(ms).toBeLessThan(2000); // TC-SOS-01
    expect(event).toMatchObject({ type: 'SOS', priority: 'HIGH', data: { alertId: r.alertId, bookingId: s.id, lat: '10.77612', lng: '106.70118' } });

    expect(r).toMatchObject({ triggered: true, emergency_id: r.alertId, created: true, status: 'ACTIVE', raisedBy: 'NURSE', bookingCode: s.code, patientName: 'Ngô Thị Bảy', nurseName: 'Trần Thị Mai', lat: 10.77612, lng: 106.70118 });
    expect(r.latestVitals).toMatchObject({ pulse: 132, spo2: 85, systolic: 82, diastolic: 48, temperatureC: 39.1 });

    const rows = await sosNotices(r.alertId);
    const users = new Set(rows.map((x) => x.user_id));
    expect(users.has(s.family)).toBe(true);
    expect(users.has(admin)).toBe(true);
    expect(users.has(s.nurse)).toBe(false); // the one who pressed is on the phone with 115
    const push = rows.find((x) => x.user_id === s.family && x.channel === 'PUSH_FCM')!;
    expect(push).toMatchObject({ priority: 'HIGH', title: `KHẨN CẤP · Ngô Thị Bảy · ca ${s.code}` });
    expect(push.body).toContain('Gọi 115');
    expect(push.body).toContain('maps?q=10.776120,106.701180');
    expect(push.body).toContain('mạch 132 · SpO2 85%');
    expect(scheduler.jobs.filter((j) => j.jobName === 'notifications.urgent-sms-fallback').length).toBe(users.size);

    expect(await incident(s.id)).toEqual([expect.objectContaining({ event: 'RAISED', alertId: r.alertId, by: s.nurse, role: 'NURSE', lat: 10.77612 })]);
  });

  it('pressing again, the offline replay and 5 presses at once → one alert, nobody alerted twice', async () => {
    const s = await shift();
    const results = await Promise.all(Array.from({ length: 5 }, () => service.raise({ id: s.nurse, role: UserRole.NURSE }, s.id, {})));
    expect(new Set(results.map((r) => r.alertId)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    const again = await service.raise({ id: s.family, role: UserRole.PATIENT }, s.id, {});
    expect(again).toMatchObject({ alertId: results[0].alertId, created: false, raisedBy: 'NURSE' });
    const familyRows = (await sosNotices(results[0].alertId)).filter((x) => x.user_id === s.family);
    expect(familyRows.map((x) => x.channel).sort()).toEqual(['IN_APP', 'PUSH_FCM']);
    expect((await pool.query(`SELECT count(*)::int AS n FROM sos_alerts WHERE booking_id = $1`, [s.id])).rows[0].n).toBe(1);
  });

  it('no vitals sent → the latest reading of the shift log; no GPS sent → the check-in position', async () => {
    const s = await shift();
    const r = await service.raise({ id: s.family, role: UserRole.PATIENT }, s.id, {});
    expect(r).toMatchObject({ raisedBy: 'FAMILY', lat: 10.7761, lng: 106.7011 });
    expect(r.latestVitals).toMatchObject({ id: 'v1', pulse: 78, spo2: 97, systolic: 120, diastolic: 80, temperatureC: 36.8 });
    const users = new Set((await sosNotices(r.alertId)).map((x) => x.user_id));
    expect(users.has(s.nurse)).toBe(true); // the family pressed: the nurse is alerted
    expect(users.has(s.family)).toBe(false);
  });

  it('a stranger → 403; a finished or unconfirmed booking → 409; nothing stored', async () => {
    const s = await shift();
    await expect(service.raise({ id: await createTestUser(pool), role: UserRole.PATIENT }, s.id, {})).rejects.toMatchObject({ status: 403 });
    await expect(service.raise({ id: s.nurse, role: UserRole.NURSE }, randomUUID(), {})).rejects.toMatchObject({ status: 403 });
    const done = await shift({ status: 'COMPLETED' });
    await expect(service.raise({ id: done.nurse, role: UserRole.NURSE }, done.id, {})).rejects.toMatchObject({ status: 409, code: 'SHIFT_NOT_ACTIVE' });
    expect((await pool.query(`SELECT count(*)::int AS n FROM sos_alerts WHERE booking_id = ANY($1::uuid[])`, [[s.id, done.id]])).rows[0].n).toBe(0);
  });

  it('family acknowledges → ACKNOWLEDGED, their SMS fallback is not sent (Admins still unacknowledged get one), the nurse is told', async () => {
    const s = await shift();
    const r = await service.raise({ id: s.nurse, role: UserRole.NURSE }, s.id, {});
    await expect(service.acknowledge({ id: s.nurse, role: UserRole.NURSE }, r.alertId)).rejects.toMatchObject({ status: 403 });
    await expect(service.acknowledge({ id: await createTestUser(pool), role: UserRole.PATIENT }, r.alertId)).rejects.toMatchObject({ status: 404 });
    const acked = await service.acknowledge({ id: s.family, role: UserRole.PATIENT }, r.alertId);
    expect(acked).toMatchObject({ status: 'ACKNOWLEDGED', acknowledgedAt: expect.any(String) });
    expect((await service.acknowledge({ id: s.family, role: UserRole.PATIENT }, r.alertId)).status).toBe('ACKNOWLEDGED'); // idempotent

    await scheduler.advance(URGENT_ACK_TIMEOUT_MS);
    const smsTo = new Set((await pool.query(`SELECT user_id FROM notifications WHERE channel = 'SMS_FALLBACK' AND type = 'SOS' AND data->>'alertId' = $1`, [r.alertId])).rows.map((x) => x.user_id));
    expect(smsTo.has(s.family)).toBe(false);
    expect(smsTo.has(admin)).toBe(true);
    const toNurse = await pool.query(`SELECT type FROM notifications WHERE user_id = $1 AND channel = 'IN_APP'`, [s.nurse]);
    expect(toNurse.rows.map((x) => x.type)).toContain('SOS_ACKNOWLEDGED');
    expect((await incident(s.id)).map((e) => e.event)).toEqual(['RAISED', 'ACKNOWLEDGED']);
  });

  it('nurse writes the report; Admin closes with the outcome (audited, both sides told); then a new SOS is possible', async () => {
    const s = await shift();
    const r = await service.raise({ id: s.nurse, role: UserRole.NURSE }, s.id, {});
    await expect(service.report({ id: s.family, role: UserRole.PATIENT }, r.alertId, { note: 'Gia đình ghi chú' })).rejects.toMatchObject({ status: 403 });
    expect(await service.report({ id: s.nurse, role: UserRole.NURSE }, r.alertId, { note: 'Đã gọi 115 lúc 09:06, sơ cứu, xe đến 09:18.', called115: true, hospital: 'BV Chợ Rẫy' })).toEqual({ updated: true });

    await expect(service.close(admin, r.alertId, { outcome: 'TRANSFERRED_TO_HOSPITAL', note: 'ngắn' })).rejects.toMatchObject({ status: 400 });
    const closed = await service.close(admin, r.alertId, { outcome: 'TRANSFERRED_TO_HOSPITAL', note: 'Người bệnh đã chuyển cấp cứu BV Chợ Rẫy.' }, '10.1.1.1');
    expect(closed).toMatchObject({ status: 'CLOSED', outcome: 'TRANSFERRED_TO_HOSPITAL', closedAt: expect.any(String) });
    await expect(service.close(admin, r.alertId, { outcome: 'FALSE_ALARM', note: 'Đóng lần hai cho cùng sự cố.' })).rejects.toMatchObject({ code: 'SOS_CLOSED' });

    const audit = await pool.query(`SELECT action_type::text AS a, actor_id, ip_address FROM audit_logs WHERE target_id = $1`, [r.alertId]);
    expect(audit.rows).toEqual([{ a: 'CLOSE_SOS_INCIDENT', actor_id: admin, ip_address: '10.1.1.1' }]);
    expect((await incident(s.id)).map((e) => e.event)).toEqual(['RAISED', 'REPORT', 'CLOSED']);
    expect((await incident(s.id))[1]).toMatchObject({ called115: true, hospital: 'BV Chợ Rẫy' });
    const told = await pool.query(`SELECT user_id FROM notifications WHERE type = 'SOS_CLOSED' AND data->>'alertId' = $1 AND channel = 'IN_APP'`, [r.alertId]);
    expect(new Set(told.rows.map((x) => x.user_id))).toEqual(new Set([s.family, s.nurse]));

    expect((await service.list({ id: s.family, role: UserRole.PATIENT }, 'OPEN')).items.map((a) => a.alertId)).not.toContain(r.alertId);
    expect((await service.forBooking({ id: s.family, role: UserRole.PATIENT }, s.id))).toMatchObject({ alertId: r.alertId, status: 'CLOSED' });
    expect((await service.adminDetail(r.alertId)).incidentLog).toHaveLength(3);
    const second = await service.raise({ id: s.nurse, role: UserRole.NURSE }, s.id, {});
    expect(second).toMatchObject({ created: true, status: 'ACTIVE' });
    expect(second.alertId).not.toBe(r.alertId);
  });

  it('lists: the family and the nurse see their bookings only; an Admin sees all', async () => {
    const a = await shift();
    const b = await shift();
    const ra = await service.raise({ id: a.nurse, role: UserRole.NURSE }, a.id, {});
    const rb = await service.raise({ id: b.family, role: UserRole.PATIENT }, b.id, {});
    const famA = (await service.list({ id: a.family, role: UserRole.PATIENT }, 'OPEN')).items.map((x) => x.alertId);
    expect(famA).toContain(ra.alertId);
    expect(famA).not.toContain(rb.alertId);
    expect((await service.list({ id: b.nurse, role: UserRole.NURSE }, undefined)).items.map((x) => x.alertId)).toEqual([rb.alertId]);
    const all = (await service.list({ id: admin, role: UserRole.ADMIN }, 'ACTIVE')).items.map((x) => x.alertId);
    expect(all).toEqual(expect.arrayContaining([ra.alertId, rb.alertId]));
    await expect(service.forBooking({ id: a.family, role: UserRole.PATIENT }, b.id)).rejects.toMatchObject({ status: 403 });
    expect(NotificationPriority.HIGH).toBe('HIGH');
  });
});
