/**
 * Pure rules of cash-commission (BE-3 · Phase 5 · FR-PAY-02). No I/O.
 */
import { COMMISSION_CODE_PREFIX, type CommissionStatus } from './cash-commission.types';

/** No 0/O/1/I: typed by hand into banking apps. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 12;
const CODE_RE = new RegExp(`^${COMMISSION_CODE_PREFIX}[${ALPHABET}]{${LENGTH}}$`);

export function makeCommissionCode(bytes: Uint8Array): string {
  if (bytes.length < LENGTH) throw new Error(`need ${LENGTH} random bytes`);
  let code = COMMISSION_CODE_PREFIX;
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[bytes[i]! % ALPHABET.length];
  return code;
}

export function isCommissionCode(orderCode: string): boolean {
  return CODE_RE.test(orderCode);
}

/** PAID once paid; OVERDUE once the deadline passed (FR-PAY-02: 24h after check-out); UNPAID before. */
export function commissionStatus(paidAt: Date | null, dueAt: Date, nowMs: number): CommissionStatus {
  if (paidAt) return 'PAID';
  return new Date(dueAt).getTime() <= nowMs ? 'OVERDUE' : 'UNPAID';
}

const ORDER: Record<CommissionStatus, number> = { OVERDUE: 0, UNPAID: 1, PAID: 2 };

/** What the nurse must act on first: overdue, then unpaid (earliest deadline first), then paid (latest first). */
export function sortDebts<T extends { status: CommissionStatus; dueAt: string; paidAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (ORDER[a.status] !== ORDER[b.status]) return ORDER[a.status] - ORDER[b.status];
    if (a.status === 'PAID') return Date.parse(b.paidAt ?? '') - Date.parse(a.paidAt ?? '');
    return Date.parse(a.dueAt) - Date.parse(b.dueAt);
  });
}
