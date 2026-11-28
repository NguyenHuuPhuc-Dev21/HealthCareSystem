/**
 * CLI: npm run ops:dr-verify -- --restored=<url> [--source=<url>] [--target="<time>"] [--json]
 *
 * Checks a database restored from backup / PITR (infra/dr/restore.sh or drill.sh) before it is trusted
 * (BE-2 · Phase 8 · NFR-AVAIL-01). --restored defaults to DATABASE_URL. --source = the live database (compares rows
 * created up to --target, the ledger and WAL archiving health). Exit 0 = PASS / WARN, 1 = FAIL.
 * Read-only on both databases. Runbook: docs/runbooks/backup-pitr-dr-drill.md
 */
import 'dotenv/config';
import pg from 'pg';
import { findDbDir, listSqlFiles } from '../core/database/migrator';
import { overall, runDrChecks, type DrCheck } from '../core/dr';

function arg(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function print(checks: DrCheck[]): void {
  const icon = { PASS: '✔', WARN: '!', FAIL: '✘' } as const;
  for (const c of checks) console.log(`${icon[c.status]} ${c.status.padEnd(4)} ${c.name.padEnd(30)} ${c.detail}`);
  console.log(`\nRESULT: ${overall(checks)}`);
}

async function main(): Promise<void> {
  const restoredUrl = arg('restored') ?? process.env.DATABASE_URL;
  if (!restoredUrl) throw new Error('give --restored=<postgres url> (or set DATABASE_URL)');
  const sourceUrl = arg('source');
  const target = arg('target');
  const restored = new pg.Pool({ connectionString: restoredUrl, max: 1 });
  const source = sourceUrl ? new pg.Pool({ connectionString: sourceUrl, max: 1 }) : null;
  try {
    const migrationIds = listSqlFiles(findDbDir(), 'migrations').map((f) => f.id);
    const checks = await runDrChecks({ restored, source, migrationIds, target });
    if (process.argv.includes('--json')) console.log(JSON.stringify({ result: overall(checks), target, checks }, null, 2));
    else print(checks);
    if (overall(checks) === 'FAIL') process.exitCode = 1;
  } finally {
    await restored.end();
    await source?.end();
  }
}

main().catch((err: unknown) => {
  console.error(`[dr-verify] ${(err as Error).message}`);
  process.exit(1);
});
