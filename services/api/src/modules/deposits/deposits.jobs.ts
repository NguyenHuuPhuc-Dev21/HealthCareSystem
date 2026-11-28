/**
 * deposits jobs on the shared queue (BE-3 · Phase 5 · ADR-0004 D1/D3), Vietnam time.
 *   deposits.reconciliation       daily 01:30 — mirror ledger vs custody statement; MISMATCH throws (retry → DLQ alert)
 *                                 and freezes deposit refund payouts until an Admin resolves it.
 *   deposits.refund-eligibility   daily 02:15 — open closure requests → READY (+ payout due date) or WAITING_HOLD.
 * Both are idempotent (one reconciliation row per date; evaluation only moves REQUESTED / WAITING_HOLD).
 */
import { getDepositsService, type DepositsService } from './deposits.service';
import {
  RECONCILIATION_JOB,
  RECONCILIATION_SCHEDULE,
  REFUND_ELIGIBILITY_JOB,
  REFUND_ELIGIBILITY_SCHEDULE,
} from './deposits.types';

export async function registerDepositsJobs(
  queue: {
    registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void;
    scheduleRecurring(schedulerId: string, repeat: { pattern: string; tz?: string }, jobName: string): Promise<void>;
  },
  service: DepositsService = getDepositsService(),
): Promise<void> {
  queue.registerHandler(RECONCILIATION_JOB, async () => {
    const r = await service.runReconciliation();
    console.log(
      `[deposits] reconciliation ${r.runDate}: ${r.status} wallets=${r.walletsTotal} ledger=${r.ledgerTotal} custody=${r.custodyTotal} mismatched=${r.mismatchedWallets}`,
    );
    if (r.status === 'MISMATCH') throw new Error(`Deposit reconciliation mismatch on ${r.runDate}: refund payouts frozen`);
  });
  await queue.scheduleRecurring(RECONCILIATION_JOB, RECONCILIATION_SCHEDULE, RECONCILIATION_JOB);

  queue.registerHandler(REFUND_ELIGIBILITY_JOB, async () => {
    const r = await service.runRefundEligibilitySweep();
    if (r.ready + r.waiting + r.failed > 0) {
      console.log(`[deposits] refund eligibility: ${r.ready} ready, ${r.waiting} waiting, ${r.failed} failed`);
    }
    if (r.failed > 0) throw new Error(`${r.failed} refund request(s) could not be evaluated`);
  });
  await queue.scheduleRecurring(REFUND_ELIGIBILITY_JOB, REFUND_ELIGIBILITY_SCHEDULE, REFUND_ELIGIBILITY_JOB);
}
