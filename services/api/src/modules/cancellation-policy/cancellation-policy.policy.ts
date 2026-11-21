/**
 * cancellation-policy — the SRS §5.2 SLA matrix as ONE pure, data-driven engine (BE-1 / Dev A, Phase 5).
 * No DB, no clock, no config: callers pass the booking facts, "now" and the SlaRules read from system_configs,
 * so each of the 9 scenarios is unit-tested on its own (checklist Phase 5 · BE-1). Nothing here moves money:
 * callers book what the outcome says (refunds, deposit fines, vouchers, bonuses, TrustScore).
 *
 * Δt = hours from the event to the scheduled start.
 *   1 customer, Δt > 12h            100% refund
 *   2 customer, 2h ≤ Δt ≤ 12h        20% fee: 15% nurse, 5% platform, 80% refund
 *   3 customer, Δt < 2h, no check-in 50% fee: 40% nurse, 10% platform, 50% refund
 *   4 customer stops after check-in actual hours (min 1h, task done = 100%), rest refunded, no penalty
 *   5 force majeure (ICU / death)    100% refund; nurse 50,000 travel support if she had set off
 *   6 nurse, Δt > 12h                −5 TrustScore, back to MATCHING
 *   7 nurse, Δt ≤ 12h                20% fine from deposit → Urgent Bonus, −20 TrustScore, back to MATCHING
 *   8 nurse no-show (30 min)         100% refund, 50,000 fine → customer voucher, nurse BANNED
 *   9 payment / matching timeout     100% refund of what was held (booking-expiry does it)
 * Cash bookings: nothing was prepaid, so nothing is refunded and a customer fee is only recorded;
 * nurse fines (rows 7–8) apply in full (SRS §5.2 applicability note).
 */
import { ExecutionStatus, PaymentMethod, PaymentStatus } from '@healthcare-system/shared';
import type { SlaActor, SlaBooking, SlaOutcome, SlaRules, SlaScenario } from './cancellation-policy.types';

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export const SLA_ROWS: Record<SlaScenario, { rowNo: number; actor: SlaActor }> = {
  CUSTOMER_CANCEL_EARLY: { rowNo: 1, actor: 'CUSTOMER' },
  CUSTOMER_CANCEL_NEAR: { rowNo: 2, actor: 'CUSTOMER' },
  CUSTOMER_CANCEL_LATE: { rowNo: 3, actor: 'CUSTOMER' },
  CUSTOMER_STOP_AFTER_CHECKIN: { rowNo: 4, actor: 'CUSTOMER' },
  FORCE_MAJEURE_ICU: { rowNo: 5, actor: 'CUSTOMER' },
  NURSE_CANCEL_EARLY: { rowNo: 6, actor: 'NURSE' },
  NURSE_CANCEL_URGENT: { rowNo: 7, actor: 'NURSE' },
  NURSE_NO_SHOW: { rowNo: 8, actor: 'NURSE' },
  UNMATCHED_EXPIRED: { rowNo: 9, actor: 'SYSTEM' },
};

/** Hours from `nowMs` to the start, 2 decimals (negative once the start has passed). */
export function hoursBeforeStart(startMs: number, nowMs: number): number {
  return Math.round(((startMs - nowMs) / HOUR_MS) * 100) / 100;
}

/** What the platform actually holds for the booking: a prepaid bank transfer in escrow. */
export function amountHeld(b: SlaBooking): number {
  return b.paymentMethod === PaymentMethod.BANK_TRANSFER && b.paymentStatus === PaymentStatus.ESCROW_HELD ? b.totalAmount : 0;
}

const pct = (rate: number) => Math.round(rate * 10000) / 100;

function outcome(scenario: SlaScenario, b: SlaBooking, fields: Partial<SlaOutcome>): SlaOutcome {
  const held = amountHeld(b);
  return {
    scenario,
    ...SLA_ROWS[scenario],
    hoursBeforeStart: null,
    paymentMethod: b.paymentMethod,
    amountPaid: held,
    feePercent: 0,
    refundPercent: held > 0 ? 100 : 0,
    feeAmount: 0,
    feeCollected: false,
    refundAmount: held,
    nurseCompensation: 0,
    platformShare: 0,
    nurseFine: 0,
    urgentBonus: 0,
    voucherAmount: 0,
    travelSupport: 0,
    trustScoreDelta: 0,
    nextStatus: ExecutionStatus.CANCELLED,
    banNurse: false,
    ...fields,
  };
}

/** Rows 2–3: a fee on the booking amount, split nurse / platform; the rest refunded (bank transfer only). */
function feeOutcome(scenario: SlaScenario, b: SlaBooking, hours: number, feeRate: number, nurseRate: number): SlaOutcome {
  const held = amountHeld(b);
  const fee = Math.round(b.totalAmount * feeRate);
  if (held === 0) {
    // Cash (or nothing prepaid): the fee is recorded on the customer, not collected through the platform.
    return outcome(scenario, b, { hoursBeforeStart: hours, feePercent: pct(feeRate), refundPercent: 0, feeAmount: fee });
  }
  const nurse = Math.round(b.totalAmount * nurseRate);
  return outcome(scenario, b, {
    hoursBeforeStart: hours,
    feePercent: pct(feeRate),
    refundPercent: pct(1 - feeRate),
    feeAmount: fee,
    feeCollected: true,
    refundAmount: held - fee,
    nurseCompensation: nurse,
    platformShare: fee - nurse,
  });
}

