import { describe, expect, it } from 'vitest';
import {
  classifyQuery,
  effectiveStatus,
  hardBlockers,
  maskCccd,
  reactivationBlockers,
  statusNotice,
  transitionProblem,
} from '../../src/modules/admin-users/admin-users.policy';
import { listQuerySchema, setStatusSchema } from '../../src/modules/admin-users/admin-users.schema';

const ADMIN = 'a0000000-0000-4000-8000-000000000001';
const nurse = (profile_status: any, status: any = 'ACTIVE') => ({ id: 'n1', role: 'NURSE' as any, status, profile_status, suspended_reason: null });
const customer = (status: any) => ({ id: 'c1', role: 'PATIENT' as any, status, profile_status: null, suspended_reason: null });

describe('admin-users policy (FR-ADMIN-01, SRS §2.3)', () => {
  it('the status that matters: nurse profile for a nurse, account otherwise', () => {
    expect(effectiveStatus(nurse('SUSPENDED', 'ACTIVE'))).toBe('SUSPENDED');
    expect(effectiveStatus(customer('SUSPENDED'))).toBe('SUSPENDED');
    expect(effectiveStatus({ role: 'NURSE' as any, status: 'ACTIVE' as any, profile_status: null })).toBe('ACTIVE');
  });

  it('transitions: BANNED is permanent, PENDING_VERIFICATION only to BANNED, Admins and self are off limits', () => {
    expect(transitionProblem(nurse('ACTIVE'), 'SUSPENDED', ADMIN)).toBe(null);
    expect(transitionProblem(nurse('SUSPENDED'), 'ACTIVE', ADMIN)).toBe(null);
    expect(transitionProblem(nurse('ACTIVE'), 'BANNED', ADMIN)).toBe(null);
    expect(transitionProblem(nurse('ACTIVE'), 'ACTIVE', ADMIN)).toBe('ALREADY_IN_STATUS');
    expect(transitionProblem(nurse('BANNED', 'BANNED'), 'ACTIVE', ADMIN)).toBe('BANNED_IS_PERMANENT');
    expect(transitionProblem(nurse('ACTIVE', 'BANNED'), 'ACTIVE', ADMIN)).toBe('BANNED_IS_PERMANENT');
    expect(transitionProblem(nurse('PENDING_VERIFICATION'), 'ACTIVE', ADMIN)).toBe('PROFILE_PENDING_VERIFICATION');
    expect(transitionProblem(nurse('PENDING_VERIFICATION'), 'BANNED', ADMIN)).toBe(null);
    expect(transitionProblem(nurse(null), 'SUSPENDED', ADMIN)).toBe('NO_NURSE_PROFILE');
    expect(transitionProblem(nurse(null), 'BANNED', ADMIN)).toBe(null);
    expect(transitionProblem(customer('PENDING'), 'ACTIVE', ADMIN)).toBe(null);
    expect(transitionProblem(customer('SUSPENDED'), 'SUSPENDED', ADMIN)).toBe('ALREADY_IN_STATUS');
    expect(transitionProblem({ ...customer('ACTIVE'), role: 'ADMIN' as any }, 'SUSPENDED', ADMIN)).toBe('TARGET_NOT_MANAGEABLE');
    expect(transitionProblem({ ...customer('ACTIVE'), id: ADMIN }, 'SUSPENDED', ADMIN)).toBe('TARGET_NOT_MANAGEABLE');
  });

  it('reactivation blockers: deposit (grace counts), overdue commission, TrustScore — only the last can be waived', () => {
    const ok = { depositBalance: 300_000, inGrace: false, minDeposit: 300_000, overdueCommissions: 0, trustScore: 60, trustThreshold: 60 };
    expect(reactivationBlockers(ok)).toEqual([]);
    expect(reactivationBlockers({ ...ok, depositBalance: 100_000, inGrace: true })).toEqual([]);
    const all = reactivationBlockers({ ...ok, depositBalance: -50_000, overdueCommissions: 2, trustScore: 59 });
    expect(all).toEqual(['DEPOSIT_SHORTFALL', 'COMMISSION_OVERDUE', 'TRUST_SCORE_BELOW_THRESHOLD']);
    expect(hardBlockers(all, true)).toEqual(['DEPOSIT_SHORTFALL', 'COMMISSION_OVERDUE']);
    expect(hardBlockers(['TRUST_SCORE_BELOW_THRESHOLD'], true)).toEqual([]);
    expect(hardBlockers(['TRUST_SCORE_BELOW_THRESHOLD'], false)).toEqual(['TRUST_SCORE_BELOW_THRESHOLD']);
  });

  it('search text, CCCD mask, notices', () => {
    expect(classifyQuery('  ')).toBe(null);
    expect(classifyQuery('0905 123 456')).toEqual({ kind: 'phone', value: '0905123456' });
    expect(classifyQuery('+84905123456')).toEqual({ kind: 'phone', value: '0905123456' });
    expect(classifyQuery('A0000000-0000-4000-8000-000000000001')).toEqual({ kind: 'id', value: ADMIN });
    expect(classifyQuery('Nguyễn Thị Hoa')).toEqual({ kind: 'text', value: 'Nguyễn Thị Hoa' });
    expect(maskCccd('079201001234')).toBe('••••••••1234');
    expect(maskCccd(null)).toBe(null);
    expect(statusNotice('SUSPENDED', 'NURSE', 'thiếu cọc').body).toContain('không thể nhận ca mới');
    expect(statusNotice('SUSPENDED', 'PATIENT', 'x').body).toContain('không thể đặt ca mới');
    expect(statusNotice('BANNED', 'NURSE', 'giả mạo GPHN').body).toContain('giả mạo GPHN');
  });

  it('schemas: reason 5–500 characters, only ACTIVE / SUSPENDED / BANNED, list limit ≤ 100', () => {
    expect(setStatusSchema.safeParse({ status: 'BANNED', reason: 'No-show ca HC-1' }).success).toBe(true);
    expect(setStatusSchema.safeParse({ status: 'BANNED', reason: 'ngắn' }).success).toBe(false);
    expect(setStatusSchema.safeParse({ status: 'PENDING', reason: 'không hợp lệ' }).success).toBe(false);
    expect(setStatusSchema.safeParse({ status: 'ACTIVE', reason: 'Đào tạo lại xong', waiveTrustScore: true }).success).toBe(true);
    expect(setStatusSchema.safeParse({ status: 'ACTIVE', reason: 'Đào tạo lại xong', role: 'ADMIN' }).success).toBe(false);
    expect(listQuerySchema.parse({})).toEqual({ limit: 50, offset: 0 });
    expect(listQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
    expect(listQuerySchema.parse({ role: 'NURSE', status: 'SUSPENDED', limit: '20' })).toMatchObject({ role: 'NURSE', status: 'SUSPENDED', limit: 20 });
  });
});
