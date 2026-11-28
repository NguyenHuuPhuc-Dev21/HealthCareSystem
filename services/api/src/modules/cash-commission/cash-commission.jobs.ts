/**
 * cash-commission job on the shared queue (BE-3 · Phase 5 · FR-PAY-02).
 *   cash-commission.overdue-sweep   every 5 minutes: an ACTIVE nurse with a commission past commission_due_at and
 *                                   unpaid → SUSPENDED (suspended_reason COMMISSION_OVERDUE). Paying lifts it.
 * Idempotent: only ACTIVE profiles are changed.
 */
import { getCashCommissionService, type CashCommissionService } from './cash-commission.service';
import { OVERDUE_SWEEP_EVERY_MS, OVERDUE_SWEEP_JOB } from './cash-commission.types';

export async function registerCashCommissionJobs(
  queue: {
    registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void;
    scheduleRecurring(schedulerId: string, repeat: { every: number }, jobName: string): Promise<void>;
  },
  service: CashCommissionService = getCashCommissionService(),
): Promise<void> {
  queue.registerHandler(OVERDUE_SWEEP_JOB, async () => {
    const r = await service.runOverdueSweep();
    if (r.suspended > 0) console.log(`[cash-commission] ${r.suspended} nurse(s) suspended for an overdue commission`);
  });
  await queue.scheduleRecurring(OVERDUE_SWEEP_JOB, { every: OVERDUE_SWEEP_EVERY_MS }, OVERDUE_SWEEP_JOB);
}
