/**
 * admin-users — pure rules (BE-2 · Phase 7 · FR-ADMIN-01, SRS §2.3 nurse lifecycle, CT-20).
 *
 * SRS §2.3: ACTIVE ↔ SUSPENDED, ACTIVE/SUSPENDED → BANNED ("khóa vĩnh viễn"). SUSPENDED → ACTIVE once the cause is
 * cleared (deposit topped up, overdue 15% commission paid, retraining done) "và được Admin xem xét mở khóa".
 * nurse_profiles.profile_status is the only thing that decides whether a nurse may take shifts.
 */
import { ProfileStatus, UserRole, UserStatus, type AdminSettableStatus, type ReactivationBlocker } from '@healthcare-system/shared';
import type { NurseStanding, UserRow } from './admin-users.types';

export type TransitionProblem =
  | 'TARGET_NOT_MANAGEABLE' // Admin account or yourself
  | 'BANNED_IS_PERMANENT'
  | 'ALREADY_IN_STATUS'
  | 'PROFILE_PENDING_VERIFICATION' // only a BAN is possible before credential review
  | 'NO_NURSE_PROFILE';

/** The status that matters for this account: the nurse profile for a nurse, the account otherwise. */
export function effectiveStatus(u: Pick<UserRow, 'role' | 'status' | 'profile_status'>): string {
  return u.role === UserRole.NURSE && u.profile_status ? u.profile_status : u.status;
}

export function transitionProblem(
  u: Pick<UserRow, 'id' | 'role' | 'status' | 'profile_status' | 'suspended_reason'>,
  to: AdminSettableStatus,
  adminId: string,
): TransitionProblem | null {
  if (u.role === UserRole.ADMIN || u.id === adminId) return 'TARGET_NOT_MANAGEABLE';
  if (u.status === UserStatus.BANNED || u.profile_status === ProfileStatus.BANNED) return 'BANNED_IS_PERMANENT';
  if (u.role === UserRole.NURSE) {
    if (!u.profile_status) return to === 'BANNED' ? null : 'NO_NURSE_PROFILE';
    if (u.profile_status === ProfileStatus.PENDING_VERIFICATION && to !== 'BANNED') return 'PROFILE_PENDING_VERIFICATION';
    if (u.profile_status === to) return 'ALREADY_IN_STATUS';
    return null;
  }
  // Customer: a PENDING account may be activated, suspended or banned.
  if (u.status === to) return 'ALREADY_IN_STATUS';
  return null;
}

/**
 * Blockers to put a SUSPENDED nurse back to ACTIVE. The deposit (with the onboarding grace) and the overdue cash
 * commission are hard rules; a low TrustScore can be waived by the Admin (SRS: after retraining).
 */
export function reactivationBlockers(s: NurseStanding): ReactivationBlocker[] {
  const out: ReactivationBlocker[] = [];
  if (s.depositBalance < s.minDeposit && !s.inGrace) out.push('DEPOSIT_SHORTFALL');
  if (s.overdueCommissions > 0) out.push('COMMISSION_OVERDUE');
  if (s.trustScore < s.trustThreshold) out.push('TRUST_SCORE_BELOW_THRESHOLD');
  return out;
}

export function hardBlockers(blockers: ReactivationBlocker[], waiveTrustScore: boolean): ReactivationBlocker[] {
  return waiveTrustScore ? blockers.filter((b) => b !== 'TRUST_SCORE_BELOW_THRESHOLD') : blockers;
}

/** "079…1234" → "••••••••1234": the Admin list never needs the full CCCD. */
export function maskCccd(cccd: string | null): string | null {
  if (!cccd) return null;
  return `${'•'.repeat(Math.max(0, cccd.length - 4))}${cccd.slice(-4)}`;
}

/** Search text: digits → phone, uuid → id, anything else → name / email. */
export function classifyQuery(q: string | undefined): { kind: 'phone' | 'id' | 'text'; value: string } | null {
  const v = (q ?? '').trim();
  if (!v) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return { kind: 'id', value: v.toLowerCase() };
  const digits = v.replace(/[\s.+-]/g, '');
  if (/^\d{3,15}$/.test(digits)) return { kind: 'phone', value: digits.startsWith('84') ? `0${digits.slice(2)}` : digits };
  return { kind: 'text', value: v };
}

const NOTICE: Record<AdminSettableStatus, { title: string; body: (reason: string, role: string) => string }> = {
  SUSPENDED: {
    title: 'Tài khoản của bạn đã bị tạm khóa',
    body: (reason, role) =>
      role === UserRole.NURSE
        ? `Bạn tạm thời không thể nhận ca mới. Lý do: ${reason}. Liên hệ bộ phận hỗ trợ để được xem xét mở khóa.`
        : `Bạn tạm thời không thể đặt ca mới. Lý do: ${reason}. Liên hệ bộ phận hỗ trợ để được hỗ trợ.`,
  },
  ACTIVE: {
    title: 'Tài khoản của bạn đã được mở khóa',
    body: (_reason, role) => (role === UserRole.NURSE ? 'Bạn có thể nhận ca trở lại.' : 'Bạn có thể đặt ca trở lại.'),
  },
  BANNED: {
    title: 'Tài khoản của bạn đã bị khóa vĩnh viễn',
    body: (reason) => `Lý do: ${reason}. Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ bộ phận hỗ trợ.`,
  },
};

export function statusNotice(to: AdminSettableStatus, role: string, reason: string): { title: string; body: string } {
  return { title: NOTICE[to].title, body: NOTICE[to].body(reason, role) };
}
