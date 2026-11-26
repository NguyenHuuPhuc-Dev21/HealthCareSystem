/**
 * CLI: npm run db:migrate            (migrations + seeds, for local/dev/staging)
 *      npm run db:migrate -- --no-seeds   (schema only, e.g. production)
 *      npm run db:migrate -- --override-embargo="<reason>"   (emergency fix inside 19:00–21:00)
 *
 * Maintenance embargo (NFR-AVAIL-01, BE-2 Phase 8): pending migrations are refused during the 19:00–21:00 shift
 * handover window when NODE_ENV=production (or MAINTENANCE_EMBARGO=enforce); elsewhere only a warning.
 */
import 'dotenv/config';
import { runMigrations } from '../core/database/migrator';
import { describeError } from '../core/errors';
import { MaintenanceEmbargoError, checkEmbargo, embargoMode, loadEmbargoWindow } from '../core/maintenance';

function flag(name: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set (see services/api/.env.example)');
  await runMigrations({
    connectionString,
    includeSeeds: !process.argv.includes('--no-seeds'),
    beforeApply: async (pending, client) => {
      const decision = checkEmbargo(
        Date.now(),
        await loadEmbargoWindow(client),
        embargoMode(),
        `Chạy ${pending.length} migration`,
        flag('override-embargo'),
      );
      if (decision.message) console.warn(decision.message);
      if (!decision.allowed) throw new MaintenanceEmbargoError(decision.message!);
    },
  });
}

main().catch((err: unknown) => {
  console.error(`[migrate] ${describeError(err)}`);
  console.error('[migrate] Is PostgreSQL running? Check with: docker ps');
  process.exit(1);
});
