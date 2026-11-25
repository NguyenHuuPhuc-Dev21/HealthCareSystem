import { describe, expect, it } from 'vitest';
import { MatchingMode, NurseTier, ProfileStatus, ServiceUnit, UserStatus } from '@healthcare-system/shared';
import { buildBookingCode, prescriptionProblem, slotProblem } from '../../src/modules/bookings/bookings.policy';
import { createBookingSchema, quoteSchema } from '../../src/modules/bookings/bookings.schema';
import {
  boundingBox,
  distanceKm,
  eligibilityBlocker,
  needsTier2,
  routeMatchingMode,
  waveRadiusKm,
} from '../../src/modules/matching-radar/matching-radar.policy';
import type { NurseGateRow } from '../../src/modules/matching-radar/matching-radar.types';

/**
 * bookings + matching-radar policies — FR-BOOK-01/02/03, BR-03 §2.1/2.4, BR-08 §2.3. Pure rules only.
 */

const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
const NOW = vn('2026-11-16', '09:00').getTime();
const TODAY = '2026-11-16';
const PROFILE = '33333333-3333-4333-8333-333333333333';

describe('slot rules', () => {
  const slot = (unit: ServiceUnit, from: string, toDate: string, to: string) => slotProblem(unit, vn(TODAY, from), vn(toDate, to), NOW);

  it('shifts last exactly 4, 8, 12 or 24 hours', () => {
    expect(slot(ServiceUnit.PER_SHIFT, '10:00', TODAY, '14:00')).toBeNull();
    expect(slot(ServiceUnit.PER_HOUR, '10:00', TODAY, '18:00')).toBeNull();
    expect(slot(ServiceUnit.PER_HOUR, '10:00', TODAY, '22:00')).toBeNull();
    expect(slot(ServiceUnit.PER_SHIFT, '10:00', '2026-11-17', '10:00')).toBeNull();
    expect(slot(ServiceUnit.PER_SHIFT, '10:00', TODAY, '15:00')).toBe('INVALID_DURATION');
    expect(slot(ServiceUnit.PER_HOUR, '10:00', TODAY, '12:30')).toBe('INVALID_DURATION');
  });

  it('a task-based visit lasts at most 4 hours', () => {
    expect(slot(ServiceUnit.PER_TIME, '10:00', TODAY, '11:00')).toBeNull();
    expect(slot(ServiceUnit.PER_TIME, '10:00', TODAY, '14:00')).toBeNull();
    expect(slot(ServiceUnit.PER_TIME, '10:00', TODAY, '14:01')).toBe('INVALID_DURATION');
  });

  it('must start in the future and end after it starts', () => {
    expect(slot(ServiceUnit.PER_TIME, '09:00', TODAY, '10:00')).toBe('START_IN_PAST');
    expect(slot(ServiceUnit.PER_TIME, '08:00', TODAY, '09:30')).toBe('START_IN_PAST');
    expect(slot(ServiceUnit.PER_TIME, '10:00', TODAY, '10:00')).toBe('END_BEFORE_START');
  });
});

describe('prescription gate layer 1 (FR-BOOK-02)', () => {
  const rx = (issuedDate: string) => ({ imageKey: 'prescription/u/abc.jpg', issuedDate });

  it('non-invasive services need none', () => {
    expect(prescriptionProblem(false, undefined, TODAY)).toBeNull();
  });

  it('invasive services need one, issued within the last 7 days', () => {
    expect(prescriptionProblem(true, undefined, TODAY)).toBe('PRESCRIPTION_REQUIRED');
    expect(prescriptionProblem(true, rx(TODAY), TODAY)).toBeNull();
    expect(prescriptionProblem(true, rx('2026-11-09'), TODAY)).toBeNull(); // exactly 7 days
    expect(prescriptionProblem(true, rx('2026-11-08'), TODAY)).toBe('PRESCRIPTION_EXPIRED'); // 8 days
    expect(prescriptionProblem(true, rx('2026-11-17'), TODAY)).toBe('PRESCRIPTION_DATE_IN_FUTURE');
  });
});

