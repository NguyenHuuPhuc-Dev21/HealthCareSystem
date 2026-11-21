import { describe, expect, it } from 'vitest';
import { recalculateNurseRatingAvg } from '../../src/modules/reviews-trustscore/reviews-trustscore.repo';

/**
 * reviews-trustscore — cached nurse rating (FR-RATE-01, FR-SEARCH-01).
 * The rule itself lives in one SQL statement, proven on real PostgreSQL in
 * test/integration/reviews-trustscore.test.ts. Here: the contract around that statement.
 */
const NURSE = '00000000-0000-4000-8000-000000000001';

function fakeDb(rows: { rating_avg: string }[]) {
  const calls: { text: string; params?: unknown[] }[] = [];
  return {
    calls,
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      return { rows, rowCount: rows.length } as any;
    },
  };
}

describe('recalculateNurseRatingAvg', () => {
  it('returns the stored average as a number (pg returns NUMERIC as text)', async () => {
    const db = fakeDb([{ rating_avg: '4.33' }]);
    await expect(recalculateNurseRatingAvg(db, NURSE)).resolves.toBe(4.33);
  });

  it('returns null when the user has no nurse profile', async () => {
    await expect(recalculateNurseRatingAvg(fakeDb([]), NURSE)).resolves.toBeNull();
  });

  it('issues one parameterised statement that keeps every filter of the rule', async () => {
    const db = fakeDb([{ rating_avg: '0.00' }]);
    await recalculateNurseRatingAvg(db, NURSE);

    expect(db.calls).toHaveLength(1);
    expect(db.calls[0]!.params).toEqual([NURSE]);
    const sql = db.calls[0]!.text;
    expect(sql).toContain('r.is_visible');
    expect(sql).toContain("b.execution_status = 'COMPLETED'");
    expect(sql).toContain("r.reviewer_role = 'PATIENT'");
    expect(sql).not.toContain(NURSE); // never interpolated
  });
});
