import 'dotenv/config';
import { jobs } from './core/jobs';
import { registerPrivacyConsentJobs } from './modules/privacy-consent/privacy-consent.jobs';
import { registerPaymentTimeoutPlaceholder } from './modules/bookings/bookings.jobs';
import { registerMatchingRadarJobs } from './modules/matching-radar/matching-radar.jobs';
import { registerTierLifecycleJobs } from './modules/tier-lifecycle/tier-lifecycle.jobs';

async function main() {
  // Phase 1+: các module đăng ký handler tại đây, vd: registerTierLifecycleJobs(jobs)
  jobs.registerHandler('core.backlog-check', async () => {
    await jobs.checkBacklog();
  });
  await jobs.scheduleRecurring('core.backlog-check', { every: 60_000 }, 'core.backlog-check');

  await registerPrivacyConsentJobs(jobs); // BE-3 · Phase 1 · privacy.retention-sweep (daily 03:00)
  await registerTierLifecycleJobs(jobs); // BE-2 · Phase 1 · tier-lifecycle.gphn-expiry-sweep (daily 00:05)
  registerMatchingRadarJobs(jobs); // BE-2 · Phase 3 · matching-radar.wave + matching-radar.redispatch
  registerPaymentTimeoutPlaceholder(jobs); // BE-2 · Phase 3 → remove when BE-3 booking-expiry registers the handler

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