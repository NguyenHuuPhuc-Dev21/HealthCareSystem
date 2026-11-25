/**
 * shift-logs — the running shift (BE-2 · Phase 4). Traceability: FR-SHIFT-02 · SRS §4.4 · BR-07 · BR-15 · FR-PRIV-01.
 *
 *  Nurse (assigned, booking IN_PROGRESS):
 *    POST  /bookings/:id/assessment              initial assessment + initial vitals; a condition discrepancy can be
 *                                                reported only in the first CONDITION_MISMATCH_WINDOW_MINUTES:
 *                                                  SURCHARGE → the family is asked for the extra price (pricing-engine)
 *                                                  REFUSE    → the shift is cancelled, no penalty, transfer refunded 100%
 *    POST  /bookings/:id/condition-mismatch/refuse   refuse later (e.g. the family declined the surcharge)
 *    POST  /bookings/:id/vitals                  append a reading (idempotent on the client id: offline queue)
 *    PATCH /bookings/:id/activities/:activityId  tick / untick a care-checklist item
 *    POST  /bookings/:id/notes                   free-text care note
 *    GET   /bookings/:id/shift-state             ShiftExecutionState, inside the medical-record window (BE-3 privacy)
 *    GET   /nurse/shifts?status=                 my shifts
 *  Family (customer of the booking):
 *    GET   /bookings/:id/tracking                BookingTracking (patient-web)
 *    POST  /bookings/:id/condition-surcharge/respond   accept / decline the surcharge
 *          CASH          → in effect at once (added to the bill paid in cash)
 *          BANK_TRANSFER → waits for the transfer to `<code>-PT<n>` (PAYMENT_TIMEOUT_MINUTES);
 *                          gateway-webhooks calls confirmConditionSurchargePayment (escrow hold + amounts)
 *  Every write locks the booking row first, then publishes a WebSocket event after COMMIT (shift-logs.realtime).
 */
import { randomUUID } from 'node:crypto';
import {
  AdjustmentStatus,
  ExecutionStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
  type ConditionSurchargeView,
  type ShiftExecutionState,
  type SystemConfigKey,
} from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, notFound } from '../../core/errors';
import * as storage from '../../core/storage';
import { holdEscrow, ledgerEntryExists, ledgerKeys, refundEscrow } from '../gateway-webhooks/gateway-webhooks.ledger';
import { vietQrImageUrl } from '../gateway-webhooks/gateway-webhooks.policy';
import { receivingAccountFromEnv } from '../gateway-webhooks/gateway-webhooks.service';
import { notifyUser } from '../notifications/notifications.service';
import { assertRecordAccess } from '../privacy-consent/privacy-consent.service';
import { loadRates, quotePrice } from '../pricing-engine/pricing-engine.service';
import { toSnapshot } from '../pricing-engine/pricing-engine.policy';
import type { PricingRates } from '../pricing-engine/pricing-engine.types';
import { getShiftExtendService } from '../shift-extend/shift-extend.service';
import {
  CHECKLIST,
  buildShiftState,
  buildTracking,
  completeItems,
  isBankTransfer,
  measuredAtProblem,
  mismatchWindowOpen,
  setItem,
  surchargeDelta,
  surchargePaymentCode,
  surchargeViewStatus,
  toListItem,
  toStoredVital,
} from './shift-logs.policy';
import { ShiftPublisher } from './shift-logs.realtime';
import * as repo from './shift-logs.repo';
import {
  SHIFT_NOTICE,
  type AssessmentInput,
  type BookingTrackingDto,
  type NurseShiftItem,
  type ShiftListFilter,
  type ShiftNotice,
  type ShiftNotify,
  type ShiftPublish,
  type ShiftRow,
  type SurchargePaymentOutcome,
  type SurchargeRow,
  type VitalsInput,
} from './shift-logs.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

export const notFoundBooking = () => notFound('BOOKING_NOT_FOUND', 'Booking not found');

