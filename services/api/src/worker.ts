import 'dotenv/config';
import { jobs } from './core/jobs';
import { db } from './core/database';                                         // ← MỚI
import { registerTierLifecycleJobs } from './modules/tier-lifecycle/tier-lifecycle.jobs'; // ← MỚI

async function main() {
  jobs.registerHandler('core.backlog-check', async () => {
    await jobs.checkBacklog();
  });
  await jobs.scheduleRecurring('core.backlog-check', { every: 60_000 }, 'core.backlog-check');

  await registerTierLifecycleJobs(jobs);                                      // ← MỚI

  jobs.startWorker();
  console.log('[Worker] Shared job queue worker started');

  const shutdown = async () => {
    await jobs.close();
    await db.close();                                                         // ← MỚI
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Worker Error]', err);
  process.exit(1);
});