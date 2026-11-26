import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMBARGO,
  checkEmbargo,
  cronHitsEmbargo,
  embargoMode,
  formatWindow,
  isInsideEmbargo,
  loadEmbargoWindow,
  localMinutes,
  minutesUntilEmbargoEnds,
  windowFrom,
} from '../../src/core/maintenance';
import { RECONCILIATION_SCHEDULE, REFUND_ELIGIBILITY_SCHEDULE } from '../../src/modules/deposits/deposits.types';
import { RETENTION_SWEEP_SCHEDULE } from '../../src/modules/privacy-consent/privacy-consent.jobs';
import { REVEAL_SWEEP_SCHEDULE } from '../../src/modules/reviews-trustscore/reviews-trustscore.jobs';
import { GPHN_EXPIRY_SWEEP_SCHEDULE } from '../../src/modules/tier-lifecycle/tier-lifecycle.types';

/** Phase 8 (BE-2) — NFR-AVAIL-01: không bảo trì trong khung bàn giao ca 19:00–21:00 (giờ VN). */
const vn = (hhmm: string, date = '2026-11-26') => new Date(`${date}T${hhmm}:00+07:00`).getTime();

describe('maintenance embargo 19:00–21:00 (NFR-AVAIL-01)', () => {
  it('window is Vietnam time, [19:00, 21:00), whatever the server time zone', () => {
    expect(localMinutes(Date.parse('2026-11-26T12:30:00Z'))).toBe(19 * 60 + 30); // 19:30 VN
    expect(isInsideEmbargo(vn('18:59'))).toBe(false);
    expect(isInsideEmbargo(vn('19:00'))).toBe(true);
    expect(isInsideEmbargo(vn('20:59'))).toBe(true);
    expect(isInsideEmbargo(vn('21:00'))).toBe(false);
    expect(isInsideEmbargo(vn('07:30'))).toBe(false);
    expect(minutesUntilEmbargoEnds(vn('20:15'))).toBe(45);
    expect(minutesUntilEmbargoEnds(vn('10:00'))).toBe(0);
    expect(formatWindow(DEFAULT_EMBARGO)).toBe('19:00–21:00');
  });

  it('configurable window, validated', () => {
    expect(windowFrom('18:30', '21:30')).toEqual({ startMin: 1110, endMin: 1290 });
    expect(() => windowFrom('21:00', '19:00')).toThrow();
    expect(() => windowFrom('7pm', '9pm')).toThrow();
  });

  it('production enforces; elsewhere it warns; an override needs a real reason', () => {
    expect(embargoMode({ NODE_ENV: 'production' })).toBe('enforce');
    expect(embargoMode({ NODE_ENV: 'development' })).toBe('warn');
    expect(embargoMode({ NODE_ENV: 'production', MAINTENANCE_EMBARGO: 'off' })).toBe('off');
    expect(embargoMode({ MAINTENANCE_EMBARGO: 'ENFORCE' })).toBe('enforce');

    const blocked = checkEmbargo(vn('19:45'), DEFAULT_EMBARGO, 'enforce', 'Chạy 1 migration');
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toContain('19:00–21:00');
    expect(blocked.message).toContain('75 phút');
    expect(checkEmbargo(vn('19:45'), DEFAULT_EMBARGO, 'enforce', 'x', 'gấp').allowed).toBe(false); // < 10 characters
    const forced = checkEmbargo(vn('19:45'), DEFAULT_EMBARGO, 'enforce', 'x', 'Sửa lỗi ví đang trừ tiền sai');
    expect(forced).toMatchObject({ allowed: true });
    expect(forced.message).toContain('OVERRIDE');
    expect(checkEmbargo(vn('19:45'), DEFAULT_EMBARGO, 'warn', 'x').allowed).toBe(true);
    expect(checkEmbargo(vn('22:00'), DEFAULT_EMBARGO, 'enforce', 'x')).toEqual({ allowed: true, message: null });
  });

  it('reads the window from system_configs, falls back to the SRS default before migration 0028', async () => {
    const db = (exists: boolean, rows: any[]): any => ({
      query: async (sql: string) => ({ rows: sql.includes('to_regclass') ? [{ ok: exists }] : rows }),
    });
    expect(await loadEmbargoWindow(db(false, []))).toEqual(DEFAULT_EMBARGO);
    expect(await loadEmbargoWindow(db(true, []))).toEqual(DEFAULT_EMBARGO);
    expect(
      await loadEmbargoWindow(
        db(true, [
          { config_key: 'MAINTENANCE_EMBARGO_START', config_value: '18:30' },
          { config_key: 'MAINTENANCE_EMBARGO_END', config_value: '21:30' },
        ]),
      ),
    ).toEqual({ startMin: 1110, endMin: 1290 });
  });

  it('no daily maintenance job (sweeps, reconciliation, purge) is scheduled inside the window', () => {
    expect(cronHitsEmbargo('30 19 * * *')).toBe(true);
    expect(cronHitsEmbargo('0 18,20 * * *')).toBe(true);
    expect(cronHitsEmbargo('0 21 * * *')).toBe(false);
    expect(cronHitsEmbargo('7 * * * *')).toBe(false); // hourly operation, not maintenance
    const daily = {
      GPHN_EXPIRY_SWEEP_SCHEDULE,
      RECONCILIATION_SCHEDULE,
      REFUND_ELIGIBILITY_SCHEDULE,
      RETENTION_SWEEP_SCHEDULE,
      REVEAL_SWEEP_SCHEDULE,
    };
    const hits = Object.entries(daily).filter(([, s]) => cronHitsEmbargo(s.pattern)).map(([k]) => k);
    expect(hits).toEqual([]);
  });
});
