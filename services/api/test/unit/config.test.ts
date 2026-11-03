import { describe, expect, it } from 'vitest';
import { SYSTEM_CONFIG_KEYS } from '@healthcare-system/shared';
import { ConfigError, ConfigService, parseConfigValue, type SystemConfigRow } from '../../src/core/config';

const allRows = (): SystemConfigRow[] =>
  Object.values(SYSTEM_CONFIG_KEYS).map((k) => ({ config_key: k, config_value: '1', data_type: 'NUMBER' as const }));

describe('parseConfigValue', () => {
  it('parses NUMBER including decimals and integers', () => {
    expect(parseConfigValue('K', '0.15', 'NUMBER')).toBe(0.15);
    expect(parseConfigValue('K', '300000', 'NUMBER')).toBe(300000);
    expect(parseConfigValue('K', ' 15 ', 'NUMBER')).toBe(15);
  });

  it('rejects empty or non-numeric NUMBER values instead of returning 0/NaN', () => {
    expect(() => parseConfigValue('K', '', 'NUMBER')).toThrow(ConfigError);
    expect(() => parseConfigValue('K', '   ', 'NUMBER')).toThrow(ConfigError);
    expect(() => parseConfigValue('K', '15%', 'NUMBER')).toThrow(ConfigError);
    expect(() => parseConfigValue('K', '1e3', 'NUMBER')).toThrow(ConfigError);
  });

  it('parses BOOLEAN strictly', () => {
    expect(parseConfigValue('K', 'true', 'BOOLEAN')).toBe(true);
    expect(parseConfigValue('K', 'FALSE', 'BOOLEAN')).toBe(false);
    expect(() => parseConfigValue('K', 'yes', 'BOOLEAN')).toThrow(ConfigError);
  });

  it('parses JSON and STRING', () => {
    expect(parseConfigValue('K', '{"a":1}', 'JSON')).toEqual({ a: 1 });
    expect(() => parseConfigValue('K', '{bad', 'JSON')).toThrow(ConfigError);
    expect(parseConfigValue('K', 'hello', 'STRING')).toBe('hello');
  });
});

describe('ConfigService', () => {
  it('returns typed values and caches them for the TTL', async () => {
    let calls = 0;
    let now = 0;
    const svc = new ConfigService({
      loadRows: async () => {
        calls++;
        return [{ config_key: 'PLATFORM_COMMISSION_RATE', config_value: '0.15', data_type: 'NUMBER' }];
      },
      ttlMs: 1000,
      now: () => now,
    });

    expect(await svc.getNumber('PLATFORM_COMMISSION_RATE')).toBe(0.15);
    expect(await svc.getNumber('PLATFORM_COMMISSION_RATE')).toBe(0.15);
    expect(calls).toBe(1);

    now = 1001; // TTL elapsed
    await svc.get('PLATFORM_COMMISSION_RATE');
    expect(calls).toBe(2);
  });

  it('picks up a changed value right after invalidate() (TC-PRICE-01)', async () => {
    let rate = '0.15';
    const svc = new ConfigService({
      loadRows: async () => [{ config_key: 'PLATFORM_COMMISSION_RATE', config_value: rate, data_type: 'NUMBER' }],
      ttlMs: 60_000,
    });
    expect(await svc.getNumber('PLATFORM_COMMISSION_RATE')).toBe(0.15);
    rate = '0.18';
    expect(await svc.getNumber('PLATFORM_COMMISSION_RATE')).toBe(0.15); // still cached
    svc.invalidate();
    expect(await svc.getNumber('PLATFORM_COMMISSION_RATE')).toBe(0.18);
  });

  it('throws on a missing key — there is no default value', async () => {
    const svc = new ConfigService({ loadRows: async () => [] });
    await expect(svc.get('MIN_NURSE_DEPOSIT')).rejects.toThrow(/missing from system_configs/);
  });

  it('throws when the stored type does not match the typed getter', async () => {
    const svc = new ConfigService({
      loadRows: async () => [{ config_key: 'MIN_NURSE_DEPOSIT', config_value: 'abc', data_type: 'STRING' }],
    });
    await expect(svc.getNumber('MIN_NURSE_DEPOSIT')).rejects.toThrow(/is STRING, not NUMBER/);
  });

  it('collapses concurrent cache misses into one query', async () => {
    let calls = 0;
    const svc = new ConfigService({
      loadRows: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return allRows();
      },
    });
    await Promise.all([svc.get('NO_SHOW_PENALTY'), svc.get('ICU_TRAVEL_SUPPORT'), svc.get('MIN_NURSE_DEPOSIT')]);
    expect(calls).toBe(1);
  });

  it('assertAllKeysPresent lists every missing key', async () => {
    const rows = allRows().filter((r) => r.config_key !== 'TRAVEL_BUFFER_MINUTES' && r.config_key !== 'RADAR_INITIAL_RADIUS_KM');
    const svc = new ConfigService({ loadRows: async () => rows });
    await expect(svc.assertAllKeysPresent()).rejects.toThrow(/RADAR_INITIAL_RADIUS_KM, TRAVEL_BUFFER_MINUTES|TRAVEL_BUFFER_MINUTES.*RADAR_INITIAL_RADIUS_KM|RADAR_INITIAL_RADIUS_KM.*TRAVEL_BUFFER_MINUTES/);

    const ok = new ConfigService({ loadRows: async () => allRows() });
    await expect(ok.assertAllKeysPresent()).resolves.toBeUndefined();
  });

  it('a failed load is not cached; the next call retries', async () => {
    let fail = true;
    const svc = new ConfigService({
      loadRows: async () => {
        if (fail) throw new Error('db down');
        return allRows();
      },
    });
    await expect(svc.get('NO_SHOW_PENALTY')).rejects.toThrow('db down');
    fail = false;
    expect(await svc.get('NO_SHOW_PENALTY')).toBe(1);
  });
});
