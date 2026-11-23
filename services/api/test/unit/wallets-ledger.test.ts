import { describe, expect, it } from 'vitest';
import { TxType } from '@healthcare-system/shared';
import {
  bucketEarnings,
  decodeCursor,
  depositGraceActive,
  describeTx,
  earningsWindow,
  encodeCursor,
  signedAmount,
  suspensionOf,
  txTypesForFilter,
} from '../../src/modules/wallets-ledger/wallets-ledger.policy';

/** wallets-ledger (BE-3 · Phase 5): pure rules — no DB, no clock. */
describe('wallets-ledger policy', () => {
  const RULE = { minDeposit: 300_000, graceMaxShifts: 3 };
  const NOW = Date.parse('2026-11-25T03:00:00Z'); // Wednesday 10:00 in Vietnam

  describe('signedAmount', () => {
    it('follows the balance movement: credit +, debit −', () => {
      expect(signedAmount({ tx_type: TxType.ESCROW_RELEASE, amount: 297_500, balance_before: 0, balance_after: 297_500 })).toBe(297_500);
      expect(signedAmount({ tx_type: TxType.WITHDRAW, amount: '100000', balance_before: '297500', balance_after: '197500' })).toBe(-100_000);
      expect(signedAmount({ tx_type: TxType.PENALTY_DEDUCT, amount: 60_000, balance_before: 20_000, balance_after: -40_000 })).toBe(-60_000);
    });

    it('falls back to the type when the balance did not move (pending rows)', () => {
      expect(signedAmount({ tx_type: TxType.WITHDRAW, amount: 50_000, balance_before: 10, balance_after: 10 })).toBe(-50_000);
      expect(signedAmount({ tx_type: TxType.TOPUP, amount: 50_000, balance_before: 10, balance_after: 10 })).toBe(50_000);
    });
  });

  it('describes every type in Vietnamese, with the booking code when there is one', () => {
    expect(describeTx(TxType.ESCROW_RELEASE, 'HC-1')).toBe('Quyết toán ca HC-1');
    expect(describeTx(TxType.TRAVEL_SUPPORT, 'HC-2')).toContain('Hỗ trợ đi lại');
    expect(describeTx(TxType.WITHDRAW, null)).toBe('Rút tiền về ngân hàng');
    expect(describeTx('SOMETHING_NEW', null)).toBe('Giao dịch ví');
    for (const t of Object.values(TxType)) expect(describeTx(t, null).length).toBeGreaterThan(0);
  });

  it('maps the filter chips of the wallet screen, an exact TxType, or rejects', () => {
    expect(txTypesForFilter(undefined)).toBeNull();
    expect(txTypesForFilter('ALL')).toBeNull();
    expect(txTypesForFilter('SETTLE')).toEqual([TxType.ESCROW_RELEASE, TxType.DEPOSIT_WITHHOLD]);
    expect(txTypesForFilter('PENALTY')).toEqual([TxType.PENALTY_DEDUCT, TxType.PENALTY_REVERSAL]);
    expect(txTypesForFilter('DEPOSIT')).toContain(TxType.TOPUP);
    expect(txTypesForFilter('TRAVEL_SUPPORT')).toEqual([TxType.TRAVEL_SUPPORT]);
    expect(txTypesForFilter('DROP TABLE')).toBe('INVALID');
  });

  it('round-trips the cursor and refuses anything else', () => {
    const c = { createdAt: '2026-11-22 10:00:00.123456+07', id: '6c0e6b8e-7d1f-4a43-9a51-1c7e2f7d9a10' };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('["x","y"]').toString('base64url'))).toBeNull();
  });

  describe('depositGraceActive (ADR-0004 D2)', () => {
    const w = (o: Partial<{ deposit: number; expires: string | null; used: number }>) => ({
      deposit_balance: o.deposit ?? 0,
      deposit_grace_expires_at: o.expires === undefined ? new Date(NOW + 86_400_000) : o.expires ? new Date(o.expires) : null,
      deposit_grace_shifts_used: o.used ?? 0,
    });
    it('short deposit, inside the window, under the shift cap → active', () => {
      expect(depositGraceActive(w({}), RULE, NOW)).toBe(true);
      expect(depositGraceActive(w({ used: 2 }), RULE, NOW)).toBe(true);
    });
    it('full deposit, expired, never started, cap reached or no wallet → not active', () => {
      expect(depositGraceActive(w({ deposit: 300_000 }), RULE, NOW)).toBe(false);
      expect(depositGraceActive(w({ expires: '2026-11-25T03:00:00Z' }), RULE, NOW)).toBe(false);
      expect(depositGraceActive(w({ expires: null }), RULE, NOW)).toBe(false);
      expect(depositGraceActive(w({ used: 3 }), RULE, NOW)).toBe(false);
      expect(depositGraceActive(null, RULE, NOW)).toBe(false);
    });
  });

  describe('suspensionOf', () => {
    const ok = {
      closureRequested: false,
      profileStatus: 'ACTIVE',
      profileSuspendedReason: null,
      commissionOverdue: false,
      depositShort: false,
      graceActive: false,
    };
    it('not suspended by default; a short deposit in grace is not a suspension', () => {
      expect(suspensionOf(ok)).toEqual({ isSuspended: false, suspendedReason: null });
      expect(suspensionOf({ ...ok, depositShort: true, graceActive: true }).isSuspended).toBe(false);
    });
    it('picks the most important reason first', () => {
      const all = { ...ok, closureRequested: true, profileStatus: 'SUSPENDED', commissionOverdue: true, depositShort: true };
      expect(suspensionOf(all).suspendedReason).toBe('ACCOUNT_CLOSING');
      expect(suspensionOf({ ...all, closureRequested: false, profileSuspendedReason: 'TRUST_SCORE_BELOW_THRESHOLD' }).suspendedReason).toBe('TRUST_SCORE_LOW');
      expect(suspensionOf({ ...all, closureRequested: false, profileSuspendedReason: 'ADMIN' })).toEqual({ isSuspended: true, suspendedReason: null });
      expect(suspensionOf({ ...ok, commissionOverdue: true, depositShort: true }).suspendedReason).toBe('COMMISSION_OVERDUE');
      expect(suspensionOf({ ...ok, depositShort: true }).suspendedReason).toBe('DEPOSIT_BELOW_MIN');
    });
  });

  describe('earnings windows (Vietnam time)', () => {
    it('week = Monday 00:00 → next Monday, T2 … CN', () => {
      const win = earningsWindow('week', NOW);
      expect(win.from.toISOString()).toBe('2026-11-22T17:00:00.000Z'); // Mon 23/11 00:00 VN
      expect(win.to.toISOString()).toBe('2026-11-29T17:00:00.000Z');
      expect(win.labels).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
      expect(win.bucketOf(Date.parse('2026-11-22T17:00:00Z'))).toBe(0);
      expect(win.bucketOf(Date.parse('2026-11-29T16:59:59Z'))).toBe(6); // Sunday 23:59:59 VN
    });

    it('a Sunday evening still belongs to its own week', () => {
      const win = earningsWindow('week', Date.parse('2026-11-29T15:00:00Z')); // Sun 22:00 VN
      expect(win.from.toISOString()).toBe('2026-11-22T17:00:00.000Z');
    });

    it('month = 7-day weeks: 30 days → 5 points, February 2027 → 4', () => {
      const nov = earningsWindow('month', NOW);
      expect(nov.periodLabel).toBe('Tháng 11/2026');
      expect(nov.labels).toEqual(['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4', 'Tuần 5']);
      expect(nov.from.toISOString()).toBe('2026-10-31T17:00:00.000Z');
      expect(nov.to.toISOString()).toBe('2026-11-30T17:00:00.000Z');
      expect(earningsWindow('month', Date.parse('2027-02-10T00:00:00Z')).labels).toHaveLength(4);
    });

    it('sums credits per bucket and ignores anything outside the window', () => {
      const win = earningsWindow('month', NOW);
      const r = bucketEarnings(win, [
        { created_at: new Date('2026-10-31T17:00:00Z'), amount: '100000' }, // 1/11 00:00 VN → Tuần 1
        { created_at: new Date('2026-11-07T16:59:59Z'), amount: 50_000 }, // 7/11 23:59 VN → Tuần 1
        { created_at: new Date('2026-11-07T17:00:00Z'), amount: 20_000 }, // 8/11 → Tuần 2
        { created_at: new Date('2026-11-30T16:00:00Z'), amount: 5_000 }, // 30/11 → Tuần 5
        { created_at: new Date('2026-11-30T17:00:00Z'), amount: 999 }, // 1/12 → outside
      ]);
      expect(r.points.map((p) => p.amount)).toEqual([150_000, 20_000, 0, 0, 5_000]);
      expect(r.totalAmount).toBe(175_000);
    });
  });
});
