import { describe, expect, it } from 'vitest';
import { runInTransaction, type ConnectablePool } from '../../src/core/database';

interface FakeClient {
  queries: string[];
  released: boolean;
  releasedWithError: unknown;
  failOn?: string;
}

function fakePool(failOn?: string): { pool: ConnectablePool; client: FakeClient } {
  const client: FakeClient = { queries: [], released: false, releasedWithError: undefined, failOn };
  const pool: ConnectablePool = {
    connect: async () =>
      ({
        query: async (sql: string) => {
          client.queries.push(sql);
          if (client.failOn && sql.startsWith(client.failOn)) throw new Error(`fail ${sql}`);
          return { rows: [], rowCount: 0 };
        },
        release: (err?: unknown) => {
          client.released = true;
          client.releasedWithError = err;
        },
      }) as never,
  };
  return { pool, client };
}

describe('runInTransaction', () => {
  it('commits when the callback resolves and returns its value', async () => {
    const { pool, client } = fakePool();
    const result = await runInTransaction(pool, async (c) => {
      await c.query('INSERT 1');
      return 42;
    });
    expect(result).toBe(42);
    expect(client.queries).toEqual(['BEGIN ISOLATION LEVEL READ COMMITTED', 'INSERT 1', 'COMMIT']);
    expect(client.released).toBe(true);
    expect(client.releasedWithError).toBeUndefined();
  });

  it('rolls back and rethrows when the callback throws', async () => {
    const { pool, client } = fakePool();
    await expect(
      runInTransaction(pool, async () => {
        throw new Error('business rule failed');
      }),
    ).rejects.toThrow('business rule failed');
    expect(client.queries).toEqual(['BEGIN ISOLATION LEVEL READ COMMITTED', 'ROLLBACK']);
    expect(client.released).toBe(true);
  });

  it('destroys the connection if ROLLBACK itself fails, and keeps the original error', async () => {
    const { pool, client } = fakePool('ROLLBACK');
    await expect(
      runInTransaction(pool, async () => {
        throw new Error('original');
      }),
    ).rejects.toThrow('original');
    expect(client.releasedWithError).toBeInstanceOf(Error);
  });

  it('uses the requested isolation level and rejects unknown ones', async () => {
    const { pool, client } = fakePool();
    await runInTransaction(pool, async () => undefined, { isolationLevel: 'SERIALIZABLE' });
    expect(client.queries[0]).toBe('BEGIN ISOLATION LEVEL SERIALIZABLE');

    await expect(
      runInTransaction(pool, async () => undefined, { isolationLevel: 'READ UNCOMMITTED; DROP TABLE x' as never }),
    ).rejects.toThrow(/Unsupported isolation level/);
  });
});
