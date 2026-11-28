import { describe, expect, it } from 'vitest';
import { nurseCancelProblem, nurseFineKey } from '../../src/modules/cancellation-policy/cancellation-policy.nurse';
import { nurseCancelSchema } from '../../src/modules/cancellation-policy/cancellation-policy.nurse.routes';

/** Nurse gives back an accepted shift (SRS §5.2 rows 6–7) — who and when (unit). */
describe('cancellation-policy — nurse cancel rules (unit)', () => {
  const NOW = Date.UTC(2029, 0, 10, 0, 0, 0);
  const b = (over: Partial<{ nurse_id: string | null; execution_status: string; start_time: Date }> = {}) => ({
    nurse_id: 'n1',
    execution_status: 'CONFIRMED',
    start_time: new Date(NOW + 3_600_000),
    ...over,
  });
  const code = (e: ReturnType<typeof nurseCancelProblem>) => e && [e.status, e.code];

  it('the assigned nurse may give back a CONFIRMED booking before it starts', () => {
    expect(nurseCancelProblem(b(), 'n1', NOW)).toBeNull();
  });

  it('anyone else: 404 (no existence leak)', () => {
    expect(code(nurseCancelProblem(b(), 'n2', NOW))).toEqual([404, 'BOOKING_NOT_FOUND']);
    expect(code(nurseCancelProblem(b({ nurse_id: null }), 'n1', NOW))).toEqual([404, 'BOOKING_NOT_FOUND']);
  });

  it('started or not confirmed: refused', () => {
    expect(code(nurseCancelProblem(b({ start_time: new Date(NOW) }), 'n1', NOW))).toEqual([422, 'SHIFT_ALREADY_STARTED']);
    expect(code(nurseCancelProblem(b({ execution_status: 'IN_PROGRESS' }), 'n1', NOW))).toEqual([409, 'SHIFT_IN_PROGRESS']);
    for (const s of ['MATCHING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DRAFT']) {
      expect(code(nurseCancelProblem(b({ execution_status: s }), 'n1', NOW))).toEqual([409, 'BOOKING_NOT_CANCELLABLE']);
    }
  });

  it('the fine key is per booking AND nurse', () => {
    expect(nurseFineKey('b1', 'n1')).not.toBe(nurseFineKey('b1', 'n2'));
    const uuid = '00000000-0000-4000-8000-000000000000';
    expect(nurseFineKey(uuid, uuid).length).toBeLessThanOrEqual(100); // wallet_transactions.idempotency_key VARCHAR(100)
  });

  it('reason is required, ≤ 500, strict body', () => {
    expect(nurseCancelSchema.safeParse({ reason: 'Ốm' }).success).toBe(true);
    expect(nurseCancelSchema.safeParse({ reason: '  ' }).success).toBe(false);
    expect(nurseCancelSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
    expect(nurseCancelSchema.safeParse({ reason: 'Ốm', fine: 0 }).success).toBe(false);
  });
});
