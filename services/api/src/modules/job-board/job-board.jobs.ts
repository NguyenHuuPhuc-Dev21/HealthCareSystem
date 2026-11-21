/**
 * job-board job on the shared queue (BE-3 · Phase 3 · BR-08 §2.2).
 *   job-board.direct-request-sweep   every minute: direct requests whose 15-minute window ended → EXPIRED,
 *                                    the booking goes to the Job Board (or to Radar when urgent).
 * Idempotent: an offer is closed only while still SENT; Radar wave jobs carry their own idempotency keys.
 */
import { getJobBoardService, type JobBoardService } from './job-board.service';
import { DIRECT_REQUEST_SWEEP_EVERY_MS, DIRECT_REQUEST_SWEEP_JOB } from './job-board.types';

export async function registerJobBoardJobs(
  queue: {
    registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void;
    scheduleRecurring(schedulerId: string, repeat: { every: number }, jobName: string): Promise<void>;
  },
  service: JobBoardService = getJobBoardService(),
): Promise<void> {
  queue.registerHandler(DIRECT_REQUEST_SWEEP_JOB, async () => {
    const r = await service.runDirectRequestSweep();
    if (r.expired + r.failed > 0) {
      console.log(`[job-board] direct requests: ${r.expired} expired (${r.toRadar} sent to Radar), ${r.failed} failed`);
    }
    if (r.failed > 0) throw new Error(`${r.failed} direct request(s) could not be closed`); // retry → DLQ alert
  });
  await queue.scheduleRecurring(DIRECT_REQUEST_SWEEP_JOB, { every: DIRECT_REQUEST_SWEEP_EVERY_MS }, DIRECT_REQUEST_SWEEP_JOB);
}
