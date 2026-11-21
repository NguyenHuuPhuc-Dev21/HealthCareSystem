import { describe, expect, it } from 'vitest';
import { ExecutionStatus, MatchingMode, NurseTier, PaymentMethod, PaymentStatus, ProfileStatus } from '@healthcare-system/shared';
import { expiryReason, paymentHoldExpired, refundDue, unmatchedDeadline } from '../../src/modules/booking-expiry/booking-expiry.policy';
import type { ExpiryBookingRow } from '../../src/modules/booking-expiry/booking-expiry.types';
import {
  canonicalData,
  decideWebhookAction,
  signData,
  verifySignature,
  vietQrImageUrl,
} from '../../src/modules/gateway-webhooks/gateway-webhooks.policy';
import { escrowWebhookSchema } from '../../src/modules/gateway-webhooks/gateway-webhooks.schema';
import { receivingAccountFromEnv, simulatorEnabled } from '../../src/modules/gateway-webhooks/gateway-webhooks.service';
import type { PaymentBookingRow } from '../../src/modules/gateway-webhooks/gateway-webhooks.types';
import { ageOn, eligibleFor, givenName, toDirectInvitation, toJobItem } from '../../src/modules/job-board/job-board.policy';
import type { BoardBookingRow } from '../../src/modules/job-board/job-board.types';
import type { NurseGateRow } from '../../src/modules/matching-radar/matching-radar.types';

/**
 * BE-3 · Phase 3 — pure rules of gateway-webhooks, booking-expiry and job-board.
 * "Bây giờ" = Thứ 2 2026-11-16 09:00 giờ VN.
 */
const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
const NOW = vn('2026-11-16', '09:00').getTime();
const MIN = 60_000;
const SECRET = 'unit-test-secret';
const RULE = { unmatchedLeadMinutes: 30, urgentUnmatchedMinutes: 30 };

