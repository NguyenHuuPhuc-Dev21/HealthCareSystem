/**
 * CLI: npm run db:migrate            (migrations + seeds, for local/dev/staging)
 *      npm run db:migrate -- --no-seeds   (schema only, e.g. production)
 */
import 'dotenv/config';
import { runMigrations } from '../core/database/migrator';

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set (see services/api/.env.example)');
  await runMigrations({ connectionString, includeSeeds: !process.argv.includes('--no-seeds') });
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