/** Refund key of a condition-mismatch refusal — one per booking. */
export const refusalRefundKey = (bookingId: string) => `escrow-refund:condition-mismatch:${bookingId}`;

/** The assigned nurse, or 403 NOT_ASSIGNED_NURSE (404 when the booking does not exist). */
export function assertAssignedNurse(row: ShiftRow | null, nurseId: string): ShiftRow {
  if (!row) throw notFoundBooking();
  if (row.nurse_id !== nurseId) throw new AppError(403, 'NOT_ASSIGNED_NURSE', 'Only the nurse assigned to this booking can do this');
  return row;
}

export function assertInProgress(row: ShiftRow): void {
  if (row.execution_status === ExecutionStatus.IN_PROGRESS) return;
  const code = row.execution_status === ExecutionStatus.CONFIRMED ? 'NOT_CHECKED_IN' : 'SHIFT_NOT_IN_PROGRESS';
  throw new AppError(409, code, code === 'NOT_CHECKED_IN' ? 'Check in first' : 'This shift is not running', {
    executionStatus: row.execution_status,
  });
}

/** Sends after COMMIT; a notification failure never fails the request. */
export async function sendShiftNotices(notify: ShiftNotify | undefined, notices: ShiftNotice[]): Promise<void> {
  if (!notify) return;
  for (const n of notices) {
    try {
      await notify(n);
    } catch (err) {
      console.warn(`[shift-logs] ${n.type} to ${n.userId} not sent: ${(err as Error).message}`);
    }
  }
}

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

export interface ShiftLogsDeps {
  /** Pool, for read-only work. */
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  loadRates?: () => Promise<PricingRates>;
  /** Account customers transfer to (VietQR); null when not configured. */
  receivingAccount: () => { bankBin: string; bankName: string; accountNumber: string; accountName: string } | null;
  /** Presigned GET of the check-in selfie (10 min). */
  selfieUrl: (key: string) => Promise<string | null>;
  /** BE-3 privacy: throws 403 RECORD_ACCESS_DENIED outside the window. */
  assertRecordAccess?: (db: Queryable, args: { bookingId: string; nurseId: string }, opts: { now: Date }) => Promise<unknown>;
  /** shift-extend list for the family's tracking view (GET /bookings/:id/extensions shape). */
  listExtensions?: (viewer: { id: string; role: UserRole }, bookingId: string) => Promise<unknown[]>;
  notify?: ShiftNotify;
  publish?: ShiftPublish;
  now?: () => number;
}

export class ShiftLogsService {
  constructor(private readonly deps: ShiftLogsDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private publish(row: { id: string }, change: Parameters<ShiftPublish>[1], status: ExecutionStatus): void {
    try {
      this.deps.publish?.(row.id, change, status);
    } catch (err) {
      console.warn(`[shift-logs] publish failed: ${(err as Error).message}`);
    }
  }

  // ---- reads ------------------------------------------------------------------------------------------

  /** GET /nurse/shifts — upcoming (CONFIRMED), in_progress, completed; no filter = all three. */
  async listMyShifts(nurseId: string, filter?: ShiftListFilter): Promise<NurseShiftItem[]> {
    const statuses =
      filter === 'upcoming'
        ? [ExecutionStatus.CONFIRMED]
        : filter === 'in_progress'
          ? [ExecutionStatus.IN_PROGRESS]
          : filter === 'completed'
            ? [ExecutionStatus.COMPLETED]
            : [ExecutionStatus.CONFIRMED, ExecutionStatus.IN_PROGRESS, ExecutionStatus.COMPLETED];
    const [rows, expiry] = await Promise.all([
      repo.listNurseShifts(this.deps.read, nurseId, statuses, 100),
      this.deps.getNumber('RECORD_ACCESS_EXPIRY_HOURS'),
    ]);
    const nowMs = this.nowMs();
    return rows.map((r) => toListItem(r, nowMs, expiry));
  }

  /** GET /bookings/:id/shift-state — the assigned nurse, inside the medical-record window (FR-PRIV-01). */
  async shiftState(nurseId: string, bookingId: string): Promise<ShiftExecutionState> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    const row = assertAssignedNurse(await repo.findShift(this.deps.read, bookingId), nurseId);
    await (this.deps.assertRecordAccess ?? assertRecordAccess)(this.deps.read, { bookingId, nurseId }, { now: new Date(this.nowMs()) });
    return this.stateOf(this.deps.read, row);
  }

