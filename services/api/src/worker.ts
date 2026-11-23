import 'dotenv/config';
import { jobs } from './core/jobs';
import { registerPrivacyConsentJobs } from './modules/privacy-consent/privacy-consent.jobs';
import { registerBookingExpiryJobs } from './modules/booking-expiry/booking-expiry.jobs';
import { registerJobBoardJobs } from './modules/job-board/job-board.jobs';
import { registerMatchingRadarJobs } from './modules/matching-radar/matching-radar.jobs';
import { registerTierLifecycleJobs } from './modules/tier-lifecycle/tier-lifecycle.jobs';
import { registerReviewsTrustScoreJobs } from './modules/reviews-trustscore/reviews-trustscore.jobs';

async function main() {
  // Phase 1+: các module đăng ký handler tại đây, vd: registerTierLifecycleJobs(jobs)
  jobs.registerHandler('core.backlog-check', async () => {
    await jobs.checkBacklog();
  });
  await jobs.scheduleRecurring('core.backlog-check', { every: 60_000 }, 'core.backlog-check');

  await registerPrivacyConsentJobs(jobs); // BE-3 · Phase 1 · privacy.retention-sweep (daily 03:00)
  await registerTierLifecycleJobs(jobs); // BE-2 · Phase 1 · tier-lifecycle.gphn-expiry-sweep (daily 00:05)
  registerMatchingRadarJobs(jobs); // BE-2 · Phase 3 · matching-radar.wave + matching-radar.redispatch
  await registerBookingExpiryJobs(jobs); // BE-3 · Phase 3 · booking-expiry.payment-timeout + booking-expiry.sweep (every minute)
  await registerJobBoardJobs(jobs); // BE-3 · Phase 3 · job-board.direct-request-sweep (every minute)
  await registerReviewsTrustScoreJobs(jobs); // BE-1 · Phase 6 · reviews-trustscore.reveal-sweep (hourly :07)

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