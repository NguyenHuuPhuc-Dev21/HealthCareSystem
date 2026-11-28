import { describe, expect, it } from 'vitest';
import { cancellationGross, shiftSettleBlocker, splitSettlement } from '../../src/modules/settlements/settlements.policy';
import type { SettleBookingRow } from '../../src/modules/settlements/settlements.types';

/** settlements (BE-3 · Phase 5 · FR-PAY-02 · ADR-0004 D2): pure rules — no DB, no clock. */
describe('settlements policy', () => {
  const NOW = Date.parse('2026-11-25T03:00:00Z');
  const HOUR = 3_600_000;
  const b: SettleBookingRow = {
    id: 'b',
    booking_code: 'HC-1',
    customer_id: 'c',
    nurse_id: 'n',
    payment_method: 'BANK_TRANSFER',
    payment_status: 'ESCROW_HELD',
    execution_status: 'COMPLETED',
    dispute_status: 'NONE',
    total_amount: 500_000,
    platform_fee: 75_000,
    settled_at: null,
    checkout_time: new Date(NOW - 24 * HOUR),
  };

  describe('shiftSettleBlocker', () => {
    it('cooling over, no dispute → settle; one hour short → COOLING; the customer may confirm earlier', () => {
      expect(shiftSettleBlocker(b, 'COOLING_ELAPSED', 24, NOW)).toBeNull();
      const recent = { ...b, checkout_time: new Date(NOW - 23 * HOUR) };
      expect(shiftSettleBlocker(recent, 'COOLING_ELAPSED', 24, NOW)).toBe('COOLING');
      expect(shiftSettleBlocker(recent, 'CUSTOMER_CONFIRMED', 24, NOW)).toBeNull();
    });

    it('an open dispute freezes it; only a dispute resolved for the nurse releases it', () => {
      expect(shiftSettleBlocker({ ...b, dispute_status: 'OPEN' }, 'COOLING_ELAPSED', 24, NOW)).toBe('DISPUTE_OPEN');
      expect(shiftSettleBlocker({ ...b, dispute_status: 'UNDER_REVIEW' }, 'CUSTOMER_CONFIRMED', 24, NOW)).toBe('DISPUTE_OPEN');
      expect(shiftSettleBlocker({ ...b, dispute_status: 'RESOLVED_NURSE' }, 'DISPUTE_RELEASED', 24, NOW)).toBeNull();
      expect(shiftSettleBlocker({ ...b, dispute_status: 'RESOLVED_CUSTOMER' }, 'DISPUTE_RELEASED', 24, NOW)).toBe('DISPUTE_OPEN');
      expect(shiftSettleBlocker(b, 'DISPUTE_RELEASED', 24, NOW)).toBe('DISPUTE_OPEN');
    });

    it('refuses what is not a held, checked-out, completed transfer shift, or already settled', () => {
      expect(shiftSettleBlocker({ ...b, settled_at: new Date(NOW) }, 'COOLING_ELAPSED', 24, NOW)).toBe('ALREADY_SETTLED');
      expect(shiftSettleBlocker({ ...b, payment_method: 'CASH' }, 'COOLING_ELAPSED', 24, NOW)).toBe('NOT_TRANSFER_BOOKING');
      expect(shiftSettleBlocker({ ...b, payment_status: 'REFUNDED' }, 'COOLING_ELAPSED', 24, NOW)).toBe('NOT_HELD');
      expect(shiftSettleBlocker({ ...b, nurse_id: null }, 'COOLING_ELAPSED', 24, NOW)).toBe('NO_NURSE');
      expect(shiftSettleBlocker({ ...b, checkout_time: null }, 'CUSTOMER_CONFIRMED', 24, NOW)).toBe('NOT_CHECKED_OUT');
      expect(shiftSettleBlocker({ ...b, execution_status: 'IN_PROGRESS' }, 'CUSTOMER_CONFIRMED', 24, NOW)).toBe('NOT_COMPLETED');
    });
  });

  describe('splitSettlement — ADR-0004 worked example', () => {
    const shift = (deposit: number) =>
      splitSettlement({ gross: 500_000, commission: 75_000, depositBalance: deposit, minDeposit: 300_000, withholdRate: 0.3, countsAsShift: true });

    it('500,000 shift, empty deposit → 85% net, 30% of it withheld, grace shift', () => {
      expect(shift(0)).toEqual({ gross: 500_000, commission: 75_000, net: 425_000, withheld: 127_500, payout: 297_500, graceShift: true });
    });
    it('third shift withholds only the remaining 45,000', () => {
      expect(shift(255_000)).toMatchObject({ withheld: 45_000, payout: 380_000, graceShift: true });
    });
    it('full deposit → nothing withheld, not a grace shift', () => {
      expect(shift(300_000)).toMatchObject({ withheld: 0, payout: 425_000, graceShift: false });
    });
    it('a debt is part of what is withheld, never more than 30%', () => {
      expect(shift(-200_000)).toMatchObject({ withheld: 127_500, payout: 297_500 });
    });
    it('cancellation shares are not grace shifts', () => {
      expect(splitSettlement({ gross: 100_000, commission: 25_000, depositBalance: 0, minDeposit: 300_000, withholdRate: 0.3, countsAsShift: false })).toMatchObject({
        net: 75_000,
        withheld: 22_500,
        graceShift: false,
      });
    });
    it('never splits more than the gross', () => {
      expect(() => splitSettlement({ gross: 10, commission: 11, depositBalance: 0, minDeposit: 1, withholdRate: 0.3, countsAsShift: true })).toThrow();
    });
  });

  it('cancellation shares: rows 2–3 are already split; row 4 pays the usual commission on the hours worked', () => {
    expect(cancellationGross({ scenario: 'CUSTOMER_CANCEL_NEAR', nurse_compensation: 75_000, platform_share: 25_000, settlement_status: 'PENDING' }, 0.15)).toEqual({
      gross: 100_000,
      commission: 25_000,
    });
    expect(cancellationGross({ scenario: 'CUSTOMER_STOP_AFTER_CHECKIN', nurse_compensation: '200000', platform_share: 0, settlement_status: 'PENDING' }, 0.15)).toEqual({
      gross: 200_000,
      commission: 30_000,
    });
  });
});