  /** GET /bookings/:id/tracking — the customer who booked (everybody else: 404, no existence leak). */
  async tracking(customerId: string, bookingId: string): Promise<BookingTrackingDto> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    const row = await repo.findShift(this.deps.read, bookingId);
    if (!row || row.customer_id !== customerId) throw notFoundBooking();
    const [selfieUrl, extensions, surcharge] = await Promise.all([
      row.checkin_selfie_url ? this.deps.selfieUrl(row.checkin_selfie_url) : Promise.resolve(null),
      this.deps.listExtensions ? this.deps.listExtensions({ id: customerId, role: UserRole.PATIENT }, bookingId) : Promise.resolve([]),
      repo.latestSurcharge(this.deps.read, bookingId),
    ]);
    return buildTracking(row, {
      nowMs: this.nowMs(),
      selfieUrl,
      extensions,
      surcharge: surcharge ? this.surchargeView(row, surcharge) : null,
    });
  }

  /** ShiftExecutionState of a row (selfie link, surcharge, pending extension, check-out clocks). */
  async stateOf(db: Queryable, row: ShiftRow): Promise<ShiftExecutionState> {
    const [surcharge, ext, selfieUrl, checkout] = await Promise.all([
      repo.latestSurcharge(db, row.id),
      repo.pendingExtension(db, row.id),
      row.checkin_selfie_url ? this.deps.selfieUrl(row.checkin_selfie_url) : Promise.resolve(null),
      this.checkoutSummary(row),
    ]);
    return buildShiftState(row, {
      nowMs: this.nowMs(),
      surcharge: surcharge ? this.surchargeView(row, surcharge) : null,
      pendingExtension: ext,
      selfieUrl,
      checkout,
    });
  }

  /** Clocks started by the check-out (FR-SHIFT-04): settlement / commission, record window, reviews. */
  async checkoutSummary(row: ShiftRow): Promise<ShiftExecutionState['checkout']> {
    if (!row.checkout_time) return null;
    const out = new Date(row.checkout_time).getTime();
    const [cooling, expiry] = await Promise.all([
      this.deps.getNumber('SETTLEMENT_COOLING_HOURS'),
      this.deps.getNumber('RECORD_ACCESS_EXPIRY_HOURS'),
    ]);
    return {
      checkedOutAt: new Date(out).toISOString(),
      settlementEarliestAt: isBankTransfer(row) ? new Date(out + cooling * HOUR_MS).toISOString() : null,
      commissionDueAt: row.commission_due_at ? new Date(row.commission_due_at).toISOString() : null,
      recordAccessUntil: new Date(out + expiry * HOUR_MS).toISOString(),
      reviewOpen: row.execution_status === ExecutionStatus.COMPLETED,
    };
  }

  surchargeView(row: Pick<ShiftRow, 'payment_method' | 'mismatch_reason' | 'initial_assessment'>, s: SurchargeRow): ConditionSurchargeView {
    const status = surchargeViewStatus(s);
    const amount = Number(s.extra_amount);
    const acc = status === 'AWAITING_PAYMENT' && s.payment_code ? this.deps.receivingAccount() : null;
    const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
    return {
      id: s.id,
      status,
      reason: row.mismatch_reason,
      actualMobility: row.initial_assessment?.actualMobility ?? null,
      amount,
      paymentMethod: row.payment_method,
      createdAt: new Date(s.created_at).toISOString(),
      respondedAt: iso(s.responded_at),
      paymentCode: status === 'AWAITING_PAYMENT' ? s.payment_code : null,
      paymentExpiresAt: status === 'AWAITING_PAYMENT' ? iso(s.payment_expires_at) : null,
      bankTransfer: acc
        ? { bankName: acc.bankName, accountNumber: acc.accountNumber, accountName: acc.accountName, transferContent: s.payment_code! }
        : null,
      qrImageUrl: acc ? vietQrImageUrl(acc, amount, s.payment_code!) : null,
    };
  }

  // ---- nurse writes -----------------------------------------------------------------------------------

  /** Runs `fn` on the locked, running shift of this nurse; returns the fresh state after COMMIT. */
  private async onRunningShift(
    nurseId: string,
    bookingId: string,
    fn: (db: Queryable, row: ShiftRow, now: Date) => Promise<{ change: Parameters<ShiftPublish>[1] | null; notices?: ShiftNotice[] }>,
  ): Promise<ShiftExecutionState> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    const now = new Date(this.nowMs());
    const out = await this.deps.withTx(async (db) => {
      const row = assertAssignedNurse(await repo.lockShift(db, bookingId), nurseId);
      assertInProgress(row);
      return fn(db, row, now);
    });
    const fresh = (await repo.findShift(this.deps.read, bookingId))!;
    if (out.change) this.publish(fresh, out.change, fresh.execution_status);
    await sendShiftNotices(this.deps.notify, out.notices ?? []);
    return this.stateOf(this.deps.read, fresh);
  }

  /** POST /bookings/:id/vitals — idempotent on vitals.id (offline queue retries). */
  async addVitals(nurseId: string, bookingId: string, v: VitalsInput): Promise<ShiftExecutionState> {
    return this.onRunningShift(nurseId, bookingId, async (db, row, now) => {
      if (measuredAtProblem(v.timestamp, new Date(row.checkin_time!).getTime(), now.getTime())) {
        throw badRequest('INVALID_MEASUREMENT_TIME', 'The measurement time must be between the check-in and now');
      }
      const id = v.id && UUID_RE.test(v.id) ? v.id.toLowerCase() : randomUUID();
      if ((row.vital_signs_log ?? []).some((x) => x.id === id)) return { change: null }; // already stored
      await repo.appendVital(db, row.id, toStoredVital(v, 'ROUTINE', id, now.getTime()), now);
      return { change: 'VITALS' };
    });
  }

  /** PATCH /bookings/:id/activities/:activityId */
  async setActivity(nurseId: string, bookingId: string, activityId: string, completed: boolean): Promise<ShiftExecutionState> {
    return this.onRunningShift(nurseId, bookingId, async (db, row, now) => {
      const items = setItem(row.care_activities_log ?? [], activityId, completed, now.toISOString());
      if (!items) throw notFound('ACTIVITY_NOT_FOUND', 'This care activity is not on the checklist of the shift');
      await repo.setChecklist(db, row.id, items, now);
      return { change: 'ACTIVITY' };
    });
  }

  /** POST /bookings/:id/notes — idempotent on the client id. */
  async addNote(nurseId: string, bookingId: string, note: { id?: string; text: string }): Promise<ShiftExecutionState> {
    return this.onRunningShift(nurseId, bookingId, async (db, row, now) => {
      const id = note.id && UUID_RE.test(note.id) ? note.id.toLowerCase() : randomUUID();
      if ((row.progress_notes ?? []).some((n) => n.id === id)) return { change: null };
      await repo.appendNote(db, row.id, { id, at: now.toISOString(), text: note.text }, now);
      return { change: 'NOTE' };
    });
  }

  /** POST /bookings/:id/assessment — once per shift. */
  async submitAssessment(nurseId: string, bookingId: string, input: AssessmentInput): Promise<ShiftExecutionState> {
    const windowMinutes = await this.deps.getNumber('CONDITION_MISMATCH_WINDOW_MINUTES');
    return this.onRunningShift(nurseId, bookingId, async (db, row, now) => {
      if (row.assessed_at) throw new AppError(409, 'ASSESSMENT_ALREADY_SUBMITTED', 'The initial assessment of this shift is already stored');
      const checkinMs = new Date(row.checkin_time!).getTime();
      if (measuredAtProblem(input.initialVitals.timestamp, checkinMs, now.getTime())) {
        throw badRequest('INVALID_MEASUREMENT_TIME', 'The measurement time must be between the check-in and now');
      }
      const mismatch = !input.isConditionMatched;
      if (mismatch && !mismatchWindowOpen(checkinMs, now.getTime(), windowMinutes)) {
        throw new AppError(409, 'MISMATCH_WINDOW_CLOSED', 'A condition discrepancy can only be reported at the start of the shift', {
          closedAt: new Date(checkinMs + windowMinutes * MINUTE_MS).toISOString(),
        });
      }
      const action = mismatch ? input.requestedAction! : null;
      await repo.appendVital(db, row.id, toStoredVital(input.initialVitals, 'INITIAL', randomUUID(), now.getTime()), now);
      await repo.setChecklist(db, row.id, completeItems(row.care_activities_log ?? [], [CHECKLIST.INITIAL_VITALS], now.toISOString()).items, now);
      await repo.saveAssessment(db, row.id, {
        assessment: {
          actualMobility: input.actualMobility,
          mentalStatus: input.mentalStatus,
          isConditionMatched: input.isConditionMatched,
          mismatchReason: mismatch ? input.mismatchReason ?? null : null,
          requestedAction: action,
        },
        at: now,
        mismatch,
        reason: mismatch ? input.mismatchReason ?? null : null,
        option: action,
      });

      if (action === 'SURCHARGE') {
        const delta = await this.surchargePrice(db, row, input.actualMobility);
        if (delta.totalAmount <= 0) {
          throw new AppError(409, 'SURCHARGE_NOT_APPLICABLE', 'The real condition does not change the price; you can refuse the shift instead', {
            declaredMobility: row.mobility_status,
            actualMobility: input.actualMobility,
          });
        }
        await repo.insertSurcharge(db, {
          bookingId: row.id,
          nurseId,
          amount: delta.totalAmount,
          base: delta.baseAmount,
          surcharge: delta.surchargeAmount,
          fee: delta.platformFee,
        });
        return {
          change: 'SURCHARGE_REQUESTED',
          notices: [
            {
              userId: row.customer_id,
              bookingId: row.id,
              type: SHIFT_NOTICE.SURCHARGE_REQUEST,
              priority: 'HIGH',
              title: `Ca ${row.booking_code}: tình trạng người bệnh khác khai báo`,
              body: `Điều dưỡng báo: ${input.mismatchReason}. Phụ phí theo tình trạng thực tế là ${vnd(delta.totalAmount)}. Vui lòng đồng ý hoặc từ chối trong ứng dụng.`,
              data: { bookingId: row.id, bookingCode: row.booking_code },
            },
          ],
        };
      }
      if (action === 'REFUSE') {
        const notices = await this.refuseLocked(db, row, nurseId, input.mismatchReason ?? null, now);
        return { change: 'CANCELLED', notices };
      }
      return { change: 'ASSESSMENT' };
    });
  }

  /** POST /bookings/:id/condition-mismatch/refuse — after a discrepancy was reported (e.g. surcharge declined). */
  async refuse(nurseId: string, bookingId: string, reason?: string): Promise<ShiftExecutionState> {
    return this.onRunningShift(nurseId, bookingId, async (db, row, now) => {
      if (!row.condition_mismatch_reported) {
        throw new AppError(409, 'NO_MISMATCH_REPORTED', 'A shift can be refused without penalty only after a condition discrepancy was reported');
      }
      const notices = await this.refuseLocked(db, row, nurseId, reason ?? null, now);
      return { change: 'CANCELLED', notices };
    });
  }

  /**
   * Cancels the running shift for a condition mismatch, under the booking lock. The nurse is never penalised
   * (no deposit deduction, no TrustScore change); the family's prepayment — incl. paid extensions — is refunded 100%.
   */
  private async refuseLocked(db: Queryable, row: ShiftRow, nurseId: string, reason: string | null, now: Date): Promise<ShiftNotice[]> {
    const s = await repo.latestSurcharge(db, row.id);
    if (s && s.applied_at) {
      throw new AppError(409, 'SURCHARGE_IN_EFFECT', 'The family accepted the surcharge; the shift goes on', { surchargeId: s.id });
    }
    await repo.expireOpenAdjustments(db, row.id);
    if (!(await repo.cancelForMismatch(db, row.id, nurseId, now))) {
      throw new AppError(409, 'SHIFT_NOT_IN_PROGRESS', 'This shift is not running');
    }
    await repo.setMismatchOption(db, row.id, 'REFUSE', reason, now);
    let refunded = 0;
    if (isBankTransfer(row)) {
      refunded = await repo.escrowHeld(db, row.id, row.customer_id);
      if (refunded > 0) {
        await refundEscrow(db, {
          customerId: row.customer_id,
          bookingId: row.id,
          amount: refunded,
          idempotencyKey: refusalRefundKey(row.id),
          externalRef: null, // simulated escrow (same as booking-expiry, prescription-rejection)
        });
        await repo.setPaymentStatus(db, row.id, PaymentStatus.REFUNDED);
      }
    }
    return [
      {
        userId: row.customer_id,
        bookingId: row.id,
        type: SHIFT_NOTICE.CANCELLED,
        priority: 'HIGH',
        title: `Ca ${row.booking_code} đã dừng`,
        body:
          `Điều dưỡng không thể tiếp tục vì tình trạng người bệnh khác với khai báo${reason ? ` (${reason})` : ''}.` +
          (refunded > 0 ? ` Số tiền ${vnd(refunded)} đã được hoàn lại 100%.` : ''),
        data: { bookingId: row.id, bookingCode: row.booking_code },
      },
    ];
  }

  /** Extra price if the patient is really `actualMobility`, on the booked window (extensions excluded). */
  private async surchargePrice(db: Queryable, row: ShiftRow, actualMobility: string) {
    const startMs = new Date(row.start_time).getTime();
    const extHours = await repo.appliedExtensionHours(db, row.id);
    const end = new Date(new Date(row.end_time).getTime() - extHours * HOUR_MS);
    const rates = await (this.deps.loadRates ?? loadRates)();
    const weightKg = row.weight_kg === null ? null : Number(row.weight_kg);
    const quote = (mobilityStatus: string) =>
      quotePrice(
        db,
        { service: { unit: row.service_unit as never, basePrice: Number(row.service_base_price) }, patient: { weightKg, mobilityStatus }, start: new Date(startMs), end },
        rates,
      ).then(toSnapshot);
    return surchargeDelta(await quote(row.mobility_status), await quote(actualMobility));
  }

  // ---- family -----------------------------------------------------------------------------------------

  /** POST /bookings/:id/condition-surcharge/respond */
  async respondSurcharge(customerId: string, bookingId: string, approved: boolean): Promise<ConditionSurchargeView> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    const paymentMinutes = await this.deps.getNumber('PAYMENT_TIMEOUT_MINUTES');
    const nowMs = this.nowMs();
    const now = new Date(nowMs);
    const out = await this.deps.withTx(async (db) => {
      const row = await repo.lockShift(db, bookingId);
      if (!row || row.customer_id !== customerId) throw notFoundBooking();
      await repo.expireStaleSurcharges(db, row.id, now);
      const s = await repo.lockOpenSurcharge(db, row.id);
      if (!s) throw notFound('SURCHARGE_NOT_FOUND', 'No surcharge is waiting for your answer');
      if (s.status !== AdjustmentStatus.REQUESTED) {
        throw new AppError(409, 'SURCHARGE_NOT_PENDING', 'This surcharge was already answered', { status: surchargeViewStatus(s) });
      }
      assertInProgress(row);
      if (!approved) {
        await repo.answerSurcharge(db, s.id, { status: 'REJECTED', by: customerId, at: now, applied: false, paymentCode: null, paymentExpiresAt: null });
      } else if (row.payment_method === PaymentMethod.CASH) {
        await repo.answerSurcharge(db, s.id, { status: 'ACCEPTED', by: customerId, at: now, applied: true, paymentCode: null, paymentExpiresAt: null });
        await repo.applySurchargeToBooking(db, row.id, s);
      } else {
        const code = surchargePaymentCode(row.booking_code, await repo.nextSurchargeSeq(db, row.id));
        await repo.answerSurcharge(db, s.id, {
          status: 'ACCEPTED',
          by: customerId,
          at: now,
          applied: false,
          paymentCode: code,
          paymentExpiresAt: new Date(nowMs + paymentMinutes * MINUTE_MS),
        });
      }
      const fresh = (await repo.findShift(db, row.id))!;
      return { row: fresh, s: (await repo.latestSurcharge(db, row.id))! };
    });
    const amount = Number(out.s.extra_amount);
    const body = !approved
      ? 'Gia đình không đồng ý phụ phí. Bạn có thể dừng ca mà không bị phạt.'
      : out.row.payment_method === PaymentMethod.CASH
        ? `Gia đình đồng ý phụ phí ${vnd(amount)} (thu tiền mặt cuối ca). Tiếp tục ca trực.`
        : `Gia đình đồng ý phụ phí ${vnd(amount)} và đang chuyển khoản.`;
    this.publish(out.row, 'SURCHARGE_ANSWERED', out.row.execution_status);
    await sendShiftNotices(this.deps.notify, [
      {
        userId: out.row.nurse_id!,
        bookingId: out.row.id,
        type: SHIFT_NOTICE.SURCHARGE_ANSWERED,
        priority: 'HIGH',
        title: `Ca ${out.row.booking_code}: phụ phí ${approved ? 'được đồng ý' : 'bị từ chối'}`,
        body,
        data: { bookingId: out.row.id, bookingCode: out.row.booking_code },
      },
    ]);
    return this.surchargeView(out.row, out.s);
  }

  /** Dev / demo only (PAYMENT_SIMULATOR_ENABLED): pays the surcharge through the same function as the webhook. */
  async simulateSurchargePayment(customerId: string, bookingId: string): Promise<{ outcome: SurchargePaymentOutcome }> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    const row = await repo.findShift(this.deps.read, bookingId);
    if (!row || row.customer_id !== customerId) throw notFoundBooking();
    const s = await repo.latestSurcharge(this.deps.read, bookingId);
    if (!s || !s.payment_code) throw notFound('SURCHARGE_NOT_FOUND', 'No surcharge transfer is expected');
    const nowMs = this.nowMs();
    const outcome = await this.deps.withTx(async (db) =>
      (await confirmConditionSurchargePayment(db, { paymentCode: s.payment_code!, amount: Number(s.extra_amount), providerRef: `SIM-${s.payment_code}-${nowMs}` }, nowMs)).outcome,
    );
    if (outcome === 'SURCHARGE_PAID') this.publish(row, 'SURCHARGE_PAID', row.execution_status);
    return { outcome };
  }
}

