/**
 * Core key-value store (BE-1 / Dev A) — Redis for short-lived security state:
 * OTP codes, rate-limit counters, sessions. Business timers do NOT belong here;
 * they go through core/jobs (BE-2).
 *
 * Modules depend on the small `KeyValueStore` interface, not on ioredis, so
 * unit tests run against `MemoryKeyValueStore` with a fake clock.
 */

import { Redis } from 'ioredis';

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  /** SET with expiry (seconds). */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** SET … NX EX — true only for the caller that created the key. */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  /** Number of keys actually deleted. `del(k) === 1` is an atomic "I consumed it". */
  del(key: string): Promise<number>;
  /** Atomic INCR; the expiry is set when the counter is created. Returns the new value. */
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
  /** Seconds to live; -2 if the key does not exist, -1 if it has no expiry. */
  ttl(key: string): Promise<number>;
  setAdd(key: string, member: string, ttlSeconds: number): Promise<void>;
  setMembers(key: string): Promise<string[]>;
  setRemove(key: string, member: string): Promise<void>;
}

// INCR + EXPIRE in one round trip so a crash can never leave a counter without TTL.
const INCR_WITH_TTL_LUA = `
local v = redis.call('INCR', KEYS[1])
if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return v`;

export class RedisKeyValueStore implements KeyValueStore {
  constructor(private readonly redis: Redis) {}

  get(key: string) {
    return this.redis.get(key);
  }
  async set(key: string, value: string, ttlSeconds: number) {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }
  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    return (await this.redis.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
  }
  del(key: string) {
    return this.redis.del(key);
  }
  async incrWithTtl(key: string, ttlSeconds: number) {
    return Number(await this.redis.eval(INCR_WITH_TTL_LUA, 1, key, String(ttlSeconds)));
  }
  ttl(key: string) {
    return this.redis.ttl(key);
  }
  async setAdd(key: string, member: string, ttlSeconds: number) {
    await this.redis.multi().sadd(key, member).expire(key, ttlSeconds).exec();
  }
  setMembers(key: string) {
    return this.redis.smembers(key);
  }
  async setRemove(key: string, member: string) {
    await this.redis.srem(key, member);
  }
}

/** In-process store for unit tests (and nothing else). */
export class MemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, { value: string | Set<string>; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  private live(key: string) {
    const e = this.data.get(key);
    if (!e) return undefined;
    if (e.expiresAt <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }

  async get(key: string) {
    const e = this.live(key);
    return e && typeof e.value === 'string' ? e.value : null;
  }
  async set(key: string, value: string, ttlSeconds: number) {
    this.data.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }
  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    if (this.live(key)) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }
  async del(key: string) {
    return this.live(key) && this.data.delete(key) ? 1 : 0;
  }
  async incrWithTtl(key: string, ttlSeconds: number) {
    const e = this.live(key);
    const next = (e ? Number(e.value) : 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: e ? e.expiresAt : this.now() + ttlSeconds * 1000 });
    return next;
  }
  async ttl(key: string) {
    const e = this.live(key);
    return e ? Math.ceil((e.expiresAt - this.now()) / 1000) : -2;
  }
  async setAdd(key: string, member: string, ttlSeconds: number) {
    const e = this.live(key);
    const set = e && e.value instanceof Set ? e.value : new Set<string>();
    set.add(member);
    this.data.set(key, { value: set, expiresAt: this.now() + ttlSeconds * 1000 });
  }
  async setMembers(key: string) {
    const e = this.live(key);
    return e && e.value instanceof Set ? [...e.value] : [];
  }
  async setRemove(key: string, member: string) {
    const e = this.live(key);
    if (e && e.value instanceof Set) e.value.delete(member);
  }
}

let client: Redis | null = null;
let store: KeyValueStore | null = null;

/** Shared Redis-backed store (lazy: importing this file does not open a connection). */
export function getKeyValueStore(): KeyValueStore {
  if (!store) {
    client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { lazyConnect: false });
    client.on('error', (err: Error) => console.error('[Core/Redis]', err.message));
    store = new RedisKeyValueStore(client);
  }
  return store;
}

export async function closeKeyValueStore(): Promise<void> {
  if (client) await client.quit();
  client = null;
  store = null;
}
