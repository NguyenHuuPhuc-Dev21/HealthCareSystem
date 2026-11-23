/**
 * cancellation-policy — the customer side of the SRS §5.2 matrix (BE-1 / Dev A, Phase 5).
 * Traceability: SRS §5.2 rows 1–3 · BR-18 §2.1 · BR-04 · FR-PAY-02 · SEC-05 (amounts are computed by the server only)
 *
 *  GET  /bookings/:id/cancel-preview   what cancelling now would cost (nothing is stored)
 *  POST /bookings/:id/cancel           cancel; in ONE transaction under the booking lock:
 *        booking → CANCELLED, open offers closed, outcome stored in cancellation_outcomes,
 *        the customer's share refunded from escrow through BE-3's refundEscrow.
 *        Rows 2–3: the nurse and platform shares STAY in escrow (settlement_status PENDING) for settlements (BE-3).
 *  GET  /refunds                       the customer's refunds (patient-web refund tracking)
 *
 * The other rows (4–8) are decided by the same engine (cancellation-policy.policy.ts) and wired by whoever owns
 * the triggering flow (check-out, nurse cancel, no-show job, ICU proof) — see README.
 */
import { ExecutionStatus, PaymentStatus, type SystemConfigKey } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, notFound } from '../../core/errors';
import { refundEscrow } from '../gateway-webhooks/gateway-webhooks.ledger';
import { customerCancel } from './cancellation-policy.policy';
import * as repo from './cancellation-policy.repo';
import type {
  CancelBookingRow,
  CancelNotice,
  CancelPreview,
  RefundRecord,
  RefundScenario,
  SlaBooking,
  SlaOutcome,
  SlaRules,
} from './cancellation-policy.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CANCELLABLE: ReadonlySet<string> = new Set([ExecutionStatus.DRAFT, ExecutionStatus.MATCHING, ExecutionStatus.CONFIRMED]);
const REFUNDS_PAGE = 100;

/** Idempotency key of a customer-cancellation refund — one per booking. */
export const cancelRefundKey = (bookingId: string) => `escrow-refund:cancel:${bookingId}`;

/** Reads every number of the §5.2 matrix from system_configs. */
export async function loadSlaRules(getNumber: (k: SystemConfigKey) => Promise<number> = getConfigNumber): Promise<SlaRules> {
  const keys = [
    'CUSTOMER_CANCEL_FREE_HOURS',
    'CUSTOMER_CANCEL_LATE_HOURS',
    'CUSTOMER_CANCEL_NEAR_FEE_RATE',
    'CUSTOMER_CANCEL_NEAR_NURSE_RATE',
    'CUSTOMER_CANCEL_LATE_FEE_RATE',
    'CUSTOMER_CANCEL_LATE_NURSE_RATE',
    'NURSE_CANCEL_FREE_HOURS',
    'NURSE_LATE_CANCEL_FINE_RATE',
    'NO_SHOW_GRACE_MINUTES',
    'NO_SHOW_PENALTY',
    'ICU_TRAVEL_SUPPORT',
    'TRUST_PENALTY_NURSE_CANCEL_EARLY',
    'TRUST_PENALTY_NURSE_CANCEL_LATE',
    'MIN_BILLABLE_HOURS',
  ] as const;
  const v = await Promise.all(keys.map((k) => getNumber(k)));
  return {
    customerFreeHours: v[0]!,
    customerLateHours: v[1]!,
    nearFeeRate: v[2]!,
    nearNurseRate: v[3]!,
    lateFeeRate: v[4]!,
    lateNurseRate: v[5]!,
    nurseFreeHours: v[6]!,
    nurseLateFineRate: v[7]!,
    noShowGraceMinutes: v[8]!,
    noShowPenalty: v[9]!,
    travelSupport: v[10]!,
    trustPenaltyEarly: v[11]!,
    trustPenaltyLate: v[12]!,
    minBillableHours: v[13]!,
  };
}

