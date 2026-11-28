/**
 * wallets-ledger job on the shared queue (BE-3 · Phase 5 · FR-BOOK-02 Layer 3).
 *   wallets-ledger.travel-support-sweep   every 5 minutes: PENDING travel support of on-site prescription
 *                                         rejections → TRAVEL_SUPPORT credit + travel_support_status = PAID.
 * Idempotent: each rejection is paid under travel-support:<id>, and only while still PENDING.
 */
import { getWalletsLedgerService, type WalletsLedgerService } from './wallets-ledger.service';
import { TRAVEL_SUPPORT_SWEEP_EVERY_MS, TRAVEL_SUPPORT_SWEEP_JOB } from './wallets-ledger.types';

export async function registerWalletsLedgerJobs(
  queue: {
    registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void;
    scheduleRecurring(schedulerId: string, repeat: { every: number }, jobName: string): Promise<void>;
  },
  service: WalletsLedgerService = getWalletsLedgerService(),
): Promise<void> {
  queue.registerHandler(TRAVEL_SUPPORT_SWEEP_JOB, async () => {
    const r = await service.runTravelSupportSweep();
    if (r.paid + r.failed > 0) console.log(`[wallets-ledger] travel support: ${r.paid} paid, ${r.failed} failed`);
    if (r.failed > 0) throw new Error(`${r.failed} travel support payout(s) failed`); // retry → DLQ alert
  });
  await queue.scheduleRecurring(TRAVEL_SUPPORT_SWEEP_JOB, { every: TRAVEL_SUPPORT_SWEEP_EVERY_MS }, TRAVEL_SUPPORT_SWEEP_JOB);
}
