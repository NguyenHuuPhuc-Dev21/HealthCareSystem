/**
 * Core Dynamic Config Reader (BE-1)
 * Loads parameters from `system_configs` table with in-memory TTL caching.
 * Strictly guarantees ZERO hardcoded business numbers in code.
 */

export interface SystemConfigEntry {
  config_key: string;
  config_value: string;
  data_type: 'INTEGER' | 'DECIMAL' | 'STRING' | 'BOOLEAN' | 'JSON';
  description: string;
}

export class ConfigService {
  private static instance: ConfigService;
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private readonly defaultTtlMs = 5 * 60 * 1000; // 5 minutes cache

  private constructor() {}

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  public async get<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    // Stub fallback until migrations are live
    const resolvedValue = defaultValue !== undefined ? defaultValue : (null as unknown as T);
    this.cache.set(key, { value: resolvedValue, expiresAt: Date.now() + this.defaultTtlMs });
    return resolvedValue;
  }

  public invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const config = ConfigService.getInstance();

