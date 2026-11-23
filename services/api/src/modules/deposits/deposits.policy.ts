/**
 * Pure rules of deposits (BE-3 · Phase 5 · ADR-0004). No I/O: every number comes in as an argument.
 *
 *  - top-up: amount ≤ shortfall when the link is made; at payment time credit at most the shortfall (D2)
 *  - payment code "KQ…" (never collides with booking codes "HC-…")
 *  - refund eligibility: 4 conditions + earliest date (D3)
 *  - payout due date: N working days (Mon–Fri, minus public holidays), Vietnam time
 *  - penalty appeal window (D3)
 */
import type { DepositRefundPendingReason } from '@healthcare-system/shared';
import { PAYMENT_CODE_PREFIX, type PenaltyRow, type RefundEligibility, type RefundFacts } from './deposits.types';

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;
/** No 0/O/1/I: the code is typed by hand into banking apps. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;
const CODE_RE = new RegExp(`^${PAYMENT_CODE_PREFIX}[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** `bytes` = CODE_LENGTH random bytes (injected so tests are deterministic). */
export function makePaymentCode(bytes: Uint8Array): string {
  if (bytes.length < CODE_LENGTH) throw new Error(`need ${CODE_LENGTH} random bytes`);
  let code = PAYMENT_CODE_PREFIX;
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return code;
}

export function isDepositTopupCode(orderCode: string): boolean {
  return CODE_RE.test(orderCode);
}

export function shortfallOf(depositBalance: number, minDeposit: number): number {
  return Math.max(minDeposit - depositBalance, 0);
}

/** Link creation: 1 … shortfall. */
export function topupAmountError(amount: number, shortfall: number): 'DEPOSIT_FULL' | 'TOPUP_EXCEEDS_SHORTFALL' | null {
  if (shortfall <= 0) return 'DEPOSIT_FULL';
  if (amount > shortfall) return 'TOPUP_EXCEEDS_SHORTFALL';
  return null;
}

/**
 * Payment time: the deposit may never go above MIN_NURSE_DEPOSIT (ADR-0004 D2) — the shortfall may have shrunk since
 * the link was made (a settlement withheld part of it). Credit what is still missing; the custody partner returns the rest.
 */
export function splitTopup(paid: number, depositBalance: number, minDeposit: number): { credit: number; returned: number } {
  const credit = Math.min(paid, shortfallOf(depositBalance, minDeposit));
  return { credit, returned: paid - credit };
}

export function maskAccount(accountNo: string): string {
  return `•••• ${accountNo.slice(-4)}`;
}

/**
 * ADR-0004 D3 — READY only when all hold: no CONFIRMED/IN_PROGRESS booking; DEPOSIT_REFUND_HOLD_DAYS since the last
 * check-out; no OPEN/UNDER_REVIEW dispute; no unpaid cash commission. eligibleAt = when the hold ends (if pending).
 */
export function refundEligibility(f: RefundFacts, holdDays: number, nowMs: number): RefundEligibility {
  const pending: DepositRefundPendingReason[] = [];
  if (f.activeBookings > 0) pending.push('ACTIVE_BOOKING');
  let eligibleAt: Date | null = null;
  if (f.lastCheckoutAt) {
    const holdEnd = new Date(f.lastCheckoutAt).getTime() + holdDays * DAY_MS;
    if (holdEnd > nowMs) {
      pending.push('HOLD_DAYS');
      eligibleAt = new Date(holdEnd);
    }
  }
  if (f.openDisputes > 0) pending.push('OPEN_DISPUTE');
  if (f.unpaidCommissions > 0) pending.push('UNPAID_COMMISSION');
  return { pendingReasons: pending, eligibleAt };
}

/** Vietnam calendar date "YYYY-MM-DD" of an instant. */
export function vnDateString(ms: number): string {
  return new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * `n` working days after `fromMs` (same clock time), skipping Saturday, Sunday and the given public holidays
 * (Vietnam dates "YYYY-MM-DD").
 */
export function addWorkingDays(fromMs: number, n: number, holidays: ReadonlySet<string>): Date {
  let ms = fromMs;
  let left = n;
  while (left > 0) {
    ms += DAY_MS;
    const vn = new Date(ms + VN_OFFSET_MS);
    const dow = vn.getUTCDay();
    if (dow === 0 || dow === 6 || holidays.has(vnDateString(ms))) continue;
    left -= 1;
  }
  return new Date(ms);
}

export type AppealError = 'NOT_APPEALABLE' | 'APPEAL_WINDOW_CLOSED' | 'ALREADY_APPEALED' | 'ALREADY_REVERSED';

/** DISPUTE_UPHELD penalties (appeal_deadline NULL) and penalties without a booking cannot be appealed. */
export function appealError(p: Pick<PenaltyRow, 'appeal_deadline' | 'appeal_dispute_id' | 'reversed' | 'booking_id'>, nowMs: number): AppealError | null {
  if (p.reversed) return 'ALREADY_REVERSED';
  if (p.appeal_dispute_id) return 'ALREADY_APPEALED';
  if (!p.appeal_deadline || !p.booking_id) return 'NOT_APPEALABLE';
  if (new Date(p.appeal_deadline).getTime() <= nowMs) return 'APPEAL_WINDOW_CLOSED';
  return null;
}
