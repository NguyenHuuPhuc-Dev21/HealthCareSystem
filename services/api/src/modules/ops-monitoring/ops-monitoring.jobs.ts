/**
 * ops-monitoring job on the shared queue (BE-3 · Phase 8).
 *   ops-monitoring.sweep   every 5 minutes: run every check; each ALERT → [OPS][ALERT] log line + Admin notification
 *                          (at most once per OPS_ALERT_REPEAT_MINUTES per check). Read-only: safe to re-run.
 */
import { getOpsMonitoringService, type OpsMonitoringService } from './ops-monitoring.service';
import { OPS_SWEEP_EVERY_MS, OPS_SWEEP_JOB } from './ops-monitoring.types';

export async function registerOpsMonitoringJobs(
  queue: {
    registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void;
    scheduleRecurring(schedulerId: string, repeat: { every: number }, jobName: string): Promise<void>;
  },
  service: OpsMonitoringService = getOpsMonitoringService(),
): Promise<void> {
  queue.registerHandler(OPS_SWEEP_JOB, async () => {
    const r = await service.sweep();
    if (r.status !== 'OK') console.log(`[ops-monitoring] status ${r.status}: ${r.alerts} alert(s), ${r.notified} notified`);
  });
  await queue.scheduleRecurring(OPS_SWEEP_JOB, { every: OPS_SWEEP_EVERY_MS }, OPS_SWEEP_JOB);
}
