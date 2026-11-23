/**
 * Pure rules of wallets-ledger (BE-3 · Phase 5). No I/O: every number comes in as an argument.
 *
 *  - signed amount of a ledger row (FE-2: positive = credit, negative = debit)
 *  - Vietnamese description per transaction type
 *  - filter chips → tx types, opaque cursor
 *  - deposit grace (ADR-0004 D2) and the suspension banner of the wallet summary
 *  - earnings buckets in Vietnam time (UTC+7, no DST): week = Mon..Sun, month = weeks of 7 days
 */
import { TxType, type EarningsPointDto } from '@healthcare-system/shared';
import type { DepositRule } from '../matching-radar/matching-radar.types';
import type {
  EarningRow,
  EarningsRange,
  EarningsResult,
  NurseWalletRow,
  SuspendedReason,
  TxFilterGroup,
  TxRow,
} from './wallets-ledger.types';

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

/** Types that take money OUT of the balance they name (used only when balance_before = balance_after). */
const DEBIT_TYPES = new Set<string>([
  TxType.WITHDRAW,
  TxType.PENALTY_DEDUCT,
  TxType.COMMISSION_PAYMENT,
  TxType.DEPOSIT_REFUND,
  TxType.REFUND,
]);

/** Ledger rows that count as the nurse's earnings (credits only). Cash jobs are paid in hand, not in the ledger. */
export const EARNING_TYPES: readonly TxType[] = [
  TxType.ESCROW_RELEASE,
  TxType.DEPOSIT_WITHHOLD, // part of a settled payout kept in the deposit — still earned (ADR-0004 D2)
  TxType.URGENT_BONUS,
  TxType.TRAVEL_SUPPORT,
];

/** Positive = credit, negative = debit. Derived from the balance movement itself, so it can never disagree with it. */
export function signedAmount(row: Pick<TxRow, 'tx_type' | 'amount' | 'balance_before' | 'balance_after'>): number {
  const diff = Number(row.balance_after) - Number(row.balance_before);
  if (diff !== 0) return diff;
  const amount = Number(row.amount);
  return DEBIT_TYPES.has(String(row.tx_type)) ? -amount : amount;
}

export function describeTx(type: TxType | string, bookingCode: string | null): string {
  const ca = (text: string) => (bookingCode ? `${text} ca ${bookingCode}` : text);
  switch (type) {
    case TxType.ESCROW_RELEASE:
      return ca('Quyết toán');
    case TxType.DEPOSIT_WITHHOLD:
      return ca('Giữ lại vào ký quỹ (ân hạn)');
    case TxType.URGENT_BONUS:
      return ca('Thưởng ca gấp');
    case TxType.TRAVEL_SUPPORT:
      return ca('Hỗ trợ đi lại (từ chối y lệnh không hợp lệ)');
    case TxType.TOPUP:
      return 'Nạp ký quỹ';
    case TxType.PENALTY_DEDUCT:
      return ca('Phạt trừ ký quỹ');
    case TxType.PENALTY_REVERSAL:
      return ca('Hoàn lại khoản phạt ký quỹ');
    case TxType.DEPOSIT_REFUND:
      return 'Hoàn ký quỹ khi đóng tài khoản';
    case TxType.COMMISSION_PAYMENT:
      return ca('Nộp hoa hồng nền tảng');
    case TxType.WITHDRAW:
      return 'Rút tiền về ngân hàng';
    case TxType.REFUND:
      return ca('Hoàn tiền');
    default:
      return ca('Giao dịch ví');
  }
}

const FILTER_GROUPS: Record<Exclude<TxFilterGroup, 'ALL'>, TxType[]> = {
  SETTLE: [TxType.ESCROW_RELEASE, TxType.DEPOSIT_WITHHOLD],
  PENALTY: [TxType.PENALTY_DEDUCT, TxType.PENALTY_REVERSAL],
  WITHDRAW: [TxType.WITHDRAW],
  DEPOSIT: [TxType.TOPUP, TxType.DEPOSIT_WITHHOLD, TxType.DEPOSIT_REFUND, TxType.PENALTY_DEDUCT, TxType.PENALTY_REVERSAL],
};

/** null = no filter; 'INVALID' = unknown chip / type (400). */
export function txTypesForFilter(filter: string | undefined): TxType[] | null | 'INVALID' {
  if (!filter || filter === 'ALL') return null;
  if (filter in FILTER_GROUPS) return FILTER_GROUPS[filter as keyof typeof FILTER_GROUPS];
  if ((Object.values(TxType) as string[]).includes(filter)) return [filter as TxType];
  return 'INVALID';
}

export interface TxCursor {
  createdAt: string; // PostgreSQL timestamptz text (exact)
  id: string;
}

export function encodeCursor(c: TxCursor): string {
  return Buffer.from(JSON.stringify([c.createdAt, c.id]), 'utf8').toString('base64url');
}

