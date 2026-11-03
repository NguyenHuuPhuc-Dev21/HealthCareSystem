/**
 * Forward-only SQL migration runner (BE-1 / Dev A) — ADR-0002 SQL-first.
 *
 * Applies, in order:
 *   1. db/migrations/*.sql   (schema; numbered 0001_, 0002_ …)
 *   2. db/seeds/*.sql        (reference + demo data; skipped when includeSeeds=false)
 *
 * Each file runs in its own transaction and is recorded in `schema_migrations`
 * with a SHA-256 checksum. Rules enforced:
 *   - A file already applied is never re-run.
 *   - If an applied file's content changed, the runner STOPS (merged migrations
 *     are immutable — write a new 000N_ file instead).
 *   - A pg advisory lock prevents two runners migrating at once.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

export interface MigrationFile {
  /** Recorded id, e.g. "migrations/0002_seed_missing_system_configs.sql". */
  id: string;
  absolutePath: string;
  checksum: string;
}

export interface MigrationPlan {
  pending: MigrationFile[];
  /** Applied files whose content no longer matches the recorded checksum. */
  modified: MigrationFile[];
}

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    id          VARCHAR(255) PRIMARY KEY,
    checksum    CHAR(64)     NOT NULL,
    applied_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
)`;

// Arbitrary constant shared by every runner instance.
const ADVISORY_LOCK_KEY = 4_242_001;

export function checksumOf(content: string): string {
  // Normalise line endings so a Windows checkout (CRLF) does not look "modified".
  return createHash('sha256').update(content.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
}

/** Pure decision step — unit-tested without a database. */
export function planMigrations(files: MigrationFile[], applied: Map<string, string>): MigrationPlan {
  const pending: MigrationFile[] = [];
  const modified: MigrationFile[] = [];
  for (const f of files) {
    const recorded = applied.get(f.id);
    if (recorded === undefined) pending.push(f);
    else if (recorded !== f.checksum) modified.push(f);
  }
  return { pending, modified };
}

/** Lists *.sql in a folder, sorted by file name (0001_ < 0002_ …). */
export function listSqlFiles(dbDir: string, subdir: 'migrations' | 'seeds'): MigrationFile[] {
  const dir = path.join(dbDir, subdir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => {
      const absolutePath = path.join(dir, name);
      return { id: `${subdir}/${name}`, absolutePath, checksum: checksumOf(readFileSync(absolutePath, 'utf8')) };
    });
}

/** Walks up from `start` until it finds a folder containing db/migrations. */
export function findDbDir(start: string = process.cwd()): string {
  let current = path.resolve(start);
  for (;;) {
    const candidate = path.join(current, 'db');
    if (existsSync(path.join(candidate, 'migrations'))) return candidate;
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Could not find db/migrations above ${start}`);
    current = parent;
  }
}

export interface RunMigrationsOptions {
  connectionString: string;
  dbDir?: string;
  includeSeeds?: boolean;
  log?: (msg: string) => void;
}

export async function runMigrations(options: RunMigrationsOptions): Promise<MigrationFile[]> {
  const log = options.log ?? ((m: string) => console.log(m));
  const dbDir = options.dbDir ?? findDbDir();
  const files = [
    ...listSqlFiles(dbDir, 'migrations'),
    ...(options.includeSeeds === false ? [] : listSqlFiles(dbDir, 'seeds')),
  ];

  const client = new pg.Client({ connectionString: options.connectionString });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);

    const tracked = await client.query<{ exists: boolean }>(
      "SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists",
    );
    if (!tracked.rows[0]?.exists) {
      // A database created by the old docker-entrypoint mounts has the schema
      // but no history; re-running 0001 on it would fail half-way.
      const legacy = await client.query<{ exists: boolean }>(
        "SELECT to_regclass('public.users') IS NOT NULL AS exists",
      );
      if (legacy.rows[0]?.exists) {
        throw new Error(
          'Database already has tables but no schema_migrations history. ' +
            'Reset the local volume once: `npm run docker:down -- -v && npm run docker:up && npm run db:migrate`.',
        );
      }
      await client.query(MIGRATIONS_TABLE_SQL);
    }

    const appliedRows = await client.query<{ id: string; checksum: string }>(
      'SELECT id, checksum FROM schema_migrations',
    );
    const applied = new Map(appliedRows.rows.map((r) => [r.id, r.checksum.trim()]));
    const plan = planMigrations(files, applied);

    if (plan.modified.length > 0) {
      throw new Error(
        `Already-applied files were edited: ${plan.modified.map((f) => f.id).join(', ')}. ` +
          'Merged migrations are immutable — revert the edit and add a new numbered file.',
      );
    }

    if (plan.pending.length === 0) {
      log('[migrate] Database is up to date.');
      return [];
    }

    for (const file of plan.pending) {
      const sql = readFileSync(file.absolutePath, 'utf8');
      log(`[migrate] Applying ${file.id} …`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [file.id, file.checksum]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw new Error(`[migrate] ${file.id} failed and was rolled back: ${(err as Error).message}`);
      }
    }
    log(`[migrate] Applied ${plan.pending.length} file(s).`);
    return plan.pending;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
}