describe('schema — the client never sends amounts or status', () => {
  const body = { serviceCode: 'SRV_WOUND_CARE', patientProfileId: PROFILE, startAt: '2026-11-16T03:00:00.000Z', endAt: '2026-11-16T04:00:00.000Z' };

  it('accepts the FE payloads', () => {
    expect(quoteSchema.safeParse(body).success).toBe(true);
    expect(createBookingSchema.safeParse({ ...body, paymentMethod: 'CASH' }).success).toBe(true);
    expect(
      createBookingSchema.safeParse({
        ...body,
        paymentMethod: 'BANK_TRANSFER',
        prescription: { imageKey: 'prescription/user/file-123.jpg', issuedDate: '2026-11-15' },
        invitedNurseId: PROFILE,
      }).success,
    ).toBe(true);
  });

  it.each([
    ['an amount', { totalAmount: 1 }],
    ['a status', { executionStatus: 'CONFIRMED' }],
    ['a customer id', { customerId: PROFILE }],
    ['a bad payment method', { paymentMethod: 'CARD' }],
    ['a bad date', { startAt: 'tomorrow' }],
  ])('rejects %s', (_label: unknown, extra: unknown) => {
    expect(createBookingSchema.safeParse({ ...body, paymentMethod: 'CASH', ...(extra as object) }).success).toBe(false);
  });
});

describe('booking code', () => {
  it('HC-YYMMDD-XXXXXX without ambiguous characters', () => {
    const code = buildBookingCode(TODAY, new Uint8Array([0, 1, 2, 250, 251, 255]));
    expect(code).toMatch(/^HC-261116-[2-9A-HJ-NP-Z]{6}$/);
  });
});

describe('matching route (FR-BOOK-03)', () => {
  it('start within 6 h → Radar; later → Job Board', () => {
    expect(routeMatchingMode(vn(TODAY, '15:00'), NOW, 6)).toBe(MatchingMode.RADAR_DISPATCH); // exactly 6 h
    expect(routeMatchingMode(vn(TODAY, '15:01'), NOW, 6)).toBe(MatchingMode.JOB_BOARD);
    expect(routeMatchingMode(vn(TODAY, '09:30'), NOW, 6)).toBe(MatchingMode.RADAR_DISPATCH);
  });

  it('wave radius', () => {
    expect(waveRadiusKm(1, 5, 10)).toBe(5);
    expect(waveRadiusKm(2, 5, 10)).toBe(10);
  });
});

