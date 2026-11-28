import { describe, expect, it } from 'vitest';
import { NurseTier, ServiceType, ServiceUnit } from '@healthcare-system/shared';
import { checkConfigValue, checkOrderedPairs, toStoredString } from '../../src/modules/admin-configs/admin-configs.policy';
import { updateConfigSchema } from '../../src/modules/admin-configs/admin-configs.schema';
import { catalogProblem, changedFields } from '../../src/modules/admin-catalog/admin-catalog.policy';
import { createServiceSchema, updateServiceSchema } from '../../src/modules/admin-catalog/admin-catalog.schema';

/** admin-configs + admin-catalog policies (Phase 7) — pure rules. */
describe('admin-configs — policy (unit)', () => {
  const ok = (key: string, v: string) => checkConfigValue(key, v, 'NUMBER');
  const value = (key: string, v: string) => (ok(key, v) as { value: unknown }).value;
  const problem = (key: string, v: string) => ('code' in ok(key, v) ? (ok(key, v) as { message: string }).message : null);

  it('converts the admin\'s value to the stored string by data_type', () => {
    expect(toStoredString(0.2, 'NUMBER')).toBe('0.2');
    expect(toStoredString(' 12 ', 'NUMBER')).toBe('12');
    expect(toStoredString(Infinity, 'NUMBER')).toBeNull();
    expect(toStoredString(true, 'NUMBER')).toBeNull();
    expect(toStoredString(false, 'BOOLEAN')).toBe('false');
    expect(toStoredString('TRUE', 'BOOLEAN')).toBe('true');
    expect(toStoredString({ a: 1 }, 'JSON')).toBe('{"a":1}');
    expect(toStoredString(5, 'STRING')).toBeNull();
  });

  it('accepts sensible numbers and parses them', () => {
    expect(value('PLATFORM_COMMISSION_RATE', '0.15')).toBe(0.15);
    expect(value('CUSTOMER_CANCEL_FREE_HOURS', '24')).toBe(24);
    expect(value('SURCHARGE_HOLIDAY_MAJOR', '3.5')).toBe(3.5); // surcharges are not *_RATE: > 1 allowed
    expect(value('MIN_NURSE_DEPOSIT', '0')).toBe(0);
    expect(value('TRUST_SUSPEND_BELOW', '0')).toBe(0);
  });

  it('rejects: not a number, negative, rate > 1, TrustScore > 100, stars outside 1..5', () => {
    expect(problem('PLATFORM_COMMISSION_RATE', 'abc')).toMatch(/NUMBER/);
    expect(problem('PLATFORM_COMMISSION_RATE', '')).toMatch(/NUMBER/);
    expect(problem('NO_SHOW_PENALTY', '-1')).toMatch(/≥ 0/);
    expect(problem('PLATFORM_COMMISSION_RATE', '15')).toMatch(/between 0 and 1/);
    expect(problem('TRUST_PENALTY_DISPUTE_UPHELD', '101')).toMatch(/0 and 100/);
    expect(problem('TRUST_RECOVERY_MIN_STARS', '6')).toMatch(/1 and 5/);
    expect(problem('TRUST_RECOVERY_MIN_STARS', '0')).toMatch(/1 and 5/);
  });

  it('whole numbers for durations, counts and VND; at least 1 for TTLs, windows, maxima', () => {
    expect(problem('PAYMENT_TIMEOUT_MINUTES', '7.5')).toMatch(/whole/);
    expect(problem('MIN_NURSE_DEPOSIT', '300000.5')).toMatch(/whole/);
    expect(problem('OTP_TTL_SECONDS', '0')).toMatch(/at least 1/);
    expect(problem('MAX_EXTENSION_HOURS', '0')).toMatch(/at least 1/);
    expect(problem('RADAR_WINDOW_MINUTES', '0')).toMatch(/at least 1/);
    expect(problem('RADAR_INITIAL_RADIUS_KM', '2.5')).toBeNull(); // km may be fractional
    expect(problem('CUSTOMER_CANCEL_LATE_HOURS', '0')).toBeNull(); // 0 = no last-minute band: allowed
  });

  it('keeps ordered pairs ordered', () => {
    const m = new Map([['CUSTOMER_CANCEL_NEAR_NURSE_RATE', 0.15], ['CUSTOMER_CANCEL_NEAR_FEE_RATE', 0.2]]);
    expect(checkOrderedPairs(m)).toBeNull();
    m.set('CUSTOMER_CANCEL_NEAR_NURSE_RATE', 0.25);
    expect(checkOrderedPairs(m)?.message).toMatch(/must not be greater/);
  });

  it('body: only config_value', () => {
    expect(updateConfigSchema.safeParse({ config_value: 0.2 }).success).toBe(true);
    expect(updateConfigSchema.safeParse({ config_value: '0.2' }).success).toBe(true);
    expect(updateConfigSchema.safeParse({ config_value: 1, data_type: 'STRING' }).success).toBe(false);
    expect(updateConfigSchema.safeParse({}).success).toBe(false);
  });
});

describe('admin-catalog — policy (unit)', () => {
  const base = {
    name: 'Tiêm thuốc',
    service_type: ServiceType.TASK_BASED,
    is_invasive: false,
    is_prohibited: false,
    required_tier: NurseTier.TIER_1_BASIC,
    base_price: 200_000,
    unit: ServiceUnit.PER_TIME,
    is_active: true,
  };

  it('invasive needs Tier 2', () => {
    expect(catalogProblem(base)).toBeNull();
    expect(catalogProblem({ ...base, is_invasive: true })).toBe('INVASIVE_REQUIRES_TIER_2');
    expect(catalogProblem({ ...base, is_invasive: true, required_tier: NurseTier.TIER_2_SPECIALIST })).toBeNull();
  });

  it('keeps only real changes', () => {
    expect(changedFields(base, { base_price: 200_000, name: 'Tiêm thuốc' })).toEqual({});
    expect(changedFields(base, { base_price: 250_000, is_active: true })).toEqual({ base_price: 250_000 });
  });

  it('create: code format, defaults, integer VND', () => {
    const body = { code: 'SRV_TEST_1', name: 'X', service_type: 'TASK_BASED', base_price: 100_000, unit: 'PER_TIME' };
    const parsed = createServiceSchema.parse(body);
    expect(parsed).toMatchObject({ is_invasive: false, is_prohibited: false, required_tier: 'TIER_1_BASIC', is_active: true });
    expect(createServiceSchema.safeParse({ ...body, code: 'srv test' }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...body, base_price: 100.5 }).success).toBe(false);
    expect(createServiceSchema.safeParse({ ...body, base_price: -1 }).success).toBe(false);
  });

  it('update: partial, never code, never empty', () => {
    expect(updateServiceSchema.safeParse({ base_price: 1 }).success).toBe(true);
    expect(updateServiceSchema.safeParse({ code: 'NEW' }).success).toBe(false);
    expect(updateServiceSchema.safeParse({}).success).toBe(false);
  });
});
