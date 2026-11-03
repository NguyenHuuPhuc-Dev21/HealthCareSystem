/**
 * Core Dynamic Config Reader (BE-1 / Dev A)
 * Reads business parameters from `system_configs` (SRS §5.1) with a short
 * in-memory cache. Golden Rule: ZERO hardcoded business numbers.
 *
 * Internal interface agreed in Phase 0 (plan §4.1):
 *   getConfig(key)          → parsed value (number | string | boolean | JSON)
 *   getConfigNumber(key)    → number, throws if the row is not NUMBER
 *   getConfigString/Boolean → same idea
 *   invalidateConfig()      → drop the cache (admin-configs calls it after an update)
 *   assertAllConfigKeysPresent() → boot-time check, every SYSTEM_CONFIG_KEYS row exists
 *
 * Behaviour:
 *   - A missing key or a malformed value THROWS. There is deliberately no
 *     `defaultValue` parameter: a default in code is a hardcoded business number.
 *   - The whole table (a few dozen rows) is loaded in one query and cached for
 *     CONFIG_CACHE_TTL_MS (default 60 s). On a single instance, admin updates
 *     are visible immediately via invalidateConfig(); on several instances,
 *     within one TTL (TC-PRICE-01: "new bookings use the new rate without restart").
 *   - Callers must read config at the moment of the business decision and
 *     snapshot it into the row they write (e.g. booking price), not keep it
 *     in module-level variables.
 */

import { SYSTEM_CONFIG_KEYS, type SystemConfigKey } from '@healthcare-system/shared';
import { query as dbQuery, type Queryable } from '../database';

/** Mirrors config_data_type_enum in db/migrations/0001_initial_schema.sql. */
export type ConfigDataType = 'NUMBER' | 'STRING' | 'BOOLEAN' | 'JSON';
export type ConfigValue = number | string | boolean | unknown;

export interface SystemConfigRow {
  config_key: string;
  config_value: string;
  data_type: ConfigDataType;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** Converts the stored VARCHAR into a typed value. Throws ConfigError on bad data. */
export function parseConfigValue(key: string, raw: string, dataType: ConfigDataType): ConfigValue {
  switch (dataType) {
    case 'NUMBER': {
      const trimmed = raw.trim();
      // Number('') === 0 and Number('  ') === 0 — reject explicitly.
      if (trimmed === '' || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
        throw new ConfigError(`Config ${key}: "${raw}" is not a valid NUMBER`);
      }
      return Number(trimmed);
    }
    case 'BOOLEAN': {
      const v = raw.trim().toLowerCase();
      if (v === 'true') return true;
      if (v === 'false') return false;
      throw new ConfigError(`Config ${key}: "${raw}" is not a valid BOOLEAN (expected true/false)`);
    }
    case 'JSON':
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        throw new ConfigError(`Config ${key}: value is not valid JSON`);
      }
    case 'STRING':
      return raw;
    default:
      throw new ConfigError(`Config ${key}: unknown data_type "${String(dataType)}"`);
  }
}

interface CachedEntry {
  value: ConfigValue;
  dataType: ConfigDataType;
}

export interface ConfigServiceOptions {
  /** Loads every row of system_configs. Injected so tests can use a fake. */
  loadRows: () => Promise<SystemConfigRow[]>;
  ttlMs?: number;
  now?: () => number;
}

export class ConfigService {
  private cache: Map<string, CachedEntry> | null = null;
  private expiresAt = 0;
  private inFlight: Promise<Map<string, CachedEntry>> | null = null;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(private readonly options: ConfigServiceOptions) {
    this.ttlMs = options.ttlMs ?? 60_000;
    this.now = options.now ?? Date.now;
  }

  private async load(): Promise<Map<string, CachedEntry>> {
    if (this.cache && this.expiresAt > this.now()) return this.cache;
    // Collapse concurrent cache misses into a single query.
    if (!this.inFlight) {
      this.inFlight = (async () => {
        const rows = await this.options.loadRows();
        const next = new Map<string, CachedEntry>();
        for (const row of rows) {
          next.set(row.config_key, {
            value: parseConfigValue(row.config_key, row.config_value, row.data_type),
            dataType: row.data_type,
          });
        }
        this.cache = next;
        this.expiresAt = this.now() + this.ttlMs;
        return next;
      })().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async entry(key: SystemConfigKey): Promise<CachedEntry> {
    const map = await this.load();
    const found = map.get(key);
    if (!found) {
      throw new ConfigError(`Config ${key} is missing from system_configs (add it in a migration)`);
    }
    return found;
  }

  async get(key: SystemConfigKey): Promise<ConfigValue> {
    return (await this.entry(key)).value;
  }

  private async getTyped<T>(key: SystemConfigKey, expected: ConfigDataType): Promise<T> {
    const e = await this.entry(key);
    if (e.dataType !== expected) {
      throw new ConfigError(`Config ${key} is ${e.dataType}, not ${expected}`);
    }
    return e.value as T;
  }

  getNumber(key: SystemConfigKey): Promise<number> {
    return this.getTyped<number>(key, 'NUMBER');
  }

  getString(key: SystemConfigKey): Promise<string> {
    return this.getTyped<string>(key, 'STRING');
  }

  getBoolean(key: SystemConfigKey): Promise<boolean> {
    return this.getTyped<boolean>(key, 'BOOLEAN');
  }

  /** Throws listing every SYSTEM_CONFIG_KEYS entry that has no row. Call at boot. */
  async assertAllKeysPresent(): Promise<void> {
    const map = await this.load();
    const missing = Object.values(SYSTEM_CONFIG_KEYS).filter((k) => !map.has(k));
    if (missing.length > 0) {
      throw new ConfigError(`system_configs is missing keys: ${missing.join(', ')}`);
    }
  }

  invalidate(): void {
    this.cache = null;
    this.expiresAt = 0;
  }
}

/** Default loader: reads the table through any Queryable (pool or transaction client). */
export function createRowLoader(db: Pick<Queryable, 'query'> | null = null): () => Promise<SystemConfigRow[]> {
  return async () => {
    const sql = 'SELECT config_key, config_value, data_type FROM system_configs';
    const result = db ? await db.query<SystemConfigRow>(sql) : await dbQuery<SystemConfigRow>(sql);
    return result.rows;
  };
}

function readTtlMs(): number {
  const raw = process.env.CONFIG_CACHE_TTL_MS;
  if (raw === undefined || raw === '') return 60_000;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`CONFIG_CACHE_TTL_MS must be a non-negative integer, got "${raw}"`);
  return n;
}

export const config = new ConfigService({ loadRows: createRowLoader(), ttlMs: readTtlMs() });

// ---- Agreed internal interface (plan §4.1) --------------------------------
export const getConfig = (key: SystemConfigKey) => config.get(key);
export const getConfigNumber = (key: SystemConfigKey) => config.getNumber(key);
export const getConfigString = (key: SystemConfigKey) => config.getString(key);
export const getConfigBoolean = (key: SystemConfigKey) => config.getBoolean(key);
export const invalidateConfig = () => config.invalidate();
export const assertAllConfigKeysPresent = () => config.assertAllKeysPresent();
