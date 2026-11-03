/**
 * Phase 0 integration test against a REAL PostgreSQL 16.
 * Needs TEST_DATABASE_URL pointing at a throw-away database whose name
 * contains "test" (the suite drops and recreates the public schema).
 *   createdb -h localhost -U postgres healthcare_test
 *   TEST_DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/healthcare_test npm run test:integration
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { SYSTEM_CONFIG_KEYS } from '@healthcare-system/shared';
import { ConfigService, createRowLoader } from '../../src/core/config';
import { closePool, query, withTransaction } from '../../src/core/database';
import { runMigrations } from '../../src/core/database/migrator';

const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite('core platform on PostgreSQL', () => {
  beforeAll(async () => {
    if (!url!.includes('test')) throw new Error('Refusing to reset a database whose name does not contain "test"');
    process.env.DATABASE_URL = url; // core/database reads it lazily
    const admin = new pg.Client({ connectionString: url });
    await admin.connect();
    await admin.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await admin.end();
  });

  afterAll(async () => {
    await closePool();
  });

  it('applies every migration and seed on an empty database', async () => {
    const applied = await runMigrations({ connectionString: url!, log: () => undefined });
    expect(applied.map((f) => f.id)).toContain('migrations/0001_initial_schema.sql');
    expect(applied.map((f) => f.id)).toContain('migrations/0002_seed_missing_system_configs.sql');
  });

  it('is a no-op the second time', async () => {
    const applied = await runMigrations({ connectionString: url!, log: () => undefined });
    expect(applied).toEqual([]);
  });

  it('has a system_configs row for every SYSTEM_CONFIG_KEYS entry, readable as numbers', async () => {
    const svc = new ConfigService({ loadRows: createRowLoader() });
    await svc.assertAllKeysPresent();
    expect(await svc.getNumber('PLATFORM_COMMISSION_RATE')).toBe(0.15);
    expect(await svc.getNumber('MIN_NURSE_DEPOSIT')).toBe(300000);
    expect(await svc.getNumber('TRAVEL_BUFFER_MINUTES')).toBe(60);
    // Every key declared in packages/shared must have a row. No hardcoded count:
    // the key list grows with each phase (16 in Phase 0, 25 after migration 0003, …).
    const { rows } = await query<{ config_key: string }>('SELECT config_key FROM system_configs');
    const inDb = new Set(rows.map((r) => r.config_key));
    expect(Object.values(SYSTEM_CONFIG_KEYS).filter((k) => !inDb.has(k))).toEqual([]);
  });

  it('withTransaction really rolls back on error', async () => {
    const key = 'IT_ROLLBACK_PROBE';
    await expect(
      withTransaction(async (client) => {
        await client.query(
          "INSERT INTO system_configs (config_key, config_value, data_type) VALUES ($1, '1', 'NUMBER')",
          [key],
        );
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    const { rowCount } = await query('SELECT 1 FROM system_configs WHERE config_key = $1', [key]);
    expect(rowCount).toBe(0);
  });

  it('withTransaction commits on success', async () => {
    const key = 'IT_COMMIT_PROBE';
    await withTransaction(async (client) => {
      await client.query(
        "INSERT INTO system_configs (config_key, config_value, data_type) VALUES ($1, '1', 'NUMBER')",
        [key],
      );
    });
    const { rowCount } = await query('SELECT 1 FROM system_configs WHERE config_key = $1', [key]);
    expect(rowCount).toBe(1);
    await query('DELETE FROM system_configs WHERE config_key = $1', [key]);
  });

  it('audit_logs stays append-only (DB trigger)', async () => {
    await expect(query('DELETE FROM audit_logs')).resolves.toBeDefined(); // no rows → trigger not fired
    await query("INSERT INTO audit_logs (action_type, target_table) VALUES ((enum_range(NULL::audit_action_enum))[1], 'it')");
    await expect(query('DELETE FROM audit_logs')).rejects.toThrow(/append-only/);
  });
});
