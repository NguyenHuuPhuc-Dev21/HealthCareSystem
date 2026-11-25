/**
 * check-out — closes the shift (BE-2 · Phase 4). Traceability: FR-SHIFT-04 · FR-PAY-02 · FR-PRIV-01 · FR-RATE-01.
 *
 *  POST /bookings/:id/check-out   (assigned nurse, booking IN_PROGRESS)
 *    Refused unless the minimal care report is complete: final vitals, every mandatory checklist item, a handover
 *    note (400 CARE_REPORT_INCOMPLETE). Shift/hour-based services cannot check out before the scheduled end minus
 *    CHECKOUT_EARLY_TOLERANCE_MINUTES (409 SHIFT_NOT_FINISHED); task-based services are paid 100% once the
 *    checklist is done, even early (rule 3) — nothing here changes the amounts.
 *    Under the booking lock: shift_logs.checkout_time = SERVER time, final vitals + report stored, booking →
 *    COMPLETED, open extension / surcharge requests expired. checkout_time is the one anchor of:
 *      - the 24h settlement & dispute window: settlements (BE-3) pays bank-transfer shifts out at
 *        checkout + SETTLEMENT_COOLING_HOURS if no dispute (its sweep job on the shared queue); disputes (BE-3) are
 *        accepted until then;
 *      - the cash commission deadline: bookings.commission_due_at = checkout + CASH_COMMISSION_DUE_HOURS
 *        (cash-commission, BE-3, suspends after it);
 *      - the medical-record window: the nurse reads the record until checkout + RECORD_ACCESS_EXPIRY_HOURS
 *        (privacy-consent, BE-3, enforces it on every read — no job needed);
 *      - two-way reviews: open as soon as the booking is COMPLETED (reviews-trustscore, BE-1).
 */
import {
  ExecutionStatus,
  PaymentMethod,
  type ShiftExecutionState,
  type SystemConfigKey,
} from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import type { Queryable } from '../../core/database';
import { AppError, badRequest } from '../../core/errors';
import { CHECKLIST, completeItems, measuredAtProblem, missingMandatory, toStoredVital } from '../shift-logs/shift-logs.policy';
import * as shiftRepo from '../shift-logs/shift-logs.repo';
import { defaultShiftDeps, getShiftLogsService, notFoundBooking, sendShiftNotices, type ShiftLogsService } from '../shift-logs/shift-logs.service';
import { SHIFT_NOTICE, type ShiftNotice, type ShiftNotify, type ShiftPublish, type ShiftRow } from '../shift-logs/shift-logs.types';
import { randomUUID } from 'node:crypto';
import { checkOutOpensAt, checkOutProblem } from './check-out.policy';
import type { CheckOutInput, CheckOutProblem } from './check-out.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOUR_MS = 3_600_000;

const PROBLEMS: Record<CheckOutProblem, { status: number; message: string }> = {
  NOT_ASSIGNED_NURSE: { status: 403, message: 'Only the nurse assigned to this booking can check out' },
  NOT_CHECKED_IN: { status: 409, message: 'Check in first' },
  ALREADY_CHECKED_OUT: { status: 409, message: 'This shift is already checked out' },
  SHIFT_NOT_IN_PROGRESS: { status: 409, message: 'This shift is not running' },
  SHIFT_NOT_FINISHED: { status: 409, message: 'The scheduled end of this shift has not come yet' },
};

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

export interface CheckOutDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  shifts: Pick<ShiftLogsService, 'stateOf'>;
  notify?: ShiftNotify;
  publish?: ShiftPublish;
  now?: () => number;
}

