import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { closePool, query } from '../../src/core/database';
import { MemoryKeyValueStore } from '../../src/core/redis';
import type { Notice } from '../../src/modules/notifications/notifications.types';
import { OpsMonitoringService } from '../../src/modules/ops-monitoring/ops-monitoring.service';
import { thresholdsFromEnv, type CheckResult, type HealthReport } from '../../src/modules/ops-monitoring/ops-monitoring.types';
import { createTestPool, createTestUser, findOrCreateAdmin } from './helpers';

/**
 * ops-monitoring (BE-3 · Phase 8) trên PostgreSQL 16 thật. DB dev dùng chung nên mỗi kiểm tra được đo bằng
 * CHÊNH LỆCH trước / sau dữ liệu của chính test:
 *  - 8 kiểm tra, mỗi kiểm tra trỏ tới 1 runbook có thật trong docs/runbooks/;
 *  - webhook lỗi, SOS chưa xác nhận, hoa hồng quá hạn mà job không khóa, ca chậm quyết toán → ALERT;
 *  - hàng đợi job: cảnh báo / không kết nối / treo → ALERT / UNKNOWN / UNKNOWN (không bao giờ OK giả);
 *  - job quét: ghi [OPS][ALERT] và báo Admin, mỗi cảnh báo 1 lần trong cửa sổ lặp.
 */
