import { describe, expect, it } from 'vitest';
import { ExecutionStatus, PaymentMethod, PaymentStatus, type SystemConfigKey } from '@healthcare-system/shared';
import {
  SLA_ROWS,
  amountHeld,
  customerCancel,
  customerStopAfterCheckin,
  expired,
  forceMajeure,
  hoursBeforeStart,
  noShowDue,
  nurseCancel,
  nurseNoShow,
} from '../../src/modules/cancellation-policy/cancellation-policy.policy';
import { loadSlaRules } from '../../src/modules/cancellation-policy/cancellation-policy.service';
import type { SlaBooking, SlaRules } from '../../src/modules/cancellation-policy/cancellation-policy.types';

/**
 * cancellation-policy — the SRS §5.2 matrix, one describe per scenario (checklist Phase 5 · BE-1).
 * Values = SRS v2.0 §5.2 (migration 0014). Booking: 4-hour shift, 400,000 VND.
 */
const HOUR = 3_600_000;
const MIN = 60_000;
const START = Date.parse('2027-03-01T02:00:00Z');
const END = START + 4 * HOUR;

const RULES: SlaRules = {
  customerFreeHours: 12,
  customerLateHours: 2,
  nearFeeRate: 0.2,
  nearNurseRate: 0.15,
  lateFeeRate: 0.5,
  lateNurseRate: 0.4,
  nurseFreeHours: 12,
  nurseLateFineRate: 0.2,
  noShowGraceMinutes: 30,
  noShowPenalty: 50_000,
  travelSupport: 50_000,
  trustPenaltyEarly: 5,
  trustPenaltyLate: 20,
  minBillableHours: 1,
};

const bank = (over: Partial<SlaBooking> = {}): SlaBooking => ({
  startMs: START,
  endMs: END,
  paymentMethod: PaymentMethod.BANK_TRANSFER,
  paymentStatus: PaymentStatus.ESCROW_HELD,
  totalAmount: 400_000,
  nurseAssigned: true,
  ...over,
});
const cash = (over: Partial<SlaBooking> = {}) => bank({ paymentMethod: PaymentMethod.CASH, paymentStatus: PaymentStatus.UNPAID, ...over });
const before = (hours: number) => START - hours * HOUR;

