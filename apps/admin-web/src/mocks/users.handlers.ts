/**
 * Mock quản lý người dùng — khớp docs/api/admin-users.api.md:
 *   GET   /admin/users?q&role&status&limit&offset   → { items, total, limit, offset }
 *   GET   /admin/users/:id                          → chi tiết + statusHistory (+ nurse{…reactivationBlockers})
 *   PATCH /admin/users/:id/status { status, reason, waiveTrustScore? }
 *     lỗi: 400 VALIDATION_ERROR · 404 USER_NOT_FOUND · 409 BANNED_IS_PERMANENT | ALREADY_IN_STATUS |
 *          PROFILE_PENDING_VERIFICATION | REACTIVATION_BLOCKED (details.blockers)
 */

import type { AdminUserDetail, ReactivationBlocker, UserStatus } from '../features/users/users.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData } from './mock-db';

const MIN_DEPOSIT = 300_000;
const TRUST_SUSPEND_BELOW = 60;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

type Rec = AdminUserDetail & { openBookings: string[]; runningBookings: string[] };

function nurse(id: string, name: string, phone: string, p: Partial<Rec> & { deposit?: number; overdue?: number; trust?: number; createdDaysAgo?: number }): Rec {
  const trust = p.trust ?? 95;
  const deposit = p.deposit ?? 450_000;
  const overdue = p.overdue ?? 0;
  const status = (p.status ?? 'ACTIVE') as UserStatus;
  return {
    id, role: 'NURSE', fullName: name, phone, email: null, status, accountStatus: status === 'BANNED' ? 'BANNED' : 'ACTIVE',
    profileStatus: status === 'PENDING_VERIFICATION' ? 'PENDING_VERIFICATION' : status, suspendedReason: p.suspendedReason ?? null,
    tier: p.tier ?? 'TIER_2_SPECIALIST', trustScore: trust, kycStatus: 'VERIFIED', createdAt: iso(p.createdDaysAgo ?? 90),
    avatarUrl: null, cccdMasked: '••••••••' + phone.slice(-4), bookings: { total: 24, open: 1, inProgress: 0 }, statusHistory: p.statusHistory ?? [],
    nurse: {
      gphnNumber: 'GPHN-' + id.slice(-4).toUpperCase(), gphnExpiryDate: '2027-05-01', yearsOfExp: 6, ratingAvg: 4.7, isOnline: false,
      depositBalance: deposit, minDeposit: MIN_DEPOSIT, overdueCommissionCount: overdue, reactivationBlockers: [],
    },
    openBookings: p.openBookings ?? [], runningBookings: p.runningBookings ?? [],
  } as Rec;
}

function patient(id: string, name: string, phone: string, p: Partial<Rec> = {}): Rec {
  const status = (p.status ?? 'ACTIVE') as UserStatus;
  return {
    id, role: 'PATIENT', fullName: name, phone, email: p.email ?? null, status, accountStatus: status, profileStatus: null, suspendedReason: null,
    tier: null, trustScore: null, kycStatus: p.kycStatus ?? 'VERIFIED', createdAt: iso(60), avatarUrl: null, cccdMasked: '••••••••' + phone.slice(-4),
    bookings: { total: 8, open: 1, inProgress: 0 }, statusHistory: p.statusHistory ?? [], openBookings: p.openBookings ?? [], runningBookings: [],
  } as Rec;
}