describe('ops-monitoring (integration)', () => {
  let pool: Pool;
  let admin: string;
  let serviceId: string;
  let customer: { id: string; profile: string };
  const HOUR = 3_600_000;
  const healthy = { waiting: 0, active: 0, delayed: 0, failed: 0, deadLetters: 0, alert: false };
  const make = (over: Partial<ConstructorParameters<typeof OpsMonitoringService>[0]> = {}) =>
    new OpsMonitoringService({ read: { query }, backlog: async () => healthy, configNumber: async () => 24, thresholds: thresholdsFromEnv(), ...over });
  const check = (r: HealthReport, name: CheckResult['name']) => r.checks.find((c) => c.name === name)!;
  let slot = 0;

  async function nurse(): Promise<string> {
    const phone = `05${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query("INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng giám sát', 'NURSE', 'ACTIVE') RETURNING id", [phone]);
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [rows[0].id]);
    return rows[0].id;
  }

  async function booking(nurseId: string, o: { cash: boolean; dueHoursAgo?: number; checkoutHoursAgo?: number }): Promise<string> {
    const start = Date.now() - 60 * HOUR - slot++ * 5 * HOUR;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method, start_time, end_time,
          base_amount, platform_fee, total_amount, execution_status, payment_status, commission_due_at)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, 500000, 75000, 500000, 'COMPLETED',
               $9::payment_status_enum, $10)
       RETURNING id`,
      [
        `HC-O${randomUUID().slice(0, 10)}`,
        customer.id,
        customer.profile,
        nurseId,
        serviceId,
        o.cash ? 'CASH' : 'BANK_TRANSFER',
        new Date(start),
        new Date(start + 4 * HOUR),
        o.cash ? 'UNPAID' : 'ESCROW_HELD',
        o.cash ? new Date(Date.now() - (o.dueHoursAgo ?? 1) * HOUR) : null,
      ],
    );
    await pool.query(`INSERT INTO shift_logs (booking_id, checkin_time, checkout_time) VALUES ($1, $2, $3)`, [
      rows[0].id,
      new Date(start),
      new Date(Date.now() - (o.checkoutHoursAgo ?? 30) * HOUR),
    ]);
    return rows[0].id;
  }

  beforeAll(async () => {
    pool = createTestPool();
    admin = await findOrCreateAdmin(pool);
    serviceId = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
    const id = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Vũ Thị Lan', '1947-07-07', 46, 'NORMAL', '3 Nguyễn Huệ', 'HOME', 10.77, 106.70, TRUE, now()) RETURNING id`,
      [id],
    );
    customer = { id, profile: p.rows[0].id };
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('8 checks, each pointing to a runbook that exists', async () => {
    const r = await make().health();
    expect(r.checks.map((c) => c.name)).toEqual([
      'JOB_BACKLOG',
      'WEBHOOK_FAILURES',
      'SOS_UNACKNOWLEDGED',
      'URGENT_DELIVERY_FAILURES',
      'CASH_COMMISSION_OVERDUE',
      'SETTLEMENT_LAG',
      'FINANCE_HOLDS',
      'LEDGER_DRIFT',
    ]);
    for (const c of r.checks) expect(existsSync(resolve(__dirname, '../../../../docs/runbooks', c.runbook)), c.runbook).toBe(true);
    expect(['OK', 'WARN', 'ALERT', 'UNKNOWN']).toContain(r.status);
  });

  it('job queue: alert → ALERT, not connected → UNKNOWN, hanging → UNKNOWN (never a false OK)', async () => {
    expect(check(await make({ backlog: async () => ({ ...healthy, waiting: 500, alert: true }) }).health(), 'JOB_BACKLOG')).toMatchObject({ status: 'ALERT', value: { waiting: 500 } });
    expect(check(await make({ backlog: undefined }).health(), 'JOB_BACKLOG').status).toBe('UNKNOWN');
    const hanging = make({ backlog: () => new Promise(() => undefined), checkTimeoutMs: 100 });
    expect(check(await hanging.health(), 'JOB_BACKLOG')).toMatchObject({ status: 'UNKNOWN', summary: expect.stringContaining('timed out') });
  });

  it('webhook problems in the window and an unacknowledged SOS raise ALERTs', async () => {
    const svc = make();
    const before = await svc.health();
    for (let i = 0; i < 3; i += 1) {
      await pool.query(
        `INSERT INTO payment_webhook_events (provider_ref, order_code, amount, outcome, payload) VALUES ($1, 'HC-OPS-TEST', 1000, 'AMOUNT_MISMATCH', '{}'::jsonb)`,
        [`FT-OPS-${randomUUID().slice(0, 8)}`],
      );
    }
    const user = await createTestUser(pool);
    const sos = await pool.query(
      `INSERT INTO notifications (user_id, title, channel, priority, type, created_at) VALUES ($1, 'SOS', 'PUSH_FCM', 'HIGH', 'SOS', now() - interval '5 minutes') RETURNING id`,
      [user],
    );
    const after = await svc.health();
    expect(Number(check(after, 'WEBHOOK_FAILURES').value.total) - Number(check(before, 'WEBHOOK_FAILURES').value.total)).toBe(3);
    expect(check(after, 'WEBHOOK_FAILURES').status).toBe('ALERT');
    expect(Number(check(after, 'SOS_UNACKNOWLEDGED').value.count) - Number(check(before, 'SOS_UNACKNOWLEDGED').value.count)).toBe(1);
    expect(check(after, 'SOS_UNACKNOWLEDGED').status).toBe('ALERT');
    await pool.query(`UPDATE notifications SET acked_at = now() WHERE id = $1`, [sos.rows[0].id]);
    expect(Number(check(await svc.health(), 'SOS_UNACKNOWLEDGED').value.count)).toBe(Number(check(before, 'SOS_UNACKNOWLEDGED').value.count));
  });

  it('an overdue cash commission whose nurse is still ACTIVE, and a transfer shift not settled after cooling + lag → ALERT', async () => {
    const svc = make();
    const before = await svc.health();
    await booking(await nurse(), { cash: true, dueHoursAgo: 2 }); // overdue 2 h, nurse still ACTIVE: the sweep missed it
    await booking(await nurse(), { cash: false, checkoutHoursAgo: 30 }); // cooling 24 h + lag 2 h passed
    await booking(await nurse(), { cash: false, checkoutHoursAgo: 25 }); // still inside the lag: not counted
    const after = await svc.health();
    const c = check(after, 'CASH_COMMISSION_OVERDUE');
    expect(Number(c.value.notSuspended) - Number(check(before, 'CASH_COMMISSION_OVERDUE').value.notSuspended)).toBe(1);
    expect(c.status).toBe('ALERT');
    const s = check(after, 'SETTLEMENT_LAG');
    expect(Number(s.value.count) - Number(check(before, 'SETTLEMENT_LAG').value.count)).toBe(1);
    expect(s.status).toBe('ALERT');
  });

  it('sweep: every ALERT is logged and notified to each active Admin once per repeat window', async () => {
    const sent: Notice[] = [];
    const lines: string[] = [];
    const store = new MemoryKeyValueStore();
    const svc = make({ backlog: async () => ({ ...healthy, deadLetters: 2, alert: true }), store, notify: async (n) => void sent.push(n), log: (l) => lines.push(l) });
    const first = await svc.sweep();
    expect(first.alerts).toBeGreaterThanOrEqual(1);
    expect(first.notified).toBe(first.alerts);
    expect(lines.some((l) => l.startsWith('[OPS][ALERT]') && l.includes('"check":"JOB_BACKLOG"'))).toBe(true);
    const toAdmin = sent.filter((n) => n.userId === admin && n.data?.check === 'JOB_BACKLOG');
    expect(toAdmin).toEqual([expect.objectContaining({ type: 'OPS_ALERT', priority: 'NORMAL', data: { check: 'JOB_BACKLOG', runbook: 'monitoring-and-alerts.md' } })]);

    const second = await svc.sweep();
    expect(second.notified).toBe(0); // same alerts, same window: logged again, not notified again
    expect(sent.filter((n) => n.data?.check === 'JOB_BACKLOG' && n.userId === admin)).toHaveLength(1);
  });
});
