/**
 * Core Database Service (BE-1 / Dev A)
 * PostgreSQL connection pool + transaction helper. SQL-first (ADR-0002):
 * modules write parameterised SQL in their own `<module>.repo.ts` and run it
 * through `query()` or through the `client` handed out by `withTransaction()`.
 *
 * Internal interface agreed in Phase 0 (plan §4.1):
 *   - query(sql, params)                → one-off statement on the pool
 *   - withTransaction(fn, options?)     → BEGIN … COMMIT / ROLLBACK
 *   - DbClient                          → the `dbTx` type other modules receive
 *     (e.g. Dev C's recordLedgerTransaction(dbTx, …) must be called with it)
 *
 * Rules:
 *   - Always pass values as params ($1, $2 …). Never concatenate input into SQL.
 *   - Inside withTransaction, use ONLY the `client` argument. Calling `query()`
 *     there runs on another connection, outside the transaction.
 *   - Do not nest withTransaction; pass the client down instead.
 */

import pg from 'pg';

export type DbClient = pg.PoolClient;
export type QueryResultRow = pg.QueryResultRow;

/** Anything that can run a query: the pool or a transaction client. */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<R>>;
}

/** Minimal pool surface used by withTransaction (lets unit tests pass a fake). */
export interface ConnectablePool {
  connect(): Promise<Pick<pg.PoolClient, 'query' | 'release'>>;
}

export type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

export interface TransactionOptions {
  /** Default READ COMMITTED (PostgreSQL default). Use SERIALIZABLE only when needed. */
  isolationLevel?: IsolationLevel;
}

const ISOLATION_LEVELS: ReadonlySet<string> = new Set(['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']);

let pool: pg.Pool | null = null;

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  return n;
}

/** Lazily creates the shared pool from DATABASE_URL. */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set (see services/api/.env.example)');
    }
    pool = new pg.Pool({
      connectionString,
      min: readIntEnv('DATABASE_POOL_MIN', 2),
      max: readIntEnv('DATABASE_POOL_MAX', 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // An idle client erroring (e.g. DB restart) must not crash the process.
    pool.on('error', (err) => {
      console.error('[Core/Database] Idle client error:', err.message);
    });
  }
  return pool;
}

/** Runs one parameterised statement on the pool (auto-commit). */
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<R>> {
  return getPool().query<R>(text, params);
}

/**
 * Runs `fn` inside a single transaction on a dedicated connection.
 * Commits if `fn` resolves, rolls back (and rethrows) if it throws.
 * The connection is always released.
 */
export async function runInTransaction<T>(
  targetPool: ConnectablePool,
  fn: (client: DbClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const isolation = options.isolationLevel ?? 'READ COMMITTED';
  if (!ISOLATION_LEVELS.has(isolation)) {
    throw new Error(`Unsupported isolation level: ${isolation}`);
  }

  const client = await targetPool.connect();
  let broken: Error | undefined;
  try {
    await client.query(`BEGIN ISOLATION LEVEL ${isolation}`);
    const result = await fn(client as DbClient);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      // Connection is unusable: destroy it instead of returning it to the pool.
      broken = rollbackErr as Error;
    }
    throw err;
  } finally {
    client.release(broken);
  }
}

/** withTransaction on the shared pool — the function other modules call. */
export async function withTransaction<T>(
  fn: (client: DbClient) => Promise<T>,
  options?: TransactionOptions,
): Promise<T> {
  return runInTransaction(getPool(), fn, options);
}

/** Startup / health check: throws if PostgreSQL is unreachable. */
export async function checkConnection(): Promise<void> {
  await query('SELECT 1');
}

/** Graceful shutdown (and test teardown). */
export async function closePool(): Promise<void> {
  if (pool) {
    const p = pool;
    pool = null;
    await p.end();
  }
}
