/**
 * privacy-consent background job (contract §5, NFR-PRIV-02) — runs on the shared job queue (BE-2).
 *
 *   privacy.retention-sweep · daily 03:00 Asia/Ho_Chi_Minh
 *   Anonymizes every live profile whose most recent shift check-out is older than
 *   MEDICAL_RECORD_RETENTION_MONTHS, that has no booking still running/upcoming and no OPEN /
 *   UNDER_REVIEW dispute. One DELETE_PATIENT_DATA audit row per profile (actor NULL = system).
 *
 * Idempotent: an anonymized profile has deleted_at set, so a re-run (retry, second worker) skips it.
 * Each profile is its own transaction: one failure does not undo the others.
 */
import { AuditAction } from "@healthcare-system/shared";
import { writeAuditLog } from "../../core/audit";
import { getConfigNumber } from "../../core/config";
import { withTransaction, type DbClient } from "../../core/database";
import {
  anonymizeProfile,
  findRetentionCandidates,
  lockRetentionCandidate,
} from "./privacy-consent.repo";

export const RETENTION_SWEEP_JOB = "privacy.retention-sweep";
/** Operational schedule (not a business number): once a day, at night. */
export const RETENTION_SWEEP_SCHEDULE = {
  pattern: "0 3 * * *",
  tz: "Asia/Ho_Chi_Minh",
};
const DEFAULT_BATCH_SIZE = 100;

export interface RetentionSweepDeps {
  withTx<T>(fn: (client: DbClient) => Promise<T>): Promise<T>;
  /** system_configs.MEDICAL_RECORD_RETENTION_MONTHS */
  retentionMonths(): Promise<number>;
  now?: () => Date;
  batchSize?: number;
}

export interface RetentionSweepResult {
  anonymized: number;
  skipped: number;
}

export async function runRetentionSweep(
  deps: RetentionSweepDeps,
): Promise<RetentionSweepResult> {
  const now = (deps.now ?? (() => new Date()))();
  const months = await deps.retentionMonths();
  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
  const result: RetentionSweepResult = { anonymized: 0, skipped: 0 };
  const seen = new Set<string>();

  for (;;) {
    const ids = (
      await deps.withTx((client) =>
        findRetentionCandidates(client, now, months, batchSize),
      )
    ).filter((id) => !seen.has(id));
    if (ids.length === 0) break;

    for (const id of ids) {
      seen.add(id);
      const done = await deps.withTx(async (client) => {
        const locked = await lockRetentionCandidate(client, id, now, months);
        if (!locked) return false; // changed since the scan (new booking, new dispute, already done)
        await anonymizeProfile(client, id, now);
        await writeAuditLog(client, {
          actorId: null,
          action: AuditAction.DELETE_PATIENT_DATA,
          targetTable: "patient_profiles",
          targetId: id,
          newValue: {
            reason: "RETENTION_EXPIRED",
            retentionMonths: months,
            lastCheckoutAt: new Date(locked.last_checkout).toISOString(),
          },
        });
        return true;
      });
      if (done) result.anonymized += 1;
      else result.skipped += 1;
    }
  }
  return result;
}

/** The part of core/jobs this module needs (JobQueueService satisfies it). */
export interface RecurringJobRegistry {
  registerHandler(jobName: string, handler: () => Promise<void>): void;
  scheduleRecurring(
    schedulerId: string,
    repeat: { pattern: string; tz?: string },
    jobName: string,
  ): Promise<void>;
}

/** Called once from worker.ts: registers the handler and the daily schedule (upsert, safe to repeat). */
export async function registerPrivacyConsentJobs(
  queue: RecurringJobRegistry,
  sweep: () => Promise<RetentionSweepResult> = () =>
    runRetentionSweep({
      withTx: (fn) => withTransaction(fn),
      retentionMonths: () => getConfigNumber("MEDICAL_RECORD_RETENTION_MONTHS"),
    }),
): Promise<void> {
  queue.registerHandler(RETENTION_SWEEP_JOB, async () => {
    const r = await sweep();
    console.log(
      `[privacy-consent] retention sweep: ${r.anonymized} anonymized, ${r.skipped} skipped`,
    );
  });
  await queue.scheduleRecurring(
    RETENTION_SWEEP_JOB,
    RETENTION_SWEEP_SCHEDULE,
    RETENTION_SWEEP_JOB,
  );
}
