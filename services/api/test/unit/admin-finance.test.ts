import { describe, expect, it } from 'vitest';
import { csvField, ledgerCsvLine, resolvePeriod, toCsv, vnDate, vnMidnight } from '../../src/modules/admin-finance/admin-finance.policy';

/** admin-finance (BE-3 · Phase 7 · CT-15): report period in Vietnam days and CSV encoding — no DB, no clock. */
describe('admin-finance policy', () => {
  const NOW = Date.parse('2026-11-25T20:30:00Z'); // 26/11 03:30 in Vietnam

  it('Vietnam dates: 00:00 VN is 17:00 UTC the day before', () => {
    expect(vnDate(NOW)).toBe('2026-11-26');
    expect(vnMidnight('2026-11-26').toISOString()).toBe('2026-11-25T17:00:00.000Z');
  });

  it('default period = this month up to today; both ends inclusive', () => {
    const p = resolvePeriod(undefined, undefined, NOW);
    expect(p).toMatchObject({ from: '2026-11-01', to: '2026-11-26' });
    expect(p.fromAt.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(p.toAt.toISOString()).toBe('2026-11-26T17:00:00.000Z');
    const one = resolvePeriod('2026-11-26', '2026-11-26', NOW);
    expect(one.toAt.getTime() - one.fromAt.getTime()).toBe(86_400_000);
  });

  it('refuses impossible dates, reversed periods and more than 366 days', () => {
    expect(() => resolvePeriod('2026-02-30', '2026-03-01', NOW)).toThrowError(expect.objectContaining({ status: 400, code: 'INVALID_PERIOD' }));
    expect(() => resolvePeriod('2026-11-26', '2026-11-25', NOW)).toThrow();
    expect(() => resolvePeriod('2025-01-01', '2026-11-26', NOW)).toThrow();
    expect(() => resolvePeriod('2025-11-26', '2026-11-25', NOW)).not.toThrow(); // 365 days
  });

  it('CSV: quotes commas / quotes / new lines, neutralises spreadsheet formulas, keeps negative numbers', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('@cmd')).toBe("'@cmd");
    expect(csvField(-425000)).toBe('-425000');
    expect(csvField(null)).toBe('');
    expect(csvField(new Date('2026-11-26T01:00:00Z'))).toBe('2026-11-26T01:00:00.000Z');
  });

  it('a ledger row: the signed amount follows the balance; BOM + CRLF for Excel', () => {
    const line = ledgerCsvLine({
      created_at: new Date('2026-11-26T01:00:00Z'),
      tx_type: 'WITHDRAW',
      balance_type: 'AVAILABLE',
      status: 'COMPLETED',
      amount: '200000',
      balance_before: '500000',
      balance_after: '300000',
      user_id: 'u1',
      role: 'NURSE',
      booking_code: null,
      idempotency_key: 'withdraw:u1:k',
      external_ref: null,
    });
    expect(line).toBe('2026-11-26T01:00:00.000Z,WITHDRAW,AVAILABLE,COMPLETED,-200000,500000,300000,u1,NURSE,,withdraw:u1:k,');
    expect(toCsv(['a', 'b'], ['1,2'])).toBe('﻿a,b\r\n1,2\r\n');
  });
});
