import { describe, expect, it } from 'vitest';
import { contentTypeOf, counterPartyOf, isParty, openError, rebuttalError } from '../../src/modules/disputes/disputes.policy';
import type { DisputeBookingRow, DisputeRow } from '../../src/modules/disputes/disputes.types';
import { shiftSettleBlocker } from '../../src/modules/settlements/settlements.policy';

/** disputes (BE-3 · Phase 6 · FR-DISP-01): pure rules — no DB, no clock. */
describe('disputes policy', () => {
  const NOW = Date.parse('2026-11-25T03:00:00Z');
  const H = 3_600_000;
  const b: DisputeBookingRow = {
    id: 'b',
    booking_code: 'HC-1',
    customer_id: 'cust',
    nurse_id: 'nurse',
    payment_method: 'BANK_TRANSFER',
    payment_status: 'ESCROW_HELD',
    execution_status: 'COMPLETED',
    dispute_status: 'NONE',
    settled_at: null,
    checkout_time: new Date(NOW - 23 * H),
  };

  describe('openError', () => {
    it('either party, during the shift or within the window after check-out', () => {
      expect(openError(b, 'cust', 24, NOW)).toBeNull();
      expect(openError(b, 'nurse', 24, NOW)).toBeNull();
      expect(openError({ ...b, execution_status: 'IN_PROGRESS', checkout_time: null }, 'nurse', 24, NOW)).toBeNull();
    });
    it('refuses outsiders, a second dispute, a closed window, settled or not-started bookings', () => {
      expect(openError(b, 'someone', 24, NOW)).toBe('NOT_A_PARTY');
      expect(openError({ ...b, dispute_status: 'OPEN' }, 'cust', 24, NOW)).toBe('DISPUTE_EXISTS');
      expect(openError({ ...b, checkout_time: new Date(NOW - 25 * H) }, 'cust', 24, NOW)).toBe('DISPUTE_WINDOW_CLOSED');
      expect(openError({ ...b, settled_at: new Date(NOW) }, 'cust', 24, NOW)).toBe('DISPUTE_WINDOW_CLOSED');
      expect(openError({ ...b, execution_status: 'CONFIRMED' }, 'cust', 24, NOW)).toBe('NOT_DISPUTABLE');
    });
  });

  describe('rebuttal', () => {
    const d = {
      customer_id: 'cust',
      nurse_id: 'nurse',
      raised_by_id: 'cust',
      status: 'OPEN',
      rebuttal_at: null,
      rebuttal_due_at: new Date(NOW + H),
    } as unknown as DisputeRow;

    it('the counter-party is the other side of the booking', () => {
      expect(counterPartyOf(d)).toBe('nurse');
      expect(counterPartyOf({ ...d, raised_by_id: 'nurse' })).toBe('cust');
      expect(isParty(d, 'nurse')).toBe(true);
      expect(isParty(d, 'x')).toBe(false);
    });

    it('once, by the counter-party, while open and before the deadline', () => {
      expect(rebuttalError(d, 'nurse', NOW)).toBeNull();
      expect(rebuttalError(d, 'cust', NOW)).toBe('NOT_COUNTER_PARTY');
      expect(rebuttalError({ ...d, rebuttal_at: new Date(NOW) }, 'nurse', NOW)).toBe('ALREADY_SUBMITTED');
      expect(rebuttalError({ ...d, status: 'RESOLVED_NURSE' }, 'nurse', NOW)).toBe('NOT_OPEN');
      expect(rebuttalError(d, 'nurse', NOW + 2 * H)).toBe('REBUTTAL_WINDOW_CLOSED');
    });
  });

  it('evidence: images and PDF only (what core/storage accepts)', () => {
    expect(contentTypeOf('vet-thuong.JPG')).toBe('image/jpeg');
    expect(contentTypeOf('a.png')).toBe('image/png');
    expect(contentTypeOf('don.pdf')).toBe('application/pdf');
    expect(contentTypeOf('clip.mp4')).toBeNull();
    expect(contentTypeOf('noext')).toBeNull();
  });

  it('settlements: a dispute resolved for the nurse no longer blocks the normal settlement', () => {
    const s = {
      id: 'b', booking_code: 'HC-1', customer_id: 'c', nurse_id: 'n', payment_method: 'BANK_TRANSFER', payment_status: 'ESCROW_HELD',
      execution_status: 'COMPLETED', dispute_status: 'RESOLVED_NURSE', total_amount: 1, platform_fee: 0, settled_at: null,
      checkout_time: new Date(NOW - 25 * H),
    };
    expect(shiftSettleBlocker(s, 'COOLING_ELAPSED', 24, NOW)).toBeNull();
    expect(shiftSettleBlocker({ ...s, dispute_status: 'RESOLVED_CUSTOMER' }, 'COOLING_ELAPSED', 24, NOW)).toBe('DISPUTE_OPEN');
  });
});