/** null when the cursor was not produced by encodeCursor. */
export function decodeCursor(raw: string): TxCursor | null {
  try {
    const v = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'string' || typeof v[1] !== 'string') return null;
    // PostgreSQL timestamptz text (DateStyle ISO), e.g. "2026-11-22 10:00:00.123456+07" — fed back as $::timestamptz.
    if (!/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:?\d{2})?|Z)?$/.test(v[0])) return null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v[1])) return null;
    return { createdAt: v[0], id: v[1] };
  } catch {
    return null;
  }
}

/**
 * ADR-0004 D2: short deposit, still inside DEPOSIT_GRACE_DAYS and under DEPOSIT_GRACE_MAX_SHIFTS
 * → the nurse may take transfer-paid bookings only. (The claim gate additionally counts shifts she already holds.)
 */
export function depositGraceActive(
  w: Pick<NurseWalletRow, 'deposit_balance' | 'deposit_grace_expires_at' | 'deposit_grace_shifts_used'> | null,
  rule: DepositRule,
  nowMs: number,
): boolean {
  if (!w) return false;
  if (Number(w.deposit_balance) >= rule.minDeposit) return false;
  if (!w.deposit_grace_expires_at || new Date(w.deposit_grace_expires_at).getTime() <= nowMs) return false;
  return Number(w.deposit_grace_shifts_used) < rule.graceMaxShifts;
}

export interface SuspensionInput {
  closureRequested: boolean;
  profileStatus: string | null;
  profileSuspendedReason: string | null;
  commissionOverdue: boolean;
  depositShort: boolean;
  graceActive: boolean;
}

/** Why the nurse cannot take new jobs right now — the most important reason first. */
export function suspensionOf(s: SuspensionInput): { isSuspended: boolean; suspendedReason: SuspendedReason | null } {
  if (s.closureRequested) return { isSuspended: true, suspendedReason: 'ACCOUNT_CLOSING' };
  if (s.profileStatus === 'SUSPENDED') {
    const trust = s.profileSuspendedReason === 'TRUST_SCORE_BELOW_THRESHOLD';
    return { isSuspended: true, suspendedReason: trust ? 'TRUST_SCORE_LOW' : null };
  }
  if (s.commissionOverdue) return { isSuspended: true, suspendedReason: 'COMMISSION_OVERDUE' };
  if (s.depositShort && !s.graceActive) return { isSuspended: true, suspendedReason: 'DEPOSIT_BELOW_MIN' };
  return { isSuspended: false, suspendedReason: null };
}

export interface EarningsWindow {
  from: Date;
  to: Date; // exclusive
  labels: string[];
  periodLabel: string;
  /** Bucket index of an instant inside [from, to). */
  bucketOf(ms: number): number;
}

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Current week (Mon 00:00 → next Mon 00:00) or current month, in Vietnam time. */
export function earningsWindow(range: EarningsRange, nowMs: number): EarningsWindow {
  const vnNow = new Date(nowMs + VN_OFFSET_MS); // read with UTC getters = Vietnam wall clock
  const vnMidnight = Date.UTC(vnNow.getUTCFullYear(), vnNow.getUTCMonth(), vnNow.getUTCDate());
  if (range === 'week') {
    const mondayIndex = (vnNow.getUTCDay() + 6) % 7;
    const startVn = vnMidnight - mondayIndex * DAY_MS;
    return {
      from: new Date(startVn - VN_OFFSET_MS),
      to: new Date(startVn + 7 * DAY_MS - VN_OFFSET_MS),
      labels: WEEKDAY_LABELS,
      periodLabel: 'Tuần này',
      bucketOf: (ms) => Math.floor((ms + VN_OFFSET_MS - startVn) / DAY_MS),
    };
  }
  const y = vnNow.getUTCFullYear();
  const m = vnNow.getUTCMonth();
  const startVn = Date.UTC(y, m, 1);
  const endVn = Date.UTC(y, m + 1, 1);
  const days = Math.round((endVn - startVn) / DAY_MS);
  const weeks = Math.ceil(days / 7);
  return {
    from: new Date(startVn - VN_OFFSET_MS),
    to: new Date(endVn - VN_OFFSET_MS),
    labels: Array.from({ length: weeks }, (_, i) => `Tuần ${i + 1}`),
    periodLabel: `Tháng ${m + 1}/${y}`,
    bucketOf: (ms) => Math.floor((ms + VN_OFFSET_MS - startVn) / (7 * DAY_MS)),
  };
}

export function bucketEarnings(win: EarningsWindow, rows: EarningRow[]): EarningsResult {
  const sums = win.labels.map(() => 0);
  const from = win.from.getTime();
  const to = win.to.getTime();
  for (const r of rows) {
    const ms = new Date(r.created_at).getTime();
    if (ms < from || ms >= to) continue; // the last week of a month is shorter than 7 days
    const i = Math.min(win.bucketOf(ms), sums.length - 1);
    if (i >= 0) sums[i] += Number(r.amount);
  }
  const points: EarningsPointDto[] = win.labels.map((label, i) => ({ label, amount: sums[i] }));
  return { points, totalAmount: sums.reduce((a, b) => a + b, 0), periodLabel: win.periodLabel };
}
