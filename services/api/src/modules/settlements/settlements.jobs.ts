/**
 * settlements job on the shared queue (BE-3 · Phase 5 · FR-PAY-02).
 *   settlements.sweep   every 5 minutes: shifts checked out ≥ SETTLEMENT_COOLING_HOURS ago with no dispute, and
 *                       cancellation shares still PENDING → paid out.
 * Idempotent: each booking is settled under its lock, once (settled_at + one idempotency key per ledger row).
 * A booking whose escrow does not match throws → counted as failed → the job errors (retry → DLQ alert).
 */
import { getSettlementsService, type SettlementsService } from './settlements.service';
import { SETTLEMENT_SWEEP_EVERY_MS, SETTLEMENT_SWEEP_JOB } from './settlements.types';

export async function registerSettlementsJobs(
  queue: {
    registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void;
    scheduleRecurring(schedulerId: string, repeat: { every: number }, jobName: string): Promise<void>;
  },
  service: SettlementsService = getSettlementsService(),
): Promise<void> {
  queue.registerHandler(SETTLEMENT_SWEEP_JOB, async () => {
    const r = await service.runSweep();
    if (r.shifts + r.cancellations + r.failed > 0) {
      console.log(`[settlements] sweep: ${r.shifts} shifts, ${r.cancellations} cancellation shares settled, ${r.skipped} skipped, ${r.failed} failed`);
    }
    if (r.failed > 0) throw new Error(`${r.failed} settlement(s) failed`);
  });
  await queue.scheduleRecurring(SETTLEMENT_SWEEP_JOB, { every: SETTLEMENT_SWEEP_EVERY_MS }, SETTLEMENT_SWEEP_JOB);
}
