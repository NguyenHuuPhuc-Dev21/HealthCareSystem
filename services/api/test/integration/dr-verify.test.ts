import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { findDbDir, listSqlFiles } from '../../src/core/database/migrator';
import { CRITICAL_TRIGGERS, overall, runDrChecks, type DrDb } from '../../src/core/dr';
import { createTestPool } from './helpers';

/**
 * Phase 8 (BE-2) — kiểm tra CSDL sau khôi phục (NFR-AVAIL-01: RPO ví ≤ 1h, log ≤ 24h, RTO ≤ 4h).
 * Chạy các câu SQL thật của `npm run ops:dr-verify` trên DB test (vừa làm "nguồn" vừa làm "bản khôi phục"):
 * migration đủ, trigger chống sửa/xóa còn nguyên, số dòng tới thời điểm đích khớp nguồn. Chỉ đọc, không ghi.
 * Bản khôi phục "thiếu dữ liệu" được giả lập bằng một nguồn có thêm 1 dòng giao dịch ví trước thời điểm đích.
 */
describe('dr-verify checks (integration, read-only)', () => {
  let pool: Pool;
  const migrationIds = listSqlFiles(findDbDir(), 'migrations').map((f) => f.id);

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('a faithful copy passes: promoted, all migrations, all critical triggers, same rows up to the target', async () => {
    const target = new Date().toISOString();
    const checks = await runDrChecks({ restored: pool, source: pool, migrationIds, target });
    const by = Object.fromEntries(checks.map((c) => [c.name, c]));
    expect(by.recovery.status).toBe('PASS');
    expect(by.migrations).toMatchObject({ status: 'PASS' });
    expect(by.migrations.detail).toContain(`${migrationIds.length} migration files`);
    expect(by.triggers).toMatchObject({ status: 'PASS', detail: `${CRITICAL_TRIGGERS.length} critical triggers present and enabled` });
    for (const t of ['wallet_transactions', 'audit_logs', 'bookings', 'conversations_messages']) {
      expect(by[`rows:${t}`].status).toBe('PASS');
    }
    // test fixtures create wallets with balances but no ledger rows: same on both sides → WARN, never FAIL
    expect(['PASS', 'WARN']).toContain(by.ledger.status);
    // a dev / CI database does not archive WAL: reported, which is the point of the check
    expect(by.archiving).toBeDefined();
  });

  it('rows created before the target but missing in the restored copy → FAIL (that is lost money / evidence)', async () => {
    const target = new Date().toISOString();
    // the live database knows one more ledger row before the target than the restored copy
    const source = {
      query: async (sql: string, params?: unknown[]) => {
        const r = await pool.query(sql, params as any[]);
        if (/FROM wallet_transactions WHERE created_at/.test(sql)) return { rows: [{ ...r.rows[0], n: r.rows[0].n + 1 }] };
        return r;
      },
    } as unknown as DrDb;
    const checks = await runDrChecks({ restored: pool, source, migrationIds, target });
    const wt = checks.find((c) => c.name === 'rows:wallet_transactions')!;
    expect(wt.status).toBe('FAIL');
    expect(wt.detail).toContain('1 row(s) created before');
    expect(wt.detail).toContain('RPO wallets ≤ 1 h');
    expect(checks.find((c) => c.name === 'rows:audit_logs')!.status).toBe('PASS');
    expect(overall(checks)).toBe('FAIL');
  });

  it('a missing migration or trigger fails the restore', async () => {
    const checks = await runDrChecks({ restored: pool, migrationIds: [...migrationIds, 'migrations/9999_future.sql'] });
    expect(checks.find((c) => c.name === 'migrations')).toMatchObject({ status: 'FAIL', detail: 'missing: migrations/9999_future.sql' });
    expect(checks.find((c) => c.name === 'rows:wallet_transactions')?.status).toBe('WARN'); // no source to compare
    expect(checks.find((c) => c.name === 'archiving')).toBeUndefined(); // source-only check
  });
});
