/**
 * admin-configs policy — what an Admin may store in system_configs (§5.1). PURE.
 *
 * The data_type check reuses core/config parseConfigValue (the same parser the readers use), so a value
 * that passes here can always be read back. On top of it, guard rails for NUMBER keys, by name:
 *   - never negative, never NaN / Infinity;
 *   - `*_RATE`: 0..1 (fractions of an amount);
 *   - `TRUST_*`: 0..100 (TrustScore scale); `TRUST_RECOVERY_MIN_STARS`: 1..5;
 *   - durations, counts and VND amounts: whole numbers;
 *   - TTLs, lengths, radii, windows, timeouts, maxima: at least 1 (0 would switch the feature off by accident);
 * and a few pairs that other modules assume (e.g. the nurse's share of a cancel fee ≤ the fee).
 */
import { ConfigError, parseConfigValue } from '../../core/config';
import type { ConfigDataType } from './admin-configs.types';

export type ConfigProblem = { code: 'INVALID_CONFIG_VALUE'; message: string };

const INTEGER_SUFFIX = /_(HOURS|MINUTES|MIN|DAYS|SECONDS|MONTHS|SHIFTS|LENGTH|ATTEMPTS|HOUR|METERS|STARS)$/;
const INTEGER_KEYS = new Set(['MIN_NURSE_DEPOSIT', 'NO_SHOW_PENALTY', 'ICU_TRAVEL_SUPPORT']); // integer VND (D-05)
const POSITIVE = /(TTL|LENGTH|RADIUS|WINDOW|TIMEOUT|COOLDOWN|IDLE|ATTEMPTS|_MAX_|^MAX_|MIN_STARS)/;

/** Pairs [smaller, larger] that must stay ordered after the change. */
export const ORDERED_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['CUSTOMER_CANCEL_NEAR_NURSE_RATE', 'CUSTOMER_CANCEL_NEAR_FEE_RATE'],
  ['CUSTOMER_CANCEL_LATE_NURSE_RATE', 'CUSTOMER_CANCEL_LATE_FEE_RATE'],
  ['CUSTOMER_CANCEL_LATE_HOURS', 'CUSTOMER_CANCEL_FREE_HOURS'],
  ['RADAR_INITIAL_RADIUS_KM', 'RADAR_EXPANDED_RADIUS_KM'],
];

/** The admin's value as the VARCHAR that will be stored. null = wrong JS type for the data_type. */
export function toStoredString(input: unknown, dataType: ConfigDataType): string | null {
  switch (dataType) {
    case 'NUMBER':
      if (typeof input === 'number') return Number.isFinite(input) ? String(input) : null;
      return typeof input === 'string' ? input.trim() : null;
    case 'BOOLEAN':
      if (typeof input === 'boolean') return String(input);
      return typeof input === 'string' ? input.trim().toLowerCase() : null;
    case 'JSON':
      if (typeof input === 'string') return input;
      return input !== null && typeof input === 'object' ? JSON.stringify(input) : null;
    case 'STRING':
      return typeof input === 'string' ? input : null;
    default:
      return null;
  }
}

const bad = (message: string): ConfigProblem => ({ code: 'INVALID_CONFIG_VALUE', message });

/** Checks one value on its own. Returns the parsed value, or the problem. */
export function checkConfigValue(key: string, stored: string, dataType: ConfigDataType): { value: unknown } | ConfigProblem {
  if (stored.length > 500) return bad('Value is longer than 500 characters');
  let value: unknown;
  try {
    value = parseConfigValue(key, stored, dataType);
  } catch (e) {
    if (e instanceof ConfigError) return bad(`Expected a ${dataType} value`);
    throw e;
  }
  if (dataType !== 'NUMBER') return { value };

  const n = value as number;
  if (!Number.isFinite(n) || n < 0) return bad('Must be a number ≥ 0');
  if (key.endsWith('_RATE') && n > 1) return bad('A rate is a fraction between 0 and 1 (e.g. 0.15 = 15%)');
  if (key === 'TRUST_RECOVERY_MIN_STARS' && (n < 1 || n > 5)) return bad('Stars are between 1 and 5');
  if (key.startsWith('TRUST_') && n > 100) return bad('TrustScore values are between 0 and 100');
  if ((INTEGER_SUFFIX.test(key) || INTEGER_KEYS.has(key)) && !Number.isInteger(n)) return bad('Must be a whole number');
  if (POSITIVE.test(key) && n < 1) return bad('Must be at least 1');
  return { value };
}

/** Checks the ordered pairs against the table as it would be after the change. */
export function checkOrderedPairs(values: ReadonlyMap<string, number>): ConfigProblem | null {
  for (const [small, large] of ORDERED_PAIRS) {
    const a = values.get(small);
    const b = values.get(large);
    if (a !== undefined && b !== undefined && a > b) return bad(`${small} must not be greater than ${large}`);
  }
  return null;
}
