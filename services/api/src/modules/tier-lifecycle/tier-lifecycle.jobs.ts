/**
 * tier-lifecycle background job (BE-2 · Phase 1 · FR-AUTH-02 §2, BR-21 §2.5) — on the shared job queue.
 *
 *   tier-lifecycle.gphn-expiry-sweep · daily 00:05 Asia/Ho_Chi_Minh
 *   For every TIER_2_SPECIALIST nurse whose GPHN expiry date is today or earlier:
 *     1. demote to TIER_1_BASIC — profile_status stays as it is (ACTIVE stays ACTIVE);
 *     2. take them off future CONFIRMED bookings that need Tier 2 (no penalty) → back to MATCHING;
 *     3. audit TIER_DEMOTION (actor NULL = system) in the same transaction;
 *     4. after commit: schedule matching-radar.redispatch per booking, notify nurse + customers.
 *
 * Re-promotion is NOT here: credential-review (BE-1) sets Tier 2 again when the Admin approves a
 * renewed GPHN, through the same computeTier rule.
 *
 * Idempotent: a demoted nurse is no longer a candidate; a released booking is no longer CONFIRMED
 * with that nurse; the redispatch key is per booking + nurse. A re-run (retry, second worker) is a no-op.
 * Each nurse is its own transaction: one failure does not undo the others. If any step failed the
 * handler throws AFTER processing everyone, so the queue retries and finally dead-letters (alert).
 */
import { AuditAction, NurseTier, TIMEZONE_DISPLAY } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { query, withTransaction, type DbClient, type Queryable } from '../../core/database';
import { releaseFromDate, shouldDemote } from './tier-lifecycle.policy';
import { demoteToTier1, findDemotionCandidates, lockNurseTier, releaseInvasiveBookings } from './tier-lifecycle.repo';
import {
  GPHN_EXPIRY_SWEEP_JOB,
  GPHN_EXPIRY_SWEEP_SCHEDULE,
  REDISPATCH_JOB,
  type DemotionOutcome,
  type RedispatchPayload,
  type SweepResult,
  type TierNotice,
} from './tier-lifecycle.types';

const DEFAULT_BATCH_SIZE = 100;

/** The part of core/jobs the sweep uses to hand bookings to the matcher. */
export interface RedispatchScheduler {
  scheduleJob<T>(jobName: string, payload: T, runAt: Date, idempotencyKey: string): Promise<unknown>;
}

export interface GphnSweepDeps {
  withTx<T>(fn: (client: DbClient) => Promise<T>): Promise<T>;
  /** Read-only executor for the candidate scan (the pool). */
  read: Queryable;
  scheduler: RedispatchScheduler;
  /** Optional: core/notifications is not wired as a singleton yet (see README). */
  notify?: (notice: TierNotice) => Promise<void>;
  now?: () => number;
  batchSize?: number;
  log?: (message: string) => void;
}

/** Vietnam calendar date (YYYY-MM-DD) — the legal date for GPHN validity. */
export function vietnamDate(nowMs: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE_DISPLAY }).format(new Date(nowMs));
}

/** One nurse, one transaction. Returns null when the nurse no longer qualifies once locked. */
export async function demoteOne(
  client: DbClient | Queryable,
  nurseId: string,
  today: string,
  now: Date,
): Promise<DemotionOutcome | null> {
  const row = await lockNurseTier(client, nurseId);
  if (!row) return null;
  const facts = { tier: row.tier, gphnNumber: row.gphn_number, gphnExpiryDate: row.gphn_expiry_date };
  // Re-check under the lock: a renewal approved since the scan wins.
  if (!shouldDemote(facts, today)) return null;

  const demoted = await demoteToTier1(client, nurseId);
  if (!demoted) return null;

  const released = await releaseInvasiveBookings(client, nurseId, releaseFromDate(row.gphn_expiry_date, today), now);

  await writeAuditLog(client, {
    actorId: null,
    action: AuditAction.TIER_DEMOTION,
    targetTable: 'nurse_profiles',
    targetId: nurseId,
    oldValue: { tier: row.tier, gphnNumber: row.gphn_number, gphnExpiryDate: row.gphn_expiry_date },
    newValue: {
      tier: NurseTier.TIER_1_BASIC,
      profileStatus: row.profile_status, // unchanged on purpose
      reason: 'GPHN_EXPIRED',
      sweepDate: today,
      releasedBookingIds: released.map((b) => b.id),
    },
  });

  return { nurseId, previousExpiryDate: row.gphn_expiry_date, releasedBookings: released };
}