/**
 * Rows 1–3: the customer cancels before check-in.
 * With no nurse assigned yet (still MATCHING) nobody held the slot, so it is row 1 whatever the time.
 */
export function customerCancel(b: SlaBooking, nowMs: number, r: SlaRules): SlaOutcome {
  const hours = hoursBeforeStart(b.startMs, nowMs);
  if (!b.nurseAssigned || hours > r.customerFreeHours) {
    return outcome('CUSTOMER_CANCEL_EARLY', b, { hoursBeforeStart: hours });
  }
  if (hours >= r.customerLateHours) return feeOutcome('CUSTOMER_CANCEL_NEAR', b, hours, r.nearFeeRate, r.nearNurseRate);
  return feeOutcome('CUSTOMER_CANCEL_LATE', b, hours, r.lateFeeRate, r.lateNurseRate);
}

/**
 * Row 4: the customer ends a running shift early — not a cancellation, no penalty.
 * Paid: the hours worked since check-in (at least minBillableHours), pro rata of the booking amount, never more
 * than the whole; a task-based visit whose checklist is complete is paid in full. The rest is refunded.
 * `nurseCompensation` is the gross amount to settle (settlements applies the usual commission split).
 */
export function customerStopAfterCheckin(
  b: SlaBooking,
  p: { checkinMs: number; stopMs: number; taskCompleted: boolean },
  r: SlaRules,
): SlaOutcome {
  const bookedHours = (b.endMs - b.startMs) / HOUR_MS;
  const worked = Math.max(r.minBillableHours, (p.stopMs - p.checkinMs) / HOUR_MS);
  const share = p.taskCompleted ? 1 : Math.min(1, worked / bookedHours);
  const due = Math.round(b.totalAmount * share);
  const held = amountHeld(b);
  return outcome('CUSTOMER_STOP_AFTER_CHECKIN', b, {
    hoursBeforeStart: hoursBeforeStart(b.startMs, p.stopMs),
    feePercent: 0,
    refundPercent: held > 0 ? pct((held - Math.min(held, due)) / held) : 0,
    feeAmount: due,
    feeCollected: held > 0,
    refundAmount: Math.max(0, held - due),
    nurseCompensation: held > 0 ? Math.min(held, due) : 0,
    nextStatus: ExecutionStatus.COMPLETED,
  });
}

/** Row 5: patient admitted to ICU or deceased (documented): everything refunded; travel support if she set off. */
export function forceMajeure(b: SlaBooking, p: { nowMs: number; nurseDeparted: boolean }, r: SlaRules): SlaOutcome {
  return outcome('FORCE_MAJEURE_ICU', b, {
    hoursBeforeStart: hoursBeforeStart(b.startMs, p.nowMs),
    travelSupport: b.nurseAssigned && p.nurseDeparted ? r.travelSupport : 0,
  });
}

/** Rows 6–7: the assigned nurse cancels. The customer loses nothing: the booking goes back to MATCHING. */
export function nurseCancel(b: SlaBooking, nowMs: number, r: SlaRules): SlaOutcome {
  const hours = hoursBeforeStart(b.startMs, nowMs);
  const keep = { hoursBeforeStart: hours, refundAmount: 0, refundPercent: 0, nextStatus: ExecutionStatus.MATCHING };
  if (hours > r.nurseFreeHours) {
    return outcome('NURSE_CANCEL_EARLY', b, { ...keep, trustScoreDelta: -r.trustPenaltyEarly });
  }
  const fine = Math.round(b.totalAmount * r.nurseLateFineRate);
  return outcome('NURSE_CANCEL_URGENT', b, { ...keep, nurseFine: fine, urgentBonus: fine, trustScoreDelta: -r.trustPenaltyLate });
}

/** Row 8 applies once this is true: grace minutes after the start, no check-in, no replacement. */
export function noShowDue(startMs: number, nowMs: number, r: SlaRules): boolean {
  return nowMs >= startMs + r.noShowGraceMinutes * MINUTE_MS;
}

/** Row 8: nurse no-show — full refund, fixed fine turned into the customer's voucher, nurse banned. */
export function nurseNoShow(b: SlaBooking, nowMs: number, r: SlaRules): SlaOutcome {
  return outcome('NURSE_NO_SHOW', b, {
    hoursBeforeStart: hoursBeforeStart(b.startMs, nowMs),
    nurseFine: r.noShowPenalty,
    voucherAmount: r.noShowPenalty,
    banNurse: true,
  });
}

/** Row 9: payment or matching timeout — whatever was held goes back (implemented by booking-expiry, BE-3). */
export function expired(b: SlaBooking, nowMs: number): SlaOutcome {
  return outcome('UNMATCHED_EXPIRED', b, { hoursBeforeStart: hoursBeforeStart(b.startMs, nowMs), nextStatus: ExecutionStatus.EXPIRED });
}