function seed(): Rec[] {
  return [
    nurse('n-0001', 'Trần Thị Mai', '0909888777', { createdDaysAgo: 200 }),
    nurse('n-0002', 'Phạm Thu Hà', '0905123401', { createdDaysAgo: 120, openBookings: ['HC-261201-AB12CD', 'HC-261203-QW98ER'], runningBookings: ['HC-261125-XY34ZW'] }),
    nurse('n-0003', 'Nguyễn Văn Hùng', '0905123402', { tier: 'TIER_1_BASIC', status: 'SUSPENDED', suspendedReason: 'DEPOSIT_SHORTFALL', deposit: 120_000, createdDaysAgo: 80,
      statusHistory: [{ at: iso(3), actorId: 'system', actorName: 'Hệ thống', from: 'ACTIVE', to: 'SUSPENDED', reason: 'Ký quỹ xuống dưới mức tối thiểu sau khi trừ phạt SLA.' }] }),
    nurse('n-0004', 'Lê Thị Lan', '0905123403', { tier: 'TIER_1_BASIC', status: 'SUSPENDED', suspendedReason: 'TRUST_SCORE_BELOW_THRESHOLD', trust: 52, createdDaysAgo: 70,
      statusHistory: [{ at: iso(6), actorId: 'system', actorName: 'Hệ thống', from: 'ACTIVE', to: 'SUSPENDED', reason: 'TrustScore xuống 52 (< 60).' }] }),
    nurse('n-0005', 'Võ Minh Tâm', '0905123404', { status: 'SUSPENDED', suspendedReason: 'COMMISSION_OVERDUE', overdue: 1, createdDaysAgo: 150 }),
    nurse('n-0006', 'Đặng Thị Bích', '0905123405', { status: 'PENDING_VERIFICATION', tier: 'TIER_1_BASIC', trust: 100, createdDaysAgo: 1 }),
    nurse('n-0007', 'Hoàng Văn Phúc', '0905123406', { status: 'BANNED', suspendedReason: 'ADMIN_BANNED', createdDaysAgo: 300,
      statusHistory: [{ at: iso(30), actorId: 'u-admin', actorName: 'Admin vận hành', from: 'ACTIVE', to: 'BANNED', reason: 'Không đến ca (no-show) và không tìm được người thay.' }] }),
    patient('p-0001', 'Nguyễn Văn An', '0905123456', { email: 'an.nguyen@example.com', openBookings: ['HC-261210-AA11BB'] }),
    patient('p-0002', 'Nguyễn Thị Hoa', '0905777001'),
    patient('p-0003', 'Trần Quốc Việt', '0905777002', { kycStatus: 'PENDING' }),
    patient('p-0004', 'Lý Thị Thu', '0905777003', { status: 'SUSPENDED',
      statusHistory: [{ at: iso(10), actorId: 'u-admin', actorName: 'Admin vận hành', from: 'ACTIVE', to: 'SUSPENDED', reason: 'Khai báo sai tình trạng người bệnh nhiều lần; chờ làm việc với gia đình.' }] }),
    patient('p-0005', 'Phan Văn Dũng', '0905777004', { status: 'BANNED' }),
  ];
}

const load = (): Rec[] => getUserData<Rec[]>('admin', 'users', seed());
const save = (list: Rec[]) => setUserData('admin', 'users', list);

function blockersOf(r: Rec): ReactivationBlocker[] {
  if (r.role !== 'NURSE' || !r.nurse) return [];
  const b: ReactivationBlocker[] = [];
  if (r.nurse.depositBalance < r.nurse.minDeposit) b.push('DEPOSIT_SHORTFALL');
  if (r.nurse.overdueCommissionCount > 0) b.push('COMMISSION_OVERDUE');
  if ((r.trustScore ?? 100) < TRUST_SUSPEND_BELOW) b.push('TRUST_SCORE_BELOW_THRESHOLD');
  return b;
}

function view(r: Rec): AdminUserDetail {
  const { openBookings: _o, runningBookings: _r, ...rest } = r;
  return { ...rest, nurse: r.nurse ? { ...r.nurse, reactivationBlockers: r.status === 'SUSPENDED' ? blockersOf(r) : [] } : undefined };
}