/** Steps that happen after commit. Returns how many of them failed. */
async function afterCommit(deps: GphnSweepDeps, outcome: DemotionOutcome, now: Date): Promise<number> {
  const log = deps.log ?? console.log;
  let failed = 0;

  for (const b of outcome.releasedBookings) {
    const payload: RedispatchPayload = {
      bookingId: b.id,
      reason: 'NURSE_TIER_DEMOTED',
      releasedNurseId: outcome.nurseId,
      matchingMode: b.matching_mode,
    };
    try {
      await deps.scheduler.scheduleJob(REDISPATCH_JOB, payload, now, `redispatch:${b.id}:${outcome.nurseId}`);
    } catch (err) {
      failed += 1;
      // The booking is MATCHING with no nurse: it must not be lost silently.
      console.error(`[tier-lifecycle] could not schedule redispatch for booking ${b.id}: ${(err as Error).message}`);
    }
  }

  if (deps.notify) {
    const notices: TierNotice[] = [
      {
        userId: outcome.nurseId,
        title: 'Giấy phép hành nghề đã hết hạn',
        body:
          'Hồ sơ của bạn đã chuyển về Tier 1. Bạn vẫn nhận được ca không xâm lấn. ' +
          'Hãy nộp GPHN mới để được nâng lại Tier 2.',
      },
      ...outcome.releasedBookings.map((b) => ({
        userId: b.customer_id,
        bookingId: b.id,
        title: `Đang tìm điều dưỡng thay thế cho đơn ${b.booking_code}`,
        body: 'Điều dưỡng trước không còn đủ điều kiện cho dịch vụ này. Hệ thống đang tìm người thay, bạn không mất phí.',
      })),
    ];
    for (const n of notices) {
      try {
        await deps.notify(n);
      } catch (err) {
        // Notifications are best-effort here; the state change is already committed and audited.
        log(`[tier-lifecycle] notification to ${n.userId} failed: ${(err as Error).message}`);
      }
    }
  }
  return failed;
}

export async function runGphnExpirySweep(deps: GphnSweepDeps): Promise<SweepResult> {
  const nowMs = (deps.now ?? Date.now)();
  const now = new Date(nowMs);
  const today = vietnamDate(nowMs);
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
  const result: SweepResult = { demoted: 0, skipped: 0, releasedBookings: 0, failed: 0 };

  let afterId: string | null = null;
  for (;;) {
    const ids = await findDemotionCandidates(deps.read, today, batchSize, afterId);
    if (ids.length === 0) break;
    afterId = ids[ids.length - 1];

    for (const nurseId of ids) {
      let outcome: DemotionOutcome | null;
      try {
        outcome = await deps.withTx((client) => demoteOne(client, nurseId, today, now));
      } catch (err) {
        result.failed += 1;
        console.error(`[tier-lifecycle] demotion failed for nurse ${nurseId}: ${(err as Error).message}`);
        continue;
      }
      if (!outcome) {
        result.skipped += 1;
        continue;
      }
      result.demoted += 1;
      result.releasedBookings += outcome.releasedBookings.length;
      result.failed += await afterCommit(deps, outcome, now);
    }
    if (ids.length < batchSize) break;
  }
  return result;
}

let tierNotifier: ((notice: TierNotice) => Promise<void>) | null = null;

/**
 * Wire notifications once core/notifications exposes a shared service (BE-3), e.g. in worker.ts:
 *   setTierLifecycleNotifier((n) => notifications.dispatch({ userId: n.userId, bookingId: n.bookingId, title: n.title, body: n.body }).then(() => undefined));
 * Until then the sweep runs without notifications (state change + audit still happen).
 */
export function setTierLifecycleNotifier(notify: ((notice: TierNotice) => Promise<void>) | null): void {
  tierNotifier = notify;
}

/** The part of core/jobs this module registers with (JobQueueService satisfies it). */
export interface RecurringJobRegistry {
  registerHandler(jobName: string, handler: () => Promise<void>): void;
  scheduleRecurring(schedulerId: string, repeat: { pattern: string; tz?: string }, jobName: string): Promise<void>;
}

/** Called once from worker.ts: registers the handler and the daily schedule (upsert, safe to repeat). */
export async function registerTierLifecycleJobs(
  queue: RecurringJobRegistry & RedispatchScheduler,
  sweep: () => Promise<SweepResult> = () =>
    runGphnExpirySweep({
      withTx: (fn) => withTransaction(fn),
      read: { query },
      scheduler: queue,
      notify: tierNotifier ?? undefined,
    }),
): Promise<void> {
  queue.registerHandler(GPHN_EXPIRY_SWEEP_JOB, async () => {
    const r = await sweep();
    console.log(
      `[tier-lifecycle] GPHN sweep: ${r.demoted} demoted, ${r.releasedBookings} bookings re-dispatched, ` +
        `${r.skipped} skipped, ${r.failed} failed`,
    );
    if (r.failed > 0) {
      // Everyone else is already done; the retry only picks up what is left (idempotent).
      throw new Error(`GPHN sweep finished with ${r.failed} failure(s)`);
    }
  });
  await queue.scheduleRecurring(GPHN_EXPIRY_SWEEP_JOB, GPHN_EXPIRY_SWEEP_SCHEDULE, GPHN_EXPIRY_SWEEP_JOB);
}

/**
 * TEMPORARY (Phase 1 → Phase 3): matching-radar does not exist yet, so nothing consumes
 * matching-radar.redispatch. Without a handler core/jobs would dead-letter every job and raise
 * the backlog alert. This placeholder only logs; the booking already sits in MATCHING.
 * Phase 3: delete this function and its call in worker.ts when matching-radar registers the real handler.
 */
export function registerRedispatchPlaceholder(queue: {
  registerHandler(jobName: string, handler: (payload: RedispatchPayload) => Promise<void>): void;
}): void {
  queue.registerHandler(REDISPATCH_JOB, async (payload) => {
    console.warn(
      `[tier-lifecycle] redispatch placeholder: booking ${payload.bookingId} is MATCHING ` +
        `(reason ${payload.reason}); matching-radar (Phase 3) is not wired yet`,
    );
  });
}
