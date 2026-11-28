import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { AppError } from '../../src/core/errors';
import { AdminConfigsService } from '../../src/modules/admin-configs/admin-configs.service';
import { AdminCatalogService } from '../../src/modules/admin-catalog/admin-catalog.service';
import { createTestPool, findOrCreateAdmin } from './helpers';

/**
 * admin-configs + admin-catalog on real PostgreSQL 16 (Phase 7). Every test runs inside ONE transaction
 * that is rolled back afterwards: system_configs is shared by the whole suite, so nothing may stay changed.
 */
describe('admin-configs + admin-catalog (integration)', () => {
  let pool: Pool;
  let db: PoolClient;
  let adminId: string;
  let invalidations = 0;

  const configs = () =>
    new AdminConfigsService({ read: db, withTx: (fn) => fn(db), invalidate: () => void (invalidations += 1) });
  const catalog = () => new AdminCatalogService({ read: db, withTx: (fn) => fn(db) });

  async function codeOf(p: Promise<unknown>): Promise<string> {
    try {
      await p;
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      return (e as AppError).code;
    }
    throw new Error('expected an AppError');
  }

  const audits = async (action: string) =>
    (await db.query('SELECT actor_id, target_table, target_id, old_value, new_value, ip_address FROM audit_logs WHERE action_type = $1 AND actor_id = $2 AND created_at = now() ORDER BY id', [action, adminId])).rows;

  beforeAll(async () => {
    pool = createTestPool();
    adminId = await findOrCreateAdmin(pool);
  });

  beforeEach(async () => {
    db = await pool.connect();
    await db.query('BEGIN');
    invalidations = 0;
  });

  afterEach(async () => {
    await db.query('ROLLBACK');
    db.release();
  });

  afterAll(async () => {
    await pool.end();
  });

  // ------------------------------------------------------------------ configs
  it('lists every key with its typed value', async () => {
    const all = await configs().list();
    expect(all.PLATFORM_COMMISSION_RATE).toMatchObject({ value: expect.any(Number), dataType: 'NUMBER' });
    expect(Object.keys(all).length).toBeGreaterThan(40);
  });

  it('updates a value: stored with updated_by, audited UPDATE_CONFIG, cache dropped', async () => {
    const before = (await configs().list()).NO_SHOW_PENALTY!.value;
    const out = await configs().update(adminId, 'NO_SHOW_PENALTY', 60000, '10.0.0.1');
    expect(out).toEqual({ updated: true, key: 'NO_SHOW_PENALTY', value: 60000 });

    const row = (await db.query("SELECT config_value, updated_by FROM system_configs WHERE config_key = 'NO_SHOW_PENALTY'")).rows[0];
    expect(row).toEqual({ config_value: '60000', updated_by: adminId });
    const [audit] = await audits('UPDATE_CONFIG');
    expect(audit).toMatchObject({
      target_table: 'system_configs',
      target_id: null,
      old_value: { key: 'NO_SHOW_PENALTY', value: before },
      new_value: { key: 'NO_SHOW_PENALTY', value: 60000 },
      ip_address: '10.0.0.1',
    });
    expect(invalidations).toBe(1);
  });

  it('same value → updated:false, no audit, cache kept', async () => {
    const current = (await configs().list()).PLATFORM_COMMISSION_RATE!.value;
    await expect(configs().update(adminId, 'PLATFORM_COMMISSION_RATE', String(current), null)).resolves.toMatchObject({ updated: false });
    expect(await audits('UPDATE_CONFIG')).toHaveLength(0);
    expect(invalidations).toBe(0);
  });

  it('refuses: unknown key (404), bad value (422), broken pair (422) — nothing written', async () => {
    expect(await codeOf(configs().update(adminId, 'NOT_A_KEY', 1, null))).toBe('CONFIG_NOT_FOUND');
    expect(await codeOf(configs().update(adminId, 'PLATFORM_COMMISSION_RATE', 15, null))).toBe('INVALID_CONFIG_VALUE');
    expect(await codeOf(configs().update(adminId, 'PLATFORM_COMMISSION_RATE', true, null))).toBe('INVALID_CONFIG_VALUE');
    expect(await codeOf(configs().update(adminId, 'CUSTOMER_CANCEL_NEAR_NURSE_RATE', 0.9, null))).toBe('INVALID_CONFIG_VALUE');
    expect(await audits('UPDATE_CONFIG')).toHaveLength(0);
  });

  // ------------------------------------------------------------------ catalog
  const newService = (over: Record<string, unknown> = {}) => ({
    code: `SRV_IT_${Math.floor(Math.random() * 1e9)}`,
    name: 'Dịch vụ test',
    service_type: 'TASK_BASED' as const,
    is_invasive: false,
    is_prohibited: false,
    required_tier: 'TIER_1_BASIC' as const,
    base_price: 150_000,
    unit: 'PER_TIME' as const,
    is_active: true,
    ...over,
  });

  it('creates a service and audits it; a duplicate code → 409', async () => {
    const body = newService();
    const s = await catalog().create(adminId, body as never, null);
    expect(s).toMatchObject({ code: body.code, base_price: 150_000, is_active: true });
    const [audit] = await audits('UPDATE_SERVICE_CATALOG');
    expect(audit).toMatchObject({ target_table: 'service_categories', target_id: s.id, old_value: null });
    expect(audit.new_value).toMatchObject({ code: body.code, base_price: 150_000 });

    expect(await codeOf(catalog().create(adminId, body as never, null))).toBe('SERVICE_CODE_TAKEN');
  });

  it('patches only what changed and audits old → new; no change → no audit', async () => {
    const s = await catalog().create(adminId, newService() as never, null);
    const updated = await catalog().update(adminId, s.id, { base_price: 180_000, name: 'Dịch vụ test' }, null);
    expect(updated.base_price).toBe(180_000);

    const rows = await audits('UPDATE_SERVICE_CATALOG');
    expect(rows).toHaveLength(2);
    // Same transaction → same created_at, so pick the change by its content, not by order.
    const change = rows.find((r: { old_value: unknown }) => r.old_value !== null);
    expect(change).toMatchObject({ old_value: { code: s.code, base_price: 150_000 }, new_value: { code: s.code, base_price: 180_000 } });
    expect(change.new_value).not.toHaveProperty('name');

    await catalog().update(adminId, s.id, { base_price: 180_000 }, null);
    expect(await audits('UPDATE_SERVICE_CATALOG')).toHaveLength(2);
  });

  it('retire with is_active=false (still listed); invasive needs Tier 2; unknown id → 404', async () => {
    const s = await catalog().create(adminId, newService() as never, null);
    await catalog().update(adminId, s.id, { is_active: false }, null);
    expect((await catalog().list()).find((x) => x.id === s.id)?.is_active).toBe(false);

    expect(await codeOf(catalog().update(adminId, s.id, { is_invasive: true }, null))).toBe('INVASIVE_REQUIRES_TIER_2');
    await expect(
      catalog().update(adminId, s.id, { is_invasive: true, required_tier: 'TIER_2_SPECIALIST' as never }, null),
    ).resolves.toMatchObject({ is_invasive: true, required_tier: 'TIER_2_SPECIALIST' });
    // Once invasive, dropping back to Tier 1 alone is refused too.
    expect(await codeOf(catalog().update(adminId, s.id, { required_tier: 'TIER_1_BASIC' as never }, null))).toBe('INVASIVE_REQUIRES_TIER_2');

    expect(await codeOf(catalog().update(adminId, '00000000-0000-4000-8000-000000000000', { is_active: false }, null))).toBe('SERVICE_NOT_FOUND');
  });
});
