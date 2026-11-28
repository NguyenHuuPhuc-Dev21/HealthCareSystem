/**
 * cancellation-policy — the NURSE side of the SRS §5.2 matrix, rows 6–7 (BE-1 / Dev A).
 * Traceability: SRS §5.2 rows 6–7 · BR-18 §2.1 · FR-RATE-01 · ADR-0004 D3 · FR-BOOK-03 (re-matching)
 *
 *  GET  /bookings/:id/nurse-cancel-preview   what giving the shift back now would cost the nurse (nothing stored)
 *  POST /bookings/:id/nurse-cancel { reason } give it back. In ONE transaction under the booking lock:
 *       - booking → MATCHING without a nurse (the customer keeps the booking and pays nothing more);
 *       - nurse_cancellations row (append-only);
 *       - TrustScore −TRUST_PENALTY_NURSE_CANCEL_EARLY / _LATE through reviews-trustscore (may suspend at < 60);
 *       - row 7 only: fine = NURSE_LATE_CANCEL_FINE_RATE × total from the deposit (deposits.deductPenalty, BE-3 —
 *         may go negative = debt, appealable for PENALTY_APPEAL_DAYS), and the same amount added to the booking's
 *         urgent_bonus_amount for the replacement (paid out at settlement — BE-3).
 *       After COMMIT: matching-radar.redispatch is scheduled (urgent → Radar without this nurse, later → Job Board),
 *       and the customer and the nurse are told.
 *
 * Only the nurse assigned to a CONFIRMED booking, before the start time. Once the shift has started it is no
 * longer a cancellation (no-show / early stop flows).
 */
import { ExecutionStatus, PenaltyReason, type MatchingMode, type SystemConfigKey } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, notFound } from '../../core/errors';
import { scheduleJob } from '../../core/jobs';
import { deductPenalty } from '../deposits/deposits.ledger';
import { notifyUser, sendNotices } from '../notifications/notifications.service';
import type { Notify } from '../notifications/notifications.types';
import { applyTrustScoreChange } from '../reviews-trustscore/reviews-trustscore.service';
import { REDISPATCH_JOB } from '../tier-lifecycle/tier-lifecycle.types';
import { nurseCancel } from './cancellation-policy.policy';
import { loadSlaRules, toSlaBooking } from './cancellation-policy.service';
import * as repo from './cancellation-policy.nurse.repo';
import type { CancelBookingRow } from './cancellation-policy.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NurseCancelBookingRow = CancelBookingRow & { matching_mode: MatchingMode };
export type NurseCancelScenario = 'NURSE_CANCEL_EARLY' | 'NURSE_CANCEL_URGENT';

export interface NurseCancelPreview {
  bookingId: string;
  bookingCode: string;
  scenario: NurseCancelScenario;
  hoursBeforeStart: number;
  /** NURSE_CANCEL_FREE_HOURS: above this many hours before the start there is no fine. */
  freeHours: number;
  /** Taken from the deposit (0 when early). */
  fine: number;
  finePercent: number;
  /** Negative. */
  trustScoreDelta: number;
}

export interface NurseCancelResult extends NurseCancelPreview {
  cancellationId: string;
  trustScore: number;
  /** The TrustScore fell below TRUST_SUSPEND_BELOW: the nurse can no longer take shifts until an Admin lifts it. */
  suspended: boolean;
  penaltyTransactionId: string | null;
}

/**
 * Idempotency key of the row-7 fine — per booking AND nurse (a second nurse may also give the same booking back).
 * Short prefix: wallet_transactions.idempotency_key is VARCHAR(100) and two UUIDs already take 73 characters.
 */
export const nurseFineKey = (bookingId: string, nurseId: string) => `deposit-penalty:NLC:${bookingId}:${nurseId}`;

/** The part of core/jobs used here. */
export interface RedispatchScheduler {
  scheduleJob<T>(jobName: string, payload: T, runAt: Date, idempotencyKey: string): Promise<unknown>;
}

export interface NurseCancelDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  scheduler: RedispatchScheduler;
  notify?: Notify;
  now?: () => number;
}

const notFoundBooking = () => notFound('BOOKING_NOT_FOUND', 'Booking not found');

/** Why this nurse may not give this booking back now (null = she may). */
export function nurseCancelProblem(
  b: { nurse_id: string | null; execution_status: string; start_time: Date | string },
  nurseId: string,
  nowMs: number,
): AppError | null {
  if (b.nurse_id !== nurseId) return notFoundBooking(); // not hers: no existence leak
  if (b.execution_status === ExecutionStatus.IN_PROGRESS) {
    return new AppError(409, 'SHIFT_IN_PROGRESS', 'The shift has started: end it early from the shift screen instead');
  }
  if (b.execution_status !== ExecutionStatus.CONFIRMED) {
    return new AppError(409, 'BOOKING_NOT_CANCELLABLE', 'This booking can no longer be given back', { executionStatus: b.execution_status });
  }
  if (new Date(b.start_time).getTime() <= nowMs) {
    return new AppError(422, 'SHIFT_ALREADY_STARTED', 'The start time has passed: this is no longer a cancellation');
  }
  return null;
}