describe('helpers', () => {
  it('every scenario has its row number and actor', () => {
    expect(Object.values(SLA_ROWS).map((r) => r.rowNo).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it('only a prepaid bank transfer is held', () => {
    expect(amountHeld(bank())).toBe(400_000);
    expect(amountHeld(cash())).toBe(0);
    expect(amountHeld(bank({ paymentStatus: PaymentStatus.UNPAID }))).toBe(0);
  });
  it('hoursBeforeStart is signed and rounded to 2 decimals', () => {
    expect(hoursBeforeStart(START, before(12.5))).toBe(12.5);
    expect(hoursBeforeStart(START, START + 20 * MIN)).toBe(-0.33);
  });
  it('loadSlaRules reads every key from system_configs', async () => {
    const asked: string[] = [];
    const r = await loadSlaRules(async (k: SystemConfigKey) => {
      asked.push(k);
      return 7;
    });
    expect(asked).toHaveLength(14);
    expect(Object.values(r).every((v) => v === 7)).toBe(true);
  });
});

describe('row 1 — customer cancels more than 12h ahead', () => {
  it('bank transfer: 100% refund, no fee', () => {
    expect(customerCancel(bank(), before(12.01), RULES)).toMatchObject({
      scenario: 'CUSTOMER_CANCEL_EARLY',
      rowNo: 1,
      refundAmount: 400_000,
      refundPercent: 100,
      feeAmount: 0,
      nurseCompensation: 0,
      platformShare: 0,
      nextStatus: ExecutionStatus.CANCELLED,
    });
  });
  it('no nurse assigned yet: row 1 whatever the time', () => {
    expect(customerCancel(bank({ nurseAssigned: false }), before(0.5), RULES).scenario).toBe('CUSTOMER_CANCEL_EARLY');
  });
  it('cash: nothing to refund', () => {
    expect(customerCancel(cash(), before(20), RULES)).toMatchObject({ refundAmount: 0, refundPercent: 0, feeAmount: 0 });
  });
});

describe('row 2 — customer cancels 2–12h ahead', () => {
  it('20% fee: 15% nurse, 5% platform, 80% refund — boundaries 12h and 2h included', () => {
    for (const h of [12, 5, 2]) {
      expect(customerCancel(bank(), before(h), RULES)).toMatchObject({
        scenario: 'CUSTOMER_CANCEL_NEAR',
        rowNo: 2,
        feePercent: 20,
        refundPercent: 80,
        feeAmount: 80_000,
        feeCollected: true,
        refundAmount: 320_000,
        nurseCompensation: 60_000,
        platformShare: 20_000,
      });
    }
  });
  it('cash: the fee is recorded, not collected', () => {
    expect(customerCancel(cash(), before(5), RULES)).toMatchObject({
      scenario: 'CUSTOMER_CANCEL_NEAR',
      feeAmount: 80_000,
      feeCollected: false,
      refundAmount: 0,
      nurseCompensation: 0,
      platformShare: 0,
    });
  });
});

describe('row 3 — customer cancels less than 2h ahead (no check-in)', () => {
  it('50% fee: 40% nurse, 10% platform, 50% refund', () => {
    expect(customerCancel(bank(), before(1.99), RULES)).toMatchObject({
      scenario: 'CUSTOMER_CANCEL_LATE',
      rowNo: 3,
      feePercent: 50,
      refundPercent: 50,
      refundAmount: 200_000,
      nurseCompensation: 160_000,
      platformShare: 40_000,
    });
  });
  it('also after the start while the nurse has not checked in', () => {
    expect(customerCancel(bank(), START + 10 * MIN, RULES).scenario).toBe('CUSTOMER_CANCEL_LATE');
  });
  it('the three shares always add up to what was paid (odd amounts)', () => {
    const o = customerCancel(bank({ totalAmount: 333_333 }), before(1), RULES);
    expect(o.refundAmount + o.nurseCompensation + o.platformShare).toBe(333_333);
  });
});

describe('row 4 — customer stops after check-in', () => {
  it('pays the hours worked pro rata and refunds the rest, no penalty', () => {
    const o = customerStopAfterCheckin(bank(), { checkinMs: START, stopMs: START + 2 * HOUR, taskCompleted: false }, RULES);
    expect(o).toMatchObject({
      scenario: 'CUSTOMER_STOP_AFTER_CHECKIN',
      rowNo: 4,
      feeAmount: 200_000,
      nurseCompensation: 200_000,
      refundAmount: 200_000,
      platformShare: 0,
      nurseFine: 0,
      trustScoreDelta: 0,
      nextStatus: ExecutionStatus.COMPLETED,
    });
  });
  it('at least 1 hour is paid, never more than the whole', () => {
    expect(customerStopAfterCheckin(bank(), { checkinMs: START, stopMs: START + 10 * MIN, taskCompleted: false }, RULES).nurseCompensation).toBe(100_000);
    expect(customerStopAfterCheckin(bank(), { checkinMs: START, stopMs: END + HOUR, taskCompleted: false }, RULES).refundAmount).toBe(0);
  });
  it('a task-based visit with its checklist complete is paid 100%', () => {
    expect(customerStopAfterCheckin(bank(), { checkinMs: START, stopMs: START + HOUR, taskCompleted: true }, RULES).refundAmount).toBe(0);
  });
});

describe('row 5 — medical force majeure (ICU / death)', () => {
  it('100% refund, travel support only if the nurse had set off', () => {
    expect(forceMajeure(bank(), { nowMs: before(1), nurseDeparted: true }, RULES)).toMatchObject({
      scenario: 'FORCE_MAJEURE_ICU',
      rowNo: 5,
      refundAmount: 400_000,
      feeAmount: 0,
      travelSupport: 50_000,
    });
    expect(forceMajeure(bank(), { nowMs: before(1), nurseDeparted: false }, RULES).travelSupport).toBe(0);
    expect(forceMajeure(bank({ nurseAssigned: false }), { nowMs: before(1), nurseDeparted: true }, RULES).travelSupport).toBe(0);
  });
});

describe('row 6 — nurse cancels more than 12h ahead', () => {
  it('−5 TrustScore, no fine, back to MATCHING, the customer keeps the booking', () => {
    expect(nurseCancel(bank(), before(12.5), RULES)).toMatchObject({
      scenario: 'NURSE_CANCEL_EARLY',
      rowNo: 6,
      actor: 'NURSE',
      nurseFine: 0,
      trustScoreDelta: -5,
      refundAmount: 0,
      nextStatus: ExecutionStatus.MATCHING,
    });
  });
});

describe('row 7 — nurse cancels 12h or less ahead', () => {
  it('20% fine from the deposit becomes the Urgent Bonus, −20 TrustScore, back to MATCHING', () => {
    for (const o of [nurseCancel(bank(), before(12), RULES), nurseCancel(cash(), before(1), RULES)]) {
      expect(o).toMatchObject({
        scenario: 'NURSE_CANCEL_URGENT',
        rowNo: 7,
        nurseFine: 80_000,
        urgentBonus: 80_000,
        trustScoreDelta: -20,
        refundAmount: 0,
        nextStatus: ExecutionStatus.MATCHING,
      });
    }
  });
});

describe('row 8 — nurse no-show', () => {
  it('is due 30 minutes after the start', () => {
    expect(noShowDue(START, START + 29 * MIN, RULES)).toBe(false);
    expect(noShowDue(START, START + 30 * MIN, RULES)).toBe(true);
  });
  it('100% refund, 50,000 fine turned into the customer voucher, nurse banned', () => {
    expect(nurseNoShow(bank(), START + 30 * MIN, RULES)).toMatchObject({
      scenario: 'NURSE_NO_SHOW',
      rowNo: 8,
      refundAmount: 400_000,
      nurseFine: 50_000,
      voucherAmount: 50_000,
      banNurse: true,
      nextStatus: ExecutionStatus.CANCELLED,
    });
  });
  it('cash: no refund, the fine and the voucher still apply', () => {
    expect(nurseNoShow(cash(), START + HOUR, RULES)).toMatchObject({ refundAmount: 0, nurseFine: 50_000, voucherAmount: 50_000 });
  });
});

describe('row 9 — payment or matching timeout', () => {
  it('refunds whatever was held, no penalty, EXPIRED', () => {
    expect(expired(bank({ nurseAssigned: false }), before(0.5))).toMatchObject({
      scenario: 'UNMATCHED_EXPIRED',
      rowNo: 9,
      actor: 'SYSTEM',
      refundAmount: 400_000,
      nurseFine: 0,
      nextStatus: ExecutionStatus.EXPIRED,
    });
    expect(expired(bank({ paymentStatus: PaymentStatus.UNPAID }), before(1)).refundAmount).toBe(0);
  });
});