export class CheckOutService {
  constructor(private readonly deps: CheckOutDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private assertAllowed(row: ShiftRow | null, nurseId: string, tolerance: number): ShiftRow {
    if (!row) throw notFoundBooking();
    const endMs = new Date(row.end_time).getTime();
    const problem = checkOutProblem(
      { nurseId: row.nurse_id, executionStatus: row.execution_status, serviceType: row.service_type, endMs },
      nurseId,
      this.nowMs(),
      tolerance,
    );
    if (problem) {
      const { status, message } = PROBLEMS[problem];
      const details =
        problem === 'SHIFT_NOT_FINISHED'
          ? { opensAt: new Date(checkOutOpensAt(row.service_type, endMs, tolerance)!).toISOString(), scheduledEndAt: new Date(endMs).toISOString() }
          : { executionStatus: row.execution_status };
      throw new AppError(status, problem, message, details);
    }
    return row;
  }

  /** POST /bookings/:id/check-out */
  async checkOut(nurseId: string, bookingId: string, input: CheckOutInput): Promise<ShiftExecutionState> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    const [tolerance, commissionHours] = await Promise.all([
      this.deps.getNumber('CHECKOUT_EARLY_TOLERANCE_MINUTES'),
      this.deps.getNumber('CASH_COMMISSION_DUE_HOURS'),
    ]);
    const nowMs = this.nowMs();
    const now = new Date(nowMs);

    await this.deps.withTx(async (db) => {
      const row = this.assertAllowed(await shiftRepo.lockShift(db, bookingId), nurseId, tolerance);
      if (measuredAtProblem(input.finalVitals.timestamp, new Date(row.checkin_time!).getTime(), nowMs)) {
        throw badRequest('INVALID_MEASUREMENT_TIME', 'The measurement time must be between the check-in and now');
      }
      // Final vitals + handover note are in the request (schema) → the last checklist item is done with them.
      const merged = completeItems(row.care_activities_log ?? [], [...input.completedActivityIds, CHECKLIST.FINAL_VITALS_HANDOVER], now.toISOString());
      if (merged.unknown.length > 0) {
        throw badRequest('UNKNOWN_ACTIVITY', 'Some activities are not on the checklist of this shift', { unknownActivityIds: merged.unknown });
      }
      const missing = missingMandatory(merged.items);
      if (missing.length > 0) {
        throw badRequest('CARE_REPORT_INCOMPLETE', 'Complete every mandatory care activity before checking out', { missingActivityIds: missing });
      }
      await shiftRepo.expireOpenAdjustments(db, row.id);
      await shiftRepo.finishLog(db, row.id, {
        at: now,
        finalVital: toStoredVital(input.finalVitals, 'FINAL', randomUUID(), nowMs),
        items: merged.items,
        handoverNote: input.handoverNote,
      });
      const commissionDueAt =
        row.payment_method === PaymentMethod.CASH && Number(row.platform_fee) > 0 ? new Date(nowMs + commissionHours * HOUR_MS) : null;
      if (!(await shiftRepo.markCompleted(db, row.id, now, commissionDueAt))) {
        throw new AppError(409, 'SHIFT_NOT_IN_PROGRESS', PROBLEMS.SHIFT_NOT_IN_PROGRESS.message);
      }
    });

    const fresh = (await shiftRepo.findShift(this.deps.read, bookingId))!;
    try {
      this.deps.publish?.(fresh.id, 'CHECKED_OUT', ExecutionStatus.COMPLETED);
    } catch (err) {
      console.warn(`[check-out] publish failed: ${(err as Error).message}`);
    }
    await sendShiftNotices(this.deps.notify, await this.notices(fresh));
    return this.deps.shifts.stateOf(this.deps.read, fresh);
  }

  private async notices(b: ShiftRow): Promise<ShiftNotice[]> {
    const total = Number(b.total_amount);
    const data = { bookingId: b.id, bookingCode: b.booking_code };
    const cash = b.payment_method === PaymentMethod.CASH;
    const cooling = await this.deps.getNumber('SETTLEMENT_COOLING_HOURS');
    const out: ShiftNotice[] = [
      {
        userId: b.customer_id,
        bookingId: b.id,
        type: SHIFT_NOTICE.COMPLETED,
        title: `Ca ${b.booking_code} đã hoàn thành`,
        body: cash
          ? `Điều dưỡng đã kết thúc ca. Vui lòng thanh toán ${vnd(total)} tiền mặt cho điều dưỡng. Bạn có thể đánh giá điều dưỡng và khiếu nại trong ${cooling} giờ.`
          : `Điều dưỡng đã kết thúc ca. Tiền ca được chuyển cho điều dưỡng sau ${cooling} giờ nếu bạn không khiếu nại. Hãy đánh giá điều dưỡng.`,
        data,
      },
    ];
    if (cash && b.commission_due_at && Number(b.platform_fee) > 0) {
      const due = new Date(b.commission_due_at);
      out.push({
        userId: b.nurse_id!,
        bookingId: b.id,
        type: SHIFT_NOTICE.COMMISSION_DUE,
        title: `Nộp phí nền tảng ca ${b.booking_code}`,
        body: `Bạn đã thu ${vnd(total)} tiền mặt. Vui lòng nộp phí nền tảng ${vnd(Number(b.platform_fee))} trước ${due.toISOString()}, quá hạn tài khoản sẽ bị tạm khóa.`,
        data: { ...data, dueAt: due.toISOString() },
      });
    }
    return out;
  }
}

let singleton: CheckOutService | null = null;

export function getCheckOutService(): CheckOutService {
  if (!singleton) {
    const shared = defaultShiftDeps();
    singleton = new CheckOutService({
      read: shared.read,
      withTx: shared.withTx,
      getNumber: getConfigNumber,
      shifts: getShiftLogsService(),
      notify: shared.notify,
      publish: shared.publish,
    });
  }
  return singleton;
}
