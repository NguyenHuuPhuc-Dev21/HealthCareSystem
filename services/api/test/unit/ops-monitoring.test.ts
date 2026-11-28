import { describe, expect, it } from 'vitest';
import { alertKey, commissionStatus, countStatus, deliveryStatus, overall, webhookStatus } from '../../src/modules/ops-monitoring/ops-monitoring.policy';
import { thresholdsFromEnv } from '../../src/modules/ops-monitoring/ops-monitoring.types';

/** ops-monitoring (BE-3 · Phase 8): status rules — no DB, no clock. */
describe('ops-monitoring policy', () => {
  const t = thresholdsFromEnv();

  it('overall: the worst status wins; UNKNOWN never hides a WARN or ALERT', () => {
    expect(overall([])).toBe('OK');
    expect(overall([{ status: 'OK' }, { status: 'UNKNOWN' }])).toBe('UNKNOWN');
    expect(overall([{ status: 'UNKNOWN' }, { status: 'WARN' }])).toBe('WARN');
    expect(overall([{ status: 'WARN' }, { status: 'ALERT' }, { status: 'UNKNOWN' }])).toBe('ALERT');
  });

  it('webhook problems: default WARN from 1, ALERT from 3 in the window', () => {
    expect([0, 1, 2, 3].map((n) => webhookStatus(n, t))).toEqual(['OK', 'WARN', 'WARN', 'ALERT']);
  });

  it('cash commission: overdue is expected (WARN), an overdue nurse still ACTIVE means the sweep is down (ALERT)', () => {
    expect(commissionStatus(0, 0)).toBe('OK');
    expect(commissionStatus(4, 0)).toBe('WARN');
    expect(commissionStatus(4, 1)).toBe('ALERT');
  });

  it('deliveries: a failed SMS fallback is an ALERT, failed pushes alone a WARN; counts', () => {
    expect(deliveryStatus(0, 0)).toBe('OK');
    expect(deliveryStatus(0, 2)).toBe('WARN');
    expect(deliveryStatus(1, 0)).toBe('ALERT');
    expect(countStatus(0, 'ALERT')).toBe('OK');
    expect(countStatus(2, 'WARN')).toBe('WARN');
    expect(alertKey('LEDGER_DRIFT')).toBe('ops-alert:LEDGER_DRIFT');
  });

  it('thresholds have safe defaults and an env override', () => {
    expect(t).toMatchObject({ webhookWarn: 1, webhookAlert: 3, sosAckAlertMinutes: 2, repeatMinutes: 60 });
    process.env.OPS_WEBHOOK_ALERT = '10';
    process.env.OPS_SOS_ACK_ALERT_MINUTES = 'abc'; // ignored
    expect(thresholdsFromEnv()).toMatchObject({ webhookAlert: 10, sosAckAlertMinutes: 2 });
    delete process.env.OPS_WEBHOOK_ALERT;
    delete process.env.OPS_SOS_ACK_ALERT_MINUTES;
  });
});