/**
 * For gateway-webhooks (BE-3): a verified, successful transfer whose orderCode is a condition-surcharge code
 * (`isConditionSurchargePaymentCode`). Call it INSIDE the webhook transaction. Idempotent on `providerRef`.
 *
 *  SURCHARGE_PAID         held in the customer's escrow, surcharge in effect (booking amounts increased)
 *  DUPLICATE              this reference was already booked — nothing happens
 *  UNKNOWN_SURCHARGE      no surcharge has this code — nothing moves (Admin reconciles)
 *  AMOUNT_MISMATCH        amount ≠ the surcharge — nothing moves (Admin reconciles)
 *  LATE_PAYMENT_REFUNDED  the surcharge can no longer be used (expired, shift over or cancelled): held and refunded 100%
 */
export async function confirmConditionSurchargePayment(
  db: Queryable,
  p: { paymentCode: string; amount: number; providerRef: string },
  nowMs: number,
): Promise<{ outcome: SurchargePaymentOutcome; bookingId: string | null }> {
  const bookingId = await repo.findBookingIdBySurchargeCode(db, p.paymentCode);
  if (!bookingId) return { outcome: 'UNKNOWN_SURCHARGE', bookingId: null };
  const b = await repo.lockShift(db, bookingId);
  if (!b) return { outcome: 'UNKNOWN_SURCHARGE', bookingId: null };
  if (await ledgerEntryExists(db, ledgerKeys.hold(p.providerRef))) return { outcome: 'DUPLICATE', bookingId };

  const now = new Date(nowMs);
  await repo.expireStaleSurcharges(db, b.id, now);
  const s = await repo.lockSurchargeByCode(db, p.paymentCode);
  if (!s) return { outcome: 'UNKNOWN_SURCHARGE', bookingId };
  if (p.amount !== Number(s.extra_amount)) return { outcome: 'AMOUNT_MISMATCH', bookingId };

  const move = { customerId: b.customer_id, bookingId: b.id, amount: p.amount, externalRef: p.providerRef };
  await holdEscrow(db, { ...move, idempotencyKey: ledgerKeys.hold(p.providerRef) });
  const usable = s.status === AdjustmentStatus.ACCEPTED && s.applied_at === null && b.execution_status === ExecutionStatus.IN_PROGRESS;
  if (usable) {
    await repo.applySurchargeToBooking(db, b.id, s);
    await repo.markSurchargePaid(db, s.id, p.providerRef, now);
    return { outcome: 'SURCHARGE_PAID', bookingId };
  }
  await refundEscrow(db, { ...move, idempotencyKey: ledgerKeys.refundPayment(p.providerRef), externalRef: null });
  return { outcome: 'LATE_PAYMENT_REFUNDED', bookingId };
}

