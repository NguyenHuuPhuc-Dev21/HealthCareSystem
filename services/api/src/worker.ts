import 'dotenv/config';
import { jobs } from './core/jobs';

async function main() {
  // Phase 1+: các module đăng ký handler tại đây, vd: registerTierLifecycleJobs(jobs)
  jobs.registerHandler('core.backlog-check', async () => {
    await jobs.checkBacklog();
  });
  await jobs.scheduleRecurring('core.backlog-check', { every: 60_000 }, 'core.backlog-check');

  jobs.startWorker();
  console.log('[Worker] Shared job queue worker started');

  const shutdown = async () => {
    await jobs.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Worker Error]', err);
  process.exit(1);
});