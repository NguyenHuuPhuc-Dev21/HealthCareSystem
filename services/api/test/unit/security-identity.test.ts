import { describe, expect, it } from 'vitest';
import { NurseTier, PaymentMethod, ProfileStatus, UserStatus } from '@healthcare-system/shared';
import { eligibilityBlocker, needsTier2 } from '../../src/modules/matching-radar/matching-radar.policy';
import type { NurseGateRow } from '../../src/modules/matching-radar/matching-radar.types';
import { eligibleFor } from '../../src/modules/job-board/job-board.policy';
import type { BoardBookingRow } from '../../src/modules/job-board/job-board.types';
import { decideRecordAccess } from '../../src/modules/privacy-consent/privacy-consent.policy';
import type { RecordAccessFacts } from '../../src/modules/privacy-consent/privacy-consent.types';
import { catalogProblem } from '../../src/modules/admin-catalog/admin-catalog.policy';

/**
 * Phase 8 · BE-1 — identity security regression suite (tier-gate bypass, medical-record expiry).
 *
 * Every way a nurse takes work (Radar, Job Board accept, direct invitation) ends in matching-radar
 * claimBooking, which re-checks `eligibilityBlocker` under the row lock; the Job Board list uses the same
 * function through `eligibleFor`. Every read of a medical record goes through privacy-consent
 * `assertRecordAccess` → `decideRecordAccess`. These tests pin those two decisions against bypass attempts,
 * so a later change that loosens them fails here. (End-to-end paths: bookings-matching / privacy-consent-access.)
 */

const DAY = 86_400_000;
const vn = (date: string, hhmm = '09:00') => new Date(`${date}T${hhmm}:00+07:00`);
const SHIFT = vn('2027-03-10', '08:00');
const NOW = vn('2027-03-09', '20:00').getTime();
const RULE = { minDeposit: 300_000, graceMaxShifts: 3 };

function nurse(over: Partial<NurseGateRow> = {}): NurseGateRow {
  return {
    user_id: 'n1',
    user_status: UserStatus.ACTIVE,
    profile_status: ProfileStatus.ACTIVE,
    tier: NurseTier.TIER_2_SPECIALIST,
    gphn_number: 'GPHN-001',
    gphn_expiry_date: '2028-12-31',
    current_lat: null,
    current_lng: null,
    deposit_balance: 300_000,
    deposit_grace_expires_at: null,
    deposit_grace_shifts_used: 0,
    held_transfer_shifts: 0,
    closure_requested_at: null,
    ...over,
  };
}

const INVASIVE = { is_invasive: true, required_tier: NurseTier.TIER_2_SPECIALIST, payment_method: PaymentMethod.BANK_TRANSFER };
const gate = (n: NurseGateRow, booking = INVASIVE, shift = SHIFT) => eligibilityBlocker(n, booking, shift, RULE, NOW);

describe('security · tier gate cannot be bypassed (unit)', () => {
  it('baseline: an ACTIVE Tier 2 with a valid GPHN may take an invasive shift', () => {
    expect(gate(nurse())).toBeNull();
  });

  it.each([
    ['Tier 1', { tier: NurseTier.TIER_1_BASIC, gphn_number: null, gphn_expiry_date: null }],
    ['Tier 1 that has a GPHN on file (tier column still decides)', { tier: NurseTier.TIER_1_BASIC }],
    ['Tier 2 column but no GPHN number', { gphn_number: null }],
    ['Tier 2 column but no GPHN expiry date', { gphn_expiry_date: null }],
    ['Tier 2 whose GPHN expires ON the shift date', { gphn_expiry_date: '2027-03-10' }],
    ['Tier 2 whose GPHN expired before the shift (valid today, not on the day)', { gphn_expiry_date: '2027-03-09' }],
  ])('%s → TIER_MISMATCH', (_label, over) => {
    expect(gate(nurse(over))).toBe('TIER_MISMATCH');
  });

  it('GPHN valid until the day after the shift is enough (boundary)', () => {
    expect(gate(nurse({ gphn_expiry_date: '2027-03-11' }))).toBeNull();
  });

  it('the shift DATE is judged in Vietnam time (07:00 VN = previous day in UTC)', () => {
    const earlyMorning = vn('2027-03-10', '06:30'); // 2027-03-09T23:30Z
    expect(gate(nurse({ gphn_expiry_date: '2027-03-10' }), INVASIVE, earlyMorning)).toBe('TIER_MISMATCH');
  });

  it('a non-invasive service that still requires Tier 2 is gated the same way', () => {
    const tier2Only = { is_invasive: false, required_tier: NurseTier.TIER_2_SPECIALIST, payment_method: PaymentMethod.CASH };
    expect(needsTier2(tier2Only)).toBe(true);
    expect(gate(nurse({ tier: NurseTier.TIER_1_BASIC }), tier2Only)).toBe('TIER_MISMATCH');
  });

  it('a Tier-1 service is open to Tier 1', () => {
    const basic = { is_invasive: false, required_tier: NurseTier.TIER_1_BASIC, payment_method: PaymentMethod.CASH };
    expect(gate(nurse({ tier: NurseTier.TIER_1_BASIC, gphn_number: null, gphn_expiry_date: null }), basic)).toBeNull();
  });

  it.each([
    ['SUSPENDED profile (e.g. TrustScore < 60)', { profile_status: ProfileStatus.SUSPENDED }],
    ['BANNED profile', { profile_status: ProfileStatus.BANNED }],
    ['profile still PENDING_VERIFICATION', { profile_status: ProfileStatus.PENDING_VERIFICATION }],
    ['user account not ACTIVE', { user_status: 'BANNED' }],
  ])('%s → NURSE_NOT_ACTIVE, even as a valid Tier 2', (_label, over) => {
    expect(gate(nurse(over as Partial<NurseGateRow>))).toBe('NURSE_NOT_ACTIVE');
  });

  it('a closing account takes nothing (ACCOUNT_CLOSING)', () => {
    expect(gate(nurse({ closure_requested_at: new Date(NOW) }))).toBe('ACCOUNT_CLOSING');
  });

  it('status is checked before tier: a suspended Tier 1 is NURSE_NOT_ACTIVE, not just TIER_MISMATCH', () => {
    expect(gate(nurse({ profile_status: ProfileStatus.SUSPENDED, tier: NurseTier.TIER_1_BASIC }))).toBe('NURSE_NOT_ACTIVE');
  });

  it('the Job Board list applies exactly the same gate as a claim', () => {
    const b = { ...INVASIVE, start_time: SHIFT } as unknown as BoardBookingRow;
    expect(eligibleFor(nurse(), b, RULE, NOW)).toBe(true);
    expect(eligibleFor(nurse({ tier: NurseTier.TIER_1_BASIC }), b, RULE, NOW)).toBe(false);
    expect(eligibleFor(nurse({ gphn_expiry_date: '2027-03-10' }), b, RULE, NOW)).toBe(false);
    expect(eligibleFor(nurse({ profile_status: ProfileStatus.SUSPENDED }), b, RULE, NOW)).toBe(false);
  });

  it('the catalog cannot create the hole: an invasive service always requires Tier 2', () => {
    expect(catalogProblem({ is_invasive: true, required_tier: NurseTier.TIER_1_BASIC })).toBe('INVALID_TIER_FOR_INVASIVE');
  });
});