/** Booking row → engine facts. */
export function toSlaBooking(b: CancelBookingRow): SlaBooking {
  return {
    startMs: new Date(b.start_time).getTime(),
    endMs: new Date(b.end_time).getTime(),
    paymentMethod: b.payment_method,
    paymentStatus: b.payment_status,
    totalAmount: Number(b.total_amount),
    nurseAssigned: b.nurse_id !== null && (b.execution_status === ExecutionStatus.CONFIRMED || b.execution_status === ExecutionStatus.IN_PROGRESS),
  };
}

export interface CancellationPolicyDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  /** Optional until core/notifications exposes a shared service (same as booking-expiry). */
  notify?: (notice: CancelNotice) => Promise<void>;
  now?: () => number;
}

export interface CancelResult {
  booking: { id: string; code: string; executionStatus: ExecutionStatus; paymentStatus: PaymentStatus };
  outcome: SlaOutcome;
  refund: RefundRecord | null;
}

export class CancellationPolicyService {
  constructor(private readonly deps: CancellationPolicyDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private assertCancellable(b: CancelBookingRow): void {
    if (b.execution_status === ExecutionStatus.IN_PROGRESS) {
      throw new AppError(409, 'SHIFT_IN_PROGRESS', 'The shift has started: ask the nurse to end it early instead (no penalty)');
    }
    if (!CANCELLABLE.has(b.execution_status)) {
      throw new AppError(409, 'BOOKING_NOT_CANCELLABLE', 'This booking can no longer be cancelled', {
        executionStatus: b.execution_status,
      });
    }
  }

  private async owned(db: Queryable, customerId: string, bookingId: string, lock: boolean): Promise<CancelBookingRow> {
    const b = UUID_RE.test(bookingId) ? await (lock ? repo.lockBooking(db, bookingId) : repo.findBooking(db, bookingId)) : null;
    if (!b || b.customer_id !== customerId) throw notFound('BOOKING_NOT_FOUND', 'Booking not found'); // no existence leak
    return b;
  }

  /** GET /bookings/:id/cancel-preview */
  async preview(customerId: string, bookingId: string): Promise<CancelPreview> {
    const b = await this.owned(this.deps.read, customerId, bookingId, false);
    this.assertCancellable(b);
    const o = customerCancel(toSlaBooking(b), this.nowMs(), await loadSlaRules(this.deps.getNumber));
    return {
      bookingId: b.id,
      scenario: o.scenario,
      hoursBeforeStart: o.hoursBeforeStart ?? 0,
      paymentMethod: o.paymentMethod,
      amountPaid: o.amountPaid,
      feePercent: o.feePercent,
      refundPercent: o.refundPercent,
      refundAmount: o.refundAmount,
      nurseCompensation: o.nurseCompensation,
      platformShare: o.platformShare,
      feeAmount: o.feeAmount,
      feeCollected: o.feeCollected,
    };
  }

  /** POST /bookings/:id/cancel */
  async cancel(customerId: string, bookingId: string): Promise<CancelResult> {
    const rules = await loadSlaRules(this.deps.getNumber);
    const nowMs = this.nowMs();
    const now = new Date(nowMs);
    const out = await this.deps.withTx(async (db) => {
      const b = await this.owned(db, customerId, bookingId, true);
      this.assertCancellable(b);
      const o = customerCancel(toSlaBooking(b), nowMs, rules);

      if (!(await repo.markCancelled(db, b.id, customerId, o.scenario, now))) {
        throw new AppError(409, 'BOOKING_NOT_CANCELLABLE', 'This booking can no longer be cancelled');
      }
      let paymentStatus = b.payment_status;
      if (o.refundAmount > 0) {
        await refundEscrow(db, {
          customerId: b.customer_id,
          bookingId: b.id,
          amount: o.refundAmount,
          idempotencyKey: cancelRefundKey(b.id),
          externalRef: null, // simulated escrow (same as booking-expiry)
        });
        // Full refund → REFUNDED. Partial (rows 2–3): the nurse/platform shares are still held → stays ESCROW_HELD.
        if (o.refundAmount === o.amountPaid) {
          await repo.setPaymentStatus(db, b.id, PaymentStatus.REFUNDED);
          paymentStatus = PaymentStatus.REFUNDED;
        }
      }
      await repo.insertOutcome(db, b.id, customerId, o);
      return { b, o, paymentStatus };
    });

    if (out.b.nurse_id && out.o.nurseCompensation > 0) {
      await this.notify(out.b.nurse_id, out.b, `Ca ${out.b.booking_code} đã bị khách hủy`, 'Bạn được đền bù theo chính sách hủy ca. Khoản này sẽ được chuyển vào ví sau khi đối soát.');
    } else if (out.b.nurse_id) {
      await this.notify(out.b.nurse_id, out.b, `Ca ${out.b.booking_code} đã bị khách hủy`, 'Lịch của bạn cho ca này đã được giải phóng.');
    }

    const refund =
      out.o.amountPaid > 0
        ? this.toRecord({
            booking_id: out.b.id,
            booking_code: out.b.booking_code,
            service_name: out.b.service_name,
            execution_status: ExecutionStatus.CANCELLED,
            cancellation_reason: out.o.scenario,
            scenario: out.o.scenario,
            held: out.o.amountPaid,
            refunded: out.o.refundAmount,
            nurse_compensation: out.o.nurseCompensation,
            platform_share: out.o.platformShare,
            voucher_amount: out.o.voucherAmount,
            outcome_at: now,
            refunded_at: out.o.refundAmount > 0 ? now : null,
          })
        : null;
    return {
      booking: { id: out.b.id, code: out.b.booking_code, executionStatus: ExecutionStatus.CANCELLED, paymentStatus: out.paymentStatus },
      outcome: out.o,
      refund,
    };
  }

  /** GET /refunds */
  async listRefunds(customerId: string): Promise<RefundRecord[]> {
    const rows = await repo.listRefunds(this.deps.read, customerId, REFUNDS_PAGE);
    return rows.map((r) => this.toRecord(r));
  }

  private toRecord(r: repo.RefundRow): RefundRecord {
    const held = Number(r.held);
    const refunded = Number(r.refunded);
    const scenario: RefundScenario = (r.scenario as RefundScenario | null) ??
      (r.cancellation_reason === 'INVALID_PRESCRIPTION'
        ? 'INVALID_PRESCRIPTION'
        : r.execution_status === ExecutionStatus.EXPIRED
          ? 'UNMATCHED_EXPIRED'
          : 'OTHER');
    const createdAt = r.outcome_at ?? r.refunded_at ?? new Date(0);
    return {
      refundId: r.booking_id,
      bookingId: r.booking_id,
      bookingCode: r.booking_code,
      serviceLabel: r.service_name,
      scenario,
      amountPaid: held,
      refundAmount: refunded,
      refundPercent: held > 0 ? Math.round((refunded / held) * 10000) / 100 : 0,
      nurseCompensation: Number(r.nurse_compensation ?? 0),
      platformShare: Number(r.platform_share ?? 0),
      voucherAmount: Number(r.voucher_amount ?? 0),
      status: refunded > 0 ? 'REFUNDED' : 'PROCESSING',
      createdAt: new Date(createdAt).toISOString(),
      refundedAt: r.refunded_at ? new Date(r.refunded_at).toISOString() : null,
    };
  }

  private async notify(userId: string, b: CancelBookingRow, title: string, body: string): Promise<void> {
    if (!this.deps.notify) return;
    try {
      await this.deps.notify({ userId, bookingId: b.id, title, body });
    } catch (err) {
      console.warn(`[cancellation-policy] notification for ${b.id} failed: ${(err as Error).message}`);
    }
  }
}

let singleton: CancellationPolicyService | null = null;

export function getCancellationPolicyService(): CancellationPolicyService {
  if (!singleton) {
    singleton = new CancellationPolicyService({
      read: getPool(),
      withTx: (fn) => withTransaction((client) => fn(client)),
      getNumber: getConfigNumber,
    });
  }
  return singleton;
}