let singleton: ShiftLogsService | null = null;
let publisher: ShiftPublisher | null = null;

export function getShiftPublisher(): ShiftPublisher {
  if (!publisher) publisher = new ShiftPublisher();
  return publisher;
}

/** Wiring shared by the three shift modules (selfie link, notifications, realtime). */
export function defaultShiftDeps() {
  const notify: ShiftNotify = (n) =>
    notifyUser({ userId: n.userId, bookingId: n.bookingId, type: n.type, title: n.title, body: n.body, priority: n.priority as never, data: n.data });
  return {
    read: getPool() as Queryable,
    withTx: <T>(fn: (db: Queryable) => Promise<T>) => withTransaction(fn),
    getNumber: getConfigNumber,
    selfieUrl: async (key: string) => {
      try {
        return (await storage.createDownloadUrl(key)).url;
      } catch (err) {
        console.warn(`[shift-logs] selfie link failed: ${(err as Error).message}`);
        return null;
      }
    },
    notify,
    publish: getShiftPublisher().publish,
  };
}

export function getShiftLogsService(): ShiftLogsService {
  if (!singleton) {
    singleton = new ShiftLogsService({
      ...defaultShiftDeps(),
      receivingAccount: () => receivingAccountFromEnv(),
      listExtensions: (viewer, bookingId) => getShiftExtendService().list(viewer, bookingId),
    });
  }
  return singleton;
}
