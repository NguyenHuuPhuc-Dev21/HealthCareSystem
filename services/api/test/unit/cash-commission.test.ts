import { describe, expect, it } from 'vitest';
import { commissionStatus, isCommissionCode, makeCommissionCode, sortDebts } from '../../src/modules/cash-commission/cash-commission.policy';
import { suspensionOf } from '../../src/modules/wallets-ledger/wallets-ledger.policy';

/** cash-commission (BE-3 · Phase 5 · FR-PAY-02 cash part): pure rules. */
describe('cash-commission policy', () => {
  const NOW = Date.parse('2026-11-25T03:00:00Z');

  it('payment codes are "HH" + 12 unambiguous characters, never a booking, extension or deposit code', () => {
    const code = makeCommissionCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 255]));
    expect(code).toMatch(/^HH[A-Z2-9]{12}$/);
    expect(code.slice(2)).not.toMatch(/[01IO]/);
    expect(isCommissionCode(code)).toBe(true);
    expect(isCommissionCode('HC-261121-ABC123')).toBe(false);
    expect(isCommissionCode('HC-261121-ABC123-GH1')).toBe(false);
    expect(isCommissionCode('KQ7HX2M9QPA4TZ')).toBe(false);
    expect(() => makeCommissionCode(new Uint8Array(2))).toThrow();
  });

  it('status: PAID once paid, OVERDUE from the deadline on, UNPAID before', () => {
    const due = new Date(NOW);
    expect(commissionStatus(null, new Date(NOW + 1), NOW)).toBe('UNPAID');
    expect(commissionStatus(null, due, NOW)).toBe('OVERDUE');
    expect(commissionStatus(new Date(NOW + 5), due, NOW)).toBe('PAID');
  });

  it('sorts overdue first, then unpaid by deadline, then paid newest first', () => {
    const d = (status: 'UNPAID' | 'PAID' | 'OVERDUE', dueAt: string, paidAt?: string) => ({ status, dueAt, paidAt });
    const sorted = sortDebts([
      d('PAID', '2026-11-20T00:00:00Z', '2026-11-20T01:00:00Z'),
      d('UNPAID', '2026-11-26T00:00:00Z'),
      d('PAID', '2026-11-21T00:00:00Z', '2026-11-21T01:00:00Z'),
      d('OVERDUE', '2026-11-24T00:00:00Z'),
      d('UNPAID', '2026-11-25T12:00:00Z'),
    ]);
    expect(sorted.map((x) => `${x.status}:${x.dueAt.slice(8, 10)}`)).toEqual(['OVERDUE:24', 'UNPAID:25', 'UNPAID:26', 'PAID:21', 'PAID:20']);
  });

  it('the wallet banner names a commission suspension (wallets-ledger)', () => {
    const base = { closureRequested: false, commissionOverdue: false, depositShort: false, graceActive: false };
    expect(suspensionOf({ ...base, profileStatus: 'SUSPENDED', profileSuspendedReason: 'COMMISSION_OVERDUE' })).toEqual({
      isSuspended: true,
      suspendedReason: 'COMMISSION_OVERDUE',
    });
  });
});