export class NurseCancelService {
  constructor(private readonly deps: NurseCancelDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private async decide(b: NurseCancelBookingRow, nowMs: number): Promise<NurseCancelPreview> {
    const rules = await loadSlaRules(this.deps.getNumber);
    const o = nurseCancel(toSlaBooking(b), nowMs, rules);
    return {
      bookingId: b.id,
      bookingCode: b.booking_code,
      scenario: o.scenario as NurseCancelScenario,
      hoursBeforeStart: o.hoursBeforeStart ?? 0,
      freeHours: rules.nurseFreeHours,
      fine: o.nurseFine,
      finePercent: o.nurseFine > 0 ? rules.nurseLateFineRate * 100 : 0,
      trustScoreDelta: o.trustScoreDelta,
    };
  }

  /** GET /bookings/:id/nurse-cancel-preview */
  async preview(nurseId: string, bookingId: string): Promise<NurseCancelPreview> {
    const b = UUID_RE.test(bookingId) ? await repo.findBookingForNurse(this.deps.read, bookingId) : null;
    if (!b) throw notFoundBooking();
    const nowMs = this.nowMs();
    const problem = nurseCancelProblem(b, nurseId, nowMs);
    if (problem) throw problem;
    return this.decide(b, nowMs);
  }

  /** POST /bookings/:id/nurse-cancel */
  async cancel(nurseId: string, bookingId: string, reason: string): Promise<NurseCancelResult> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    const nowMs = this.nowMs();
    const suspendBelow = await this.deps.getNumber('TRUST_SUSPEND_BELOW');

    const out = await this.deps.withTx(async (db) => {
      const b = await repo.lockBookingForNurse(db, bookingId);
      if (!b) throw notFoundBooking();
      const problem = nurseCancelProblem(b, nurseId, nowMs);
      if (problem) throw problem;
      const d = await this.decide(b, nowMs);

      const mode = await repo.releaseNurse(db, b.id, nurseId, d.fine);
      if (!mode) throw new AppError(409, 'BOOKING_NOT_CANCELLABLE', 'This booking can no longer be given back');

      const trust = await applyTrustScoreChange(
        db,
        {
          nurseId,
          delta: d.trustScoreDelta,
          reason: d.scenario === 'NURSE_CANCEL_EARLY' ? 'CANCEL_OVER_12H' : 'CANCEL_WITHIN_12H',
          bookingId: b.id,
          note: reason,
        },
        suspendBelow,
      );

      let penaltyTransactionId: string | null = null;
      if (d.fine > 0) {
        const p = await deductPenalty(
          db,
          {
            nurseId,
            bookingId: b.id,
            reason: PenaltyReason.NURSE_LATE_CANCEL,
            amount: d.fine,
            slaRuleRef: 'SRS §5.2 row 7',
            note: reason,
            idempotencyKey: nurseFineKey(b.id, nurseId),
          },
          nowMs,
          this.deps.getNumber,
        );
        penaltyTransactionId = p?.transactionId ?? null;
      }

      const cancellationId = await repo.insertNurseCancellation(db, {
        bookingId: b.id,
        nurseId,
        scenario: d.scenario,
        reason,
        hoursBeforeStart: d.hoursBeforeStart,
        totalAmount: Number(b.total_amount),
        fine: d.fine,
        trustScoreDelta: d.trustScoreDelta,
        penaltyTransactionId,
      });
      return { b, d, mode, trust, penaltyTransactionId, cancellationId };
    });

    // After COMMIT: find someone else. Same job and key shape as tier-lifecycle / admin-users (BE-2).
    await this.deps.scheduler.scheduleJob(
      REDISPATCH_JOB,
      { bookingId: out.b.id, reason: 'NURSE_CANCELLED', releasedNurseId: nurseId, matchingMode: out.mode },
      new Date(nowMs),
      `redispatch:${out.b.id}:${nurseId}`,
    );
    await sendNotices(this.deps.notify, [
      {
        userId: out.b.customer_id,
        bookingId: out.b.id,
        type: 'BOOKING_NURSE_CANCELLED',
        title: `Điều dưỡng đã hủy ca ${out.b.booking_code}`,
        body: 'Chúng tôi đang tìm điều dưỡng khác cho bạn. Bạn không mất thêm chi phí nào.',
        data: { bookingId: out.b.id },
      },
      {
        userId: nurseId,
        bookingId: out.b.id,
        type: out.d.fine > 0 ? 'DEPOSIT_PENALTY' : 'BOOKING_CANCELLED',
        title: `Bạn đã hủy ca ${out.b.booking_code}`,
        body:
          out.d.fine > 0
            ? `TrustScore ${out.d.trustScoreDelta}, trừ ${out.d.fine.toLocaleString('vi-VN')}đ ký quỹ. Bạn có thể kháng nghị khoản trừ.`
            : `TrustScore ${out.d.trustScoreDelta}.`,
        data: { bookingId: out.b.id },
      },
    ]);

    return {
      ...out.d,
      cancellationId: out.cancellationId,
      trustScore: out.trust.scoreAfter,
      suspended: out.trust.suspended,
      penaltyTransactionId: out.penaltyTransactionId,
    };
  }
}

let singleton: NurseCancelService | null = null;

export function getNurseCancelService(): NurseCancelService {
  if (!singleton) {
    singleton = new NurseCancelService({
      read: getPool(),
      withTx: (fn) => withTransaction((client) => fn(client)),
      getNumber: getConfigNumber,
      scheduler: { scheduleJob },
      notify: notifyUser,
    });
  }
  return singleton;
}