describe('security · medical-record access ends on time (unit)', () => {
  const NURSE = 'nurse-a';
  const CHECKOUT = vn('2027-03-10', '12:00');
  const EXPIRY_HOURS = 12;
  const at = (ms: number) => new Date(ms);

  const facts = (over: Partial<RecordAccessFacts> = {}): RecordAccessFacts => ({
    bookingId: 'b1',
    assignedNurseId: NURSE,
    executionStatus: 'COMPLETED',
    patientProfileId: 'p1',
    consentActive: true,
    profileDeleted: false,
    checkoutTime: CHECKOUT,
    grantUntil: null,
    ...over,
  });
  const decide = (f: RecordAccessFacts, now: Date, who = NURSE) => decideRecordAccess(f, who, EXPIRY_HOURS, now);

  it('open during the shift (CONFIRMED / IN_PROGRESS)', () => {
    for (const s of ['CONFIRMED', 'IN_PROGRESS']) {
      expect(decide(facts({ executionStatus: s, checkoutTime: null }), at(NOW))).toMatchObject({ allowed: true, basis: 'ACTIVE_BOOKING' });
    }
  });

  it('after check-out: open until exactly checkout + RECORD_ACCESS_EXPIRY_HOURS, closed from that instant', () => {
    const end = CHECKOUT.getTime() + EXPIRY_HOURS * 3_600_000;
    expect(decide(facts(), at(end - 1))).toMatchObject({ allowed: true, basis: 'POST_CHECKOUT_WINDOW', accessUntil: at(end) });
    expect(decide(facts(), at(end))).toEqual({ allowed: false, reason: 'WINDOW_CLOSED' });
    expect(decide(facts(), at(end + 30 * DAY))).toEqual({ allowed: false, reason: 'WINDOW_CLOSED' });
  });

  it('another nurse never gets in, not even inside the window', () => {
    expect(decide(facts(), at(CHECKOUT.getTime() + 1), 'nurse-b')).toEqual({ allowed: false, reason: 'NOT_ASSIGNED' });
    expect(decide(facts({ assignedNurseId: null }), at(CHECKOUT.getTime() + 1))).toEqual({ allowed: false, reason: 'NOT_ASSIGNED' });
  });

  it('consent withdrawn or profile deleted closes access at once, even mid-shift', () => {
    expect(decide(facts({ executionStatus: 'IN_PROGRESS', consentActive: false }), at(NOW))).toEqual({ allowed: false, reason: 'CONSENT_WITHDRAWN' });
    expect(decide(facts({ profileDeleted: true }), at(CHECKOUT.getTime() + 1))).toEqual({ allowed: false, reason: 'CONSENT_WITHDRAWN' });
  });

  it('a booking that never completed gives no post-shift window (cancelled / expired)', () => {
    for (const s of ['CANCELLED', 'EXPIRED', 'MATCHING', 'DRAFT']) {
      expect(decide(facts({ executionStatus: s }), at(CHECKOUT.getTime() + 1))).toEqual({ allowed: false, reason: 'WINDOW_CLOSED' });
    }
  });

  it('COMPLETED without a check-out time gives no window (no open-ended access)', () => {
    expect(decide(facts({ checkoutTime: null }), at(CHECKOUT.getTime() + 1))).toEqual({ allowed: false, reason: 'WINDOW_CLOSED' });
  });

  it('an Admin re-grant opens access only until its own expiry', () => {
    const grantUntil = at(CHECKOUT.getTime() + 3 * DAY);
    const late = CHECKOUT.getTime() + 2 * DAY;
    expect(decide(facts({ grantUntil }), at(late))).toMatchObject({ allowed: true, basis: 'ADMIN_GRANT', accessUntil: grantUntil });
    expect(decide(facts({ grantUntil }), grantUntil)).toEqual({ allowed: false, reason: 'WINDOW_CLOSED' });
  });
});