describe('eligibility gate re-checked at claim time (BR-08 §2.3, ADR-0004)', () => {
  const nurse = (over: Partial<NurseGateRow> = {}): NurseGateRow => ({
    user_id: 'n',
    user_status: UserStatus.ACTIVE,
    profile_status: ProfileStatus.ACTIVE,
    tier: NurseTier.TIER_2_SPECIALIST,
    gphn_number: 'G-1',
    gphn_expiry_date: '2027-12-31',
    current_lat: '10.7769',
    current_lng: '106.7009',
    deposit_balance: '300000',
    deposit_grace_expires_at: null,
    deposit_grace_shifts_used: 0,
    held_transfer_shifts: '0',
    closure_requested_at: null,
    ...over,
  });
  const RULE = { minDeposit: 300_000, graceMaxShifts: 3 };
  const basic = { is_invasive: false, required_tier: NurseTier.TIER_1_BASIC, payment_method: 'CASH' };
  const basicTransfer = { ...basic, payment_method: 'BANK_TRANSFER' };
  const invasive = { is_invasive: true, required_tier: NurseTier.TIER_2_SPECIALIST, payment_method: 'CASH' };
  const shift = vn('2026-11-16', '14:00');
  const gate = (n: NurseGateRow, b: typeof basic, rule = RULE) => eligibilityBlocker(n, b, shift, rule, NOW);

  it('passes an ACTIVE Tier 2 nurse with a valid GPHN and the full deposit', () => {
    expect(gate(nurse(), invasive)).toBeNull();
  });

  it('PENDING / SUSPENDED profile or account → NURSE_NOT_ACTIVE', () => {
    expect(gate(nurse({ profile_status: ProfileStatus.PENDING_VERIFICATION }), basic)).toBe('NURSE_NOT_ACTIVE');
    expect(gate(nurse({ profile_status: ProfileStatus.SUSPENDED }), basic)).toBe('NURSE_NOT_ACTIVE');
    expect(gate(nurse({ user_status: UserStatus.BANNED }), basic)).toBe('NURSE_NOT_ACTIVE');
  });

  it('a nurse who asked to close the account gets no new jobs → ACCOUNT_CLOSING', () => {
    expect(gate(nurse({ closure_requested_at: new Date(NOW - 1000) }), basic)).toBe('ACCOUNT_CLOSING');
  });

  it('Tier 1 cannot take an invasive service; Tier 1 can take a basic one', () => {
    const t1 = nurse({ tier: NurseTier.TIER_1_BASIC, gphn_number: null, gphn_expiry_date: null });
    expect(gate(t1, invasive)).toBe('TIER_MISMATCH');
    expect(gate(t1, basic)).toBeNull();
    expect(needsTier2({ is_invasive: false, required_tier: NurseTier.TIER_2_SPECIALIST })).toBe(true);
  });

  it('a Tier 2 flag with a GPHN that expires on/before the shift date → TIER_MISMATCH', () => {
    expect(gate(nurse({ gphn_expiry_date: '2026-11-16' }), invasive)).toBe('TIER_MISMATCH');
    expect(gate(nurse({ gphn_expiry_date: '2026-11-17' }), invasive)).toBeNull();
  });

  it('deposit below the minimum and no grace → DEPOSIT_SHORTFALL; a minimum of 0 switches the gate off', () => {
    expect(gate(nurse({ deposit_balance: '299999' }), basic)).toBe('DEPOSIT_SHORTFALL');
    expect(gate(nurse({ deposit_balance: '299999' }), basicTransfer)).toBe('DEPOSIT_SHORTFALL');
    expect(gate(nurse({ deposit_balance: 0 }), basic, { minDeposit: 0, graceMaxShifts: 3 })).toBeNull();
  });

  describe('grace period (ADR-0004 D2)', () => {
    const inGrace = (over: Partial<NurseGateRow> = {}) =>
      nurse({ deposit_balance: '0', deposit_grace_expires_at: new Date(NOW + 10 * 86_400_000), ...over });

    it('a short deposit is enough for BANK_TRANSFER bookings while grace runs', () => {
      expect(gate(inGrace(), basicTransfer)).toBeNull();
    });

    it('a debt (negative deposit after a penalty) is never covered by grace (BR-04, FR-PAY-03)', () => {
      expect(gate(inGrace({ deposit_balance: '-50000' }), basicTransfer)).toBe('DEPOSIT_SHORTFALL');
      expect(gate(inGrace({ deposit_balance: '-1' }), basicTransfer)).toBe('DEPOSIT_SHORTFALL');
    });

    it('cash bookings always need the full deposit', () => {
      expect(gate(inGrace(), basic)).toBe('DEPOSIT_SHORTFALL');
    });

    it('at most 3 grace shifts: completed + currently held', () => {
      expect(gate(inGrace({ deposit_grace_shifts_used: 2, held_transfer_shifts: '0' }), basicTransfer)).toBeNull();
      expect(gate(inGrace({ deposit_grace_shifts_used: 2, held_transfer_shifts: '1' }), basicTransfer)).toBe('DEPOSIT_SHORTFALL');
      expect(gate(inGrace({ deposit_grace_shifts_used: 0, held_transfer_shifts: '3' }), basicTransfer)).toBe('DEPOSIT_SHORTFALL');
      expect(gate(inGrace({ deposit_grace_shifts_used: 3 }), basicTransfer)).toBe('DEPOSIT_SHORTFALL');
    });

    it('grace ends after its date; no date set means no grace', () => {
      expect(gate(inGrace({ deposit_grace_expires_at: new Date(NOW) }), basicTransfer)).toBe('DEPOSIT_SHORTFALL');
      expect(gate(nurse({ deposit_balance: '0', deposit_grace_expires_at: null }), basicTransfer)).toBe('DEPOSIT_SHORTFALL');
    });

    it('with the full deposit the grace counters do not matter', () => {
      expect(gate(nurse({ deposit_grace_shifts_used: 9, held_transfer_shifts: '9' }), basic)).toBeNull();
    });
  });
});

describe('distance', () => {
  const care = { lat: 10.7769, lng: 106.7009 }; // Bến Thành
  it('Haversine distance from the nurse to the care location', () => {
    expect(distanceKm({ current_lat: '10.7769', current_lng: '106.7009' }, care)).toBe(0);
    const km = distanceKm({ current_lat: '10.8231', current_lng: '106.6297' }, care)!; // Tân Bình
    expect(km).toBeGreaterThan(9);
    expect(km).toBeLessThan(10);
    expect(distanceKm({ current_lat: null, current_lng: null }, care)).toBeNull();
  });

  it('the bounding box contains every point within the radius', () => {
    const box = boundingBox(care.lat, care.lng, 5);
    expect(box.minLat).toBeLessThan(care.lat - 0.04);
    expect(box.maxLng).toBeGreaterThan(care.lng + 0.04);
  });
});