const unauthorized = () => fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
const hasToken = (h: Headers) => (h.get('Authorization') ?? '').startsWith('Bearer ');

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const usersHandlers: Record<string, MockHandler> = {
  'GET /api/v1/admin/users': (_b, { headers, query }) => {
    if (!hasToken(headers)) return unauthorized();
    const q = (query.get('q') ?? '').trim();
    const role = query.get('role');
    const status = query.get('status');
    const limit = Math.min(Math.max(Number(query.get('limit')) || 50, 1), 100);
    const offset = Math.max(Number(query.get('offset')) || 0, 0);
    const digits = q.replace(/[\s.+]/g, '').replace(/^84/, '0');
    const rows = load()
      .filter((r) => (!role || r.role === role) && (!status || r.status === status))
      .filter((r) => !q || norm(r.fullName).includes(norm(q)) || r.phone.includes(digits) || r.id === q || (r.email ?? '').toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return ok({ items: rows.slice(offset, offset + limit).map((r) => ({ ...view(r), statusHistory: undefined, nurse: undefined, bookings: undefined })), total: rows.length, limit, offset });
  },

  'GET /api/v1/admin/users/:id': (_b, { headers, params }) => {
    if (!hasToken(headers)) return unauthorized();
    const r = load().find((x) => x.id === params.id);
    return r ? ok(view(r)) : fail(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng.');
  },

  'PATCH /api/v1/admin/users/:id/status': (body: { status?: string; reason?: string; waiveTrustScore?: boolean }, { headers, params }) => {
    if (!hasToken(headers)) return unauthorized();
    const list = load();
    const i = list.findIndex((x) => x.id === params.id);
    if (i < 0) return fail(404, 'USER_NOT_FOUND', 'Không tìm thấy người dùng.');
    const r = list[i];

    const reason = (body?.reason ?? '').trim();
    if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(body?.status ?? '') || reason.length < 5 || reason.length > 500) {
      return fail(400, 'VALIDATION_ERROR', 'Trạng thái không hợp lệ hoặc lý do ngoài khoảng 5–500 ký tự.');
    }
    const to = body.status as UserStatus;
    if (r.status === 'BANNED') return fail(409, 'BANNED_IS_PERMANENT', 'Tài khoản đã bị cấm vĩnh viễn, không thể thay đổi.');
    if (r.status === to) return fail(409, 'ALREADY_IN_STATUS', 'Tài khoản đã ở trạng thái này.');
    if (r.status === 'PENDING_VERIFICATION' && to !== 'BANNED') {
      return fail(409, 'PROFILE_PENDING_VERIFICATION', 'Hồ sơ đang chờ thẩm định — hãy duyệt ở mục "Duyệt hồ sơ" hoặc cấm.');
    }
    if (r.role === 'NURSE' && r.status === 'SUSPENDED' && to === 'ACTIVE') {
      const blockers = blockersOf(r).filter((b) => !(b === 'TRUST_SCORE_BELOW_THRESHOLD' && body.waiveTrustScore));
      if (blockers.length) return fail(409, 'REACTIVATION_BLOCKED', 'Chưa thể kích hoạt lại: còn điều kiện chưa đạt.', { blockers });
    }

    const takingAway = to !== 'ACTIVE';
    const next: Rec = {
      ...r, status: to, accountStatus: to === 'BANNED' ? 'BANNED' : r.accountStatus, profileStatus: r.role === 'NURSE' ? to : null,
      suspendedReason: to === 'SUSPENDED' ? 'ADMIN_SUSPENDED' : to === 'BANNED' ? 'ADMIN_BANNED' : null,
      trustScore: r.role === 'NURSE' && to === 'ACTIVE' && body.waiveTrustScore && (r.trustScore ?? 100) < TRUST_SUSPEND_BELOW ? TRUST_SUSPEND_BELOW : r.trustScore,
      statusHistory: [{ at: new Date().toISOString(), actorId: 'u-admin', actorName: 'Admin vận hành', from: r.status, to, reason }, ...r.statusHistory],
    };
    list[i] = next;
    save(list);

    return ok({
      updated: true, userId: r.id, role: r.role, previousStatus: r.status, status: to, sessionsRevoked: to === 'BANNED',
      releasedBookings: r.role === 'NURSE' && takingAway ? r.openBookings.map((c, n) => ({ id: `b-${r.id}-${n}`, bookingCode: c })) : [],
      inProgressBookings: r.role === 'NURSE' && takingAway ? r.runningBookings.map((c, n) => ({ id: `r-${r.id}-${n}`, bookingCode: c })) : [],
      openCustomerBookings: r.role === 'PATIENT' && to === 'BANNED' ? r.openBookings.map((c, n) => ({ id: `c-${r.id}-${n}`, bookingCode: c })) : [],
    });
  },
};