// ---------------------------------------------------------------------------
describe('gateway-webhooks — HMAC signature (SEC-5.3)', () => {
  const data = { orderCode: 'HC-261116-ABC123', amount: 200000, reference: 'FT001', description: 'HC-261116-ABC123' };

  it('signs the sorted key=value string (PayOS convention)', () => {
    expect(canonicalData({ b: 2, a: 'x', c: null })).toBe('a=x&b=2&c=');
    expect(signData(data, SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts the right signature; rejects any change to data, a wrong secret or an empty secret', () => {
    const sig = signData(data, SECRET);
    expect(verifySignature(data, sig, SECRET)).toBe(true);
    expect(verifySignature({ ...data, amount: 1 }, sig, SECRET)).toBe(false);
    expect(verifySignature(data, sig, 'other')).toBe(false);
    expect(verifySignature(data, sig, '')).toBe(false);
    expect(verifySignature(data, 'ab', SECRET)).toBe(false);
  });

  it('webhook body schema: integer positive amount, hex signature, extra signed fields kept', () => {
    const body = { code: '00', success: true, data: { ...data, accountNumber: '123' }, signature: signData(data, SECRET) };
    const parsed = escrowWebhookSchema.parse(body);
    expect(parsed.data).toHaveProperty('accountNumber', '123');
    expect(escrowWebhookSchema.safeParse({ ...body, data: { ...data, amount: 1.5 } }).success).toBe(false);
    expect(escrowWebhookSchema.safeParse({ ...body, signature: 'nothex' }).success).toBe(false);
  });
});

describe('gateway-webhooks — what a verified payment does', () => {
  const b = (over: Partial<PaymentBookingRow> = {}): PaymentBookingRow => ({
    id: 'b1',
    booking_code: 'HC-1',
    customer_id: 'c1',
    payment_method: PaymentMethod.BANK_TRANSFER,
    payment_status: PaymentStatus.UNPAID,
    execution_status: ExecutionStatus.DRAFT,
    hold_expires_at: new Date(NOW + 10 * MIN),
    total_amount: '200000',
    ...over,
  });

  it('exact amount inside the hold → HOLD', () => {
    expect(decideWebhookAction(b(), 200000, NOW)).toBe('HOLD');
  });

  it('wrong amount → AMOUNT_MISMATCH (server-authoritative, nothing moves); cash booking → NOT_TRANSFER_BOOKING', () => {
    expect(decideWebhookAction(b(), 199999, NOW)).toBe('AMOUNT_MISMATCH');
    expect(decideWebhookAction(b({ payment_method: PaymentMethod.CASH }), 200000, NOW)).toBe('NOT_TRANSFER_BOOKING');
  });

  it('hold passed or booking already expired → LATE_REFUND; already paid → EXTRA_REFUND', () => {
    expect(decideWebhookAction(b({ hold_expires_at: new Date(NOW) }), 200000, NOW)).toBe('LATE_REFUND');
    expect(decideWebhookAction(b({ execution_status: ExecutionStatus.EXPIRED }), 200000, NOW)).toBe('LATE_REFUND');
    expect(decideWebhookAction(b({ payment_status: PaymentStatus.ESCROW_HELD, execution_status: ExecutionStatus.MATCHING }), 200000, NOW)).toBe(
      'EXTRA_REFUND',
    );
  });

  it('VietQR image only when the receiving account is fully configured', () => {
    expect(vietQrImageUrl(null, 1, 'x')).toBeNull();
    const acc = { bankBin: '970422', bankName: 'MB', accountNumber: '0001', accountName: 'CARENEST' };
    expect(vietQrImageUrl(acc, 200000, 'HC-1')).toBe(
      'https://img.vietqr.io/image/970422-0001-compact2.png?amount=200000&addInfo=HC-1&accountName=CARENEST',
    );
    expect(receivingAccountFromEnv({ PAYMENT_RECEIVING_BANK_BIN: '970422' })).toBeNull();
    expect(simulatorEnabled({ PAYMENT_SIMULATOR_ENABLED: 'true', NODE_ENV: 'production' })).toBe(false);
    expect(simulatorEnabled({ PAYMENT_SIMULATOR_ENABLED: 'true', NODE_ENV: 'development' })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('booking-expiry policy (FR-BOOK-01/03, BR-08 §2.5)', () => {
  const START = vn('2026-11-16', '18:00');
  const row = (over: Partial<ExpiryBookingRow> = {}): ExpiryBookingRow => ({
    id: 'b1',
    booking_code: 'HC-1',
    customer_id: 'c1',
    nurse_id: null,
    matching_mode: MatchingMode.JOB_BOARD,
    payment_method: PaymentMethod.BANK_TRANSFER,
    payment_status: PaymentStatus.UNPAID,
    execution_status: ExecutionStatus.DRAFT,
    start_time: START,
    hold_expires_at: new Date(NOW + 15 * MIN),
    matching_started_at: null,
    total_amount: '200000',
    ...over,
  });

  it('unpaid hold: expires exactly at hold_expires_at, not one ms before', () => {
    expect(paymentHoldExpired(row(), NOW + 15 * MIN - 1)).toBe(false);
    expect(paymentHoldExpired(row(), NOW + 15 * MIN)).toBe(true);
    expect(paymentHoldExpired(row({ payment_status: PaymentStatus.ESCROW_HELD }), NOW + 60 * MIN)).toBe(false);
  });

  it('Job Board booking: 30 minutes before the start', () => {
    const m = row({ execution_status: ExecutionStatus.MATCHING, payment_status: PaymentStatus.ESCROW_HELD, matching_started_at: new Date(NOW) });
    expect(unmatchedDeadline(m, RULE)).toBe(START.getTime() - 30 * MIN);
    expect(expiryReason(m, RULE, START.getTime() - 30 * MIN - 1)).toBeNull();
    expect(expiryReason(m, RULE, START.getTime() - 30 * MIN)).toBe('UNMATCHED');
  });

  it('urgent Radar booking: 30 minutes after matching started, or 30 before the start — whichever first', () => {
    const urgent = row({
      execution_status: ExecutionStatus.MATCHING,
      matching_mode: MatchingMode.RADAR_DISPATCH,
      start_time: vn('2026-11-16', '12:00'),
      matching_started_at: new Date(NOW),
    });
    expect(unmatchedDeadline(urgent, RULE)).toBe(NOW + 30 * MIN);
    const veryClose = { ...urgent, start_time: vn('2026-11-16', '09:40') };
    expect(unmatchedDeadline(veryClose, RULE)).toBe(vn('2026-11-16', '09:10').getTime());
  });

  it('a booking with a nurse, or already confirmed, never expires here; refund only when escrow is held', () => {
    const m = row({ execution_status: ExecutionStatus.MATCHING });
    expect(expiryReason({ ...m, nurse_id: 'n1' }, RULE, START.getTime())).toBeNull();
    expect(expiryReason({ ...m, execution_status: ExecutionStatus.CONFIRMED }, RULE, START.getTime())).toBeNull();
    expect(refundDue(row({ payment_status: PaymentStatus.ESCROW_HELD }))).toBe(true);
    expect(refundDue(row({ payment_method: PaymentMethod.CASH }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('job-board policy (BR-08 §2.2/§2.3, ADR-0004 D2)', () => {
  const RULE_D = { minDeposit: 300_000, graceMaxShifts: 3 };
  const booking = (over: Partial<BoardBookingRow> = {}): BoardBookingRow =>
    ({
      id: 'b1',
      booking_code: 'HC-261116-ABC123',
      customer_id: 'c1',
      nurse_id: null,
      matching_mode: MatchingMode.JOB_BOARD,
      payment_method: PaymentMethod.CASH,
      payment_status: PaymentStatus.UNPAID,
      execution_status: ExecutionStatus.MATCHING,
      start_time: vn('2026-11-17', '08:00'),
      end_time: vn('2026-11-17', '09:00'),
      base_amount: '200000',
      surcharge_amount: '0',
      urgent_bonus_amount: '0',
      platform_fee: '30000',
      total_amount: '200000',
      prescription_image_url: null,
      prescription_issued_date: null,
      service_name: 'Thay băng',
      service_type: 'TASK_BASED',
      is_invasive: false,
      required_tier: NurseTier.TIER_1_BASIC,
      care_lat: '10.7769',
      care_lng: '106.7009',
      patient_name: 'Trần Văn Bình',
      patient_dob: '1950-12-01',
      patient_gender: 'MALE',
      patient_weight_kg: '60',
      patient_mobility: 'NORMAL',
      customer_name: 'Nguyễn Thị Hoa',
      matching_started_at: new Date(NOW),
      ...over,
    }) as BoardBookingRow;
  const nurse = (over: Partial<NurseGateRow> = {}): NurseGateRow => ({
    user_id: 'n1',
    user_status: 'ACTIVE',
    profile_status: ProfileStatus.ACTIVE,
    tier: NurseTier.TIER_1_BASIC,
    gphn_number: null,
    gphn_expiry_date: null,
    current_lat: '10.7859',
    current_lng: '106.7009',
    deposit_balance: '300000',
    deposit_grace_expires_at: null,
    deposit_grace_shifts_used: 0,
    held_transfer_shifts: '0',
    closure_requested_at: null,
    ...over,
  });
  const grace = nurse({ deposit_balance: '0', deposit_grace_expires_at: new Date(NOW + 10 * 86_400_000) });

  it('deposit grace: a nurse short of the deposit sees BANK_TRANSFER jobs only (ADR-0004 D2)', () => {
    expect(eligibleFor(nurse(), booking(), RULE_D, NOW)).toBe(true);
    expect(eligibleFor(grace, booking(), RULE_D, NOW)).toBe(false);
    expect(eligibleFor(grace, booking({ payment_method: PaymentMethod.BANK_TRANSFER, payment_status: PaymentStatus.ESCROW_HELD }), RULE_D, NOW)).toBe(true);
    expect(eligibleFor({ ...grace, deposit_grace_shifts_used: 3 }, booking({ payment_method: PaymentMethod.BANK_TRANSFER }), RULE_D, NOW)).toBe(false);
  });

  it('closing account, not ACTIVE, or Tier 1 on an invasive job → not shown', () => {
    expect(eligibleFor(nurse({ closure_requested_at: new Date(NOW) }), booking(), RULE_D, NOW)).toBe(false);
    expect(eligibleFor(nurse({ profile_status: ProfileStatus.SUSPENDED }), booking(), RULE_D, NOW)).toBe(false);
    expect(eligibleFor(nurse(), booking({ is_invasive: true, required_tier: NurseTier.TIER_2_SPECIALIST }), RULE_D, NOW)).toBe(false);
  });

  it('JobItem: need-to-know only (given names, age, no address), net = total − fee + bonus', () => {
    const item = toJobItem(booking({ urgent_bonus_amount: '40000' }), nurse(), NOW);
    expect(item).toMatchObject({
      id: 'b1',
      date: '2026-11-17',
      startTime: '08:00',
      endTime: '09:00',
      patientName: 'Bình',
      patientAge: 75,
      distanceKm: 1,
      netAmount: 210000,
      urgentBonus: 40000,
      matchingMode: 'JOB_BOARD',
      paymentStatus: 'UNPAID',
      status: 'MATCHING',
    });
    expect(item).not.toHaveProperty('fullAddress');
    expect(item).not.toHaveProperty('isDirectInvite');
    const inv = toJobItem(booking(), nurse(), NOW, { expiresAt: new Date(NOW + 15 * MIN) });
    expect(inv).toMatchObject({ isDirectInvite: true, inviterName: 'Hoa', directInviteExpiresAt: new Date(NOW + 15 * MIN).toISOString() });
  });

  it('DirectInvitation counts down to the window end', () => {
    const d = toDirectInvitation(booking(), new Date(NOW + 15 * MIN), NOW + 5 * MIN);
    expect(d).toMatchObject({ bookingId: 'b1', inviterName: 'Hoa', patientName: 'Bình', expiresInSeconds: 600, totalAmount: 200000 });
    expect(givenName('  Lê   An ')).toBe('An');
    expect(ageOn('1950-11-17', '2026-11-16')).toBe(75);
  });
});

// ---------------------------------------------------------------------------
describe('booking-expiry sweep (fake DB): one failing booking never stops the others', () => {
  it('counts expired / failed and keeps going', async () => {
    const { BookingExpiryService } = await import('../../src/modules/booking-expiry/booking-expiry.service');
    const updates: string[] = [];
    const draft = (id: string) => ({
      id,
      booking_code: id,
      customer_id: 'c1',
      nurse_id: null,
      matching_mode: 'JOB_BOARD',
      payment_method: 'BANK_TRANSFER',
      payment_status: 'UNPAID',
      execution_status: 'DRAFT',
      start_time: new Date(NOW + 10 * 3_600_000),
      hold_expires_at: new Date(NOW - 1),
      matching_started_at: null,
      total_amount: '200000',
    });
    const db = {
      async query(sql: string, params: unknown[] = []) {
        if (sql.includes('SELECT id FROM bookings')) return { rows: [{ id: 'a' }, { id: 'boom' }, { id: 'c' }], rowCount: 3 };
        if (sql.includes('FOR UPDATE')) {
          if (params[0] === 'boom') throw new Error('lock timeout');
          return { rows: [draft(String(params[0]))], rowCount: 1 };
        }
        if (sql.startsWith('UPDATE bookings')) updates.push(String(params[0]));
        return { rows: [], rowCount: 1 };
      },
    };
    const svc = new BookingExpiryService({
      withTx: (fn) => fn(db as never),
      now: () => NOW,
      configNumber: async () => 30,
    });
    const errors = console.error;
    console.error = () => {};
    try {
      expect(await svc.runSweep()).toEqual({ paymentTimeouts: 2, unmatched: 0, refunded: 0, failed: 1 });
    } finally {
      console.error = errors;
    }
    expect(updates).toEqual(['a', 'c']);
  });
});
