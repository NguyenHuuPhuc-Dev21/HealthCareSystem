import { db } from '../../core/database';
import type { JobQueueService } from '../../core/jobs';
import { runGphnExpirySweep } from './tier-lifecycle.service';

export const GPHN_SWEEP_JOB = 'tier-lifecycle.gphn-sweep';
const BUSINESS_TZ = 'Asia/Ho_Chi_Minh';

/** Date → 'YYYY-MM-DD' theo giờ Việt Nam */
export function toBusinessDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export async function registerTierLifecycleJobs(jobs: JobQueueService): Promise<void> {
  jobs.registerHandler(GPHN_SWEEP_JOB, async () => {
    const now = new Date();
    const result = await db.withTransaction((client) =>
      runGphnExpirySweep(client, { today: toBusinessDate(now), now }),
    );
    console.log(
      `[tier-lifecycle] demoted=${result.demotedNurseIds.length} released=${result.releasedBookings.length}`,
    );
  });

  // 00:05 hằng ngày giờ VN
  await jobs.scheduleRecurring(GPHN_SWEEP_JOB, { pattern: '5 0 * * *', tz: BUSINESS_TZ }, GPHN_SWEEP_JOB);
}