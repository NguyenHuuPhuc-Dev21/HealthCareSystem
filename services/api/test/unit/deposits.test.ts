import { describe, expect, it } from 'vitest';
import {
  addWorkingDays,
  appealError,
  isDepositTopupCode,
  makePaymentCode,
  maskAccount,
  refundEligibility,
  shortfallOf,
  splitTopup,
  topupAmountError,
  vnDateString,
} from '../../src/modules/deposits/deposits.policy';

/** deposits (BE-3 · Phase 5 · ADR-0004): pure rules — no DB, no clock. */
describe('deposits policy', () => {
  const DAY = 86_400_000;
  const NOW = Date.parse('2026-11-27T03:00:00Z'); // Friday 10:00 in Vietnam

  it('payment codes are "KQ" + 12 unambiguous characters and never look like a booking code', () => {
    const code = makePaymentCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 255]));
    expect(code).toMatch(/^KQ[A-Z2-9]{12}$/);
    expect(code.slice(2)).not.toMatch(/[01IO]/);
    expect(isDepositTopupCode(code)).toBe(true);
    expect(isDepositTopupCode('HC-261121-ABC123')).toBe(false);
    expect(isDepositTopupCode('HC-261121-ABC123-GH1')).toBe(false);
    expect(isDepositTopupCode(code.toLowerCase())).toBe(false);
    expect(() => makePaymentCode(new Uint8Array(3))).toThrow();
  });

  it('top-up link: 1 … shortfall; a full deposit takes no top-up', () => {
    expect(shortfallOf(127_500, 300_000)).toBe(172_500);
    expect(shortfallOf(-40_000, 300_000)).toBe(340_000); // debt is part of what is missing
    expect(topupAmountError(172_500, 172_500)).toBeNull();
    expect(topupAmountError(172_501, 172_500)).toBe('TOPUP_EXCEEDS_SHORTFALL');
    expect(topupAmountError(1, 0)).toBe('DEPOSIT_FULL');
  });

  it('payment time: credit only what is still missing (ADR-0004 D2), return the rest', () => {
    expect(splitTopup(200_000, 0, 300_000)).toEqual({ credit: 200_000, returned: 0 });
    expect(splitTopup(200_000, 255_000, 300_000)).toEqual({ credit: 45_000, returned: 155_000 });
    expect(splitTopup(50_000, 300_000, 300_000)).toEqual({ credit: 0, returned: 50_000 });
  });

  it('masks the bank account', () => {
    expect(maskAccount('0071006899')).toBe('•••• 6899');
  });

  describe('refundEligibility (ADR-0004 D3)', () => {
    const none = { activeBookings: 0, lastCheckoutAt: null, openDisputes: 0, unpaidCommissions: 0 };

    it('nothing pending → eligible now', () => {
      expect(refundEligibility(none, 7, NOW)).toEqual({ pendingReasons: [], eligibleAt: null });
      expect(refundEligibility({ ...none, lastCheckoutAt: new Date(NOW - 7 * DAY) }, 7, NOW).pendingReasons).toEqual([]);
    });

    it('lists every pending condition; eligibleAt = last check-out + hold days', () => {
      const out = new Date(NOW - 2 * DAY);
      const r = refundEligibility({ activeBookings: 1, lastCheckoutAt: out, openDisputes: 2, unpaidCommissions: 1 }, 7, NOW);
      expect(r.pendingReasons).toEqual(['ACTIVE_BOOKING', 'HOLD_DAYS', 'OPEN_DISPUTE', 'UNPAID_COMMISSION']);
      expect(r.eligibleAt?.getTime()).toBe(out.getTime() + 7 * DAY);
    });
  });

  describe('addWorkingDays (payout SLA)', () => {
    it('skips the weekend', () => {
      expect(addWorkingDays(NOW, 5, new Set()).toISOString()).toBe('2026-12-04T03:00:00.000Z');
    });
    it('skips public holidays too', () => {
      expect(addWorkingDays(NOW, 5, new Set(['2026-12-02'])).toISOString()).toBe('2026-12-07T03:00:00.000Z');
    });
    it('uses the Vietnam calendar date', () => {
      expect(vnDateString(Date.parse('2026-11-30T17:30:00Z'))).toBe('2026-12-01');
    });
  });

  describe('appealError', () => {
    const open = { appeal_deadline: new Date(NOW + DAY), appeal_dispute_id: null, reversed: false, booking_id: 'b' };
    it('open window → allowed', () => expect(appealError(open, NOW)).toBeNull());
    it('refuses closed, dispute-decided, booking-less, already appealed or reversed penalties', () => {
      expect(appealError({ ...open, appeal_deadline: new Date(NOW) }, NOW)).toBe('APPEAL_WINDOW_CLOSED');
      expect(appealError({ ...open, appeal_deadline: null }, NOW)).toBe('NOT_APPEALABLE');
      expect(appealError({ ...open, booking_id: null }, NOW)).toBe('NOT_APPEALABLE');
      expect(appealError({ ...open, appeal_dispute_id: 'd' }, NOW)).toBe('ALREADY_APPEALED');
      expect(appealError({ ...open, reversed: true }, NOW)).toBe('ALREADY_REVERSED');
    });
  });
});
