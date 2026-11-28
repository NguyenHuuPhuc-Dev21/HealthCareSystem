/**
 * admin-users — Admin user management (BE-2 · Phase 7 · FR-ADMIN-01 "Quản lý Người dùng", SRS §2.3, CT-20).
 * Contract: docs/api/admin-users.api.md
 *
 *  GET   /admin/users                 search customers and nurses (name / email, phone, id), filter role / status
 *  GET   /admin/users/:id             detail: account, nurse profile, deposit / commission / TrustScore standing,
 *                                     reactivation blockers, booking counts, status history (from audit_logs)
 *  PATCH /admin/users/:id/status      ACTIVE / SUSPENDED / BANNED with a reason — audit CHANGE_ACCOUNT_STATUS
 *
 * Rules
 *  - Nurse: profile_status is the single source of truth for taking shifts. SUSPENDED keeps the account signed in
 *    (top up the deposit, pay commission); suspended_reason ADMIN_SUSPENDED is lifted only by an Admin.
 *    BANNED also sets users.status = BANNED (no sign-in) and revokes every session.
 *    Suspend / ban: future CONFIRMED shifts are released back to matching (no fee) and re-dispatched; running shifts
 *    are left alone and returned to the Admin.
 *    SUSPENDED → ACTIVE is refused while the deposit is short (outside the onboarding grace) or a cash commission is
 *    overdue; a TrustScore below TRUST_SUSPEND_BELOW needs waiveTrustScore (SRS: retraining done, Admin review).
 *    PENDING_VERIFICATION: only a BAN (forged documents); activation is credential-review's job.
 *  - Customer: users.status. SUSPENDED cannot create bookings (bookings checks it); BANNED cannot sign in, sessions
 *    are revoked, open bookings are returned to the Admin.
 *  - BANNED is permanent; Admin accounts and the Admin themself are not managed here.
 */
import {
  AuditAction,
  ProfileStatus,
  UserRole,
  type AdminSetStatusResult,
  type AdminSettableStatus,
  type AdminUserDetail,
  type AdminUserList,
  type AdminUserListItem,
  type ManagedRole,
} from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, notFound } from '../../core/errors';
import { jobs } from '../../core/jobs';
import { revokeAllSessionsForUser } from '../accounts-otp/accounts-otp.service';
import { notifyUser, sendNotices } from '../notifications/notifications.service';
import type { Notice, Notify } from '../notifications/notifications.types';
import { REDISPATCH_JOB, type RedispatchPayload } from '../tier-lifecycle/tier-lifecycle.types';
import {
  effectiveStatus,
  hardBlockers,
  maskCccd,
  reactivationBlockers,
  statusNotice,
  transitionProblem,
  type TransitionProblem,
} from './admin-users.policy';
import * as repo from './admin-users.repo';
import type { ListQuery, SetStatusBody } from './admin-users.schema';
import { ADMIN_BANNED_REASON, ADMIN_SUSPENDED_REASON, type BookingRef, type UserRow } from './admin-users.types';

export interface AdminUsersDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  scheduler: { scheduleJob<T>(jobName: string, payload: T, runAt: Date, idempotencyKey: string): Promise<unknown> };
  revokeSessions: (userId: string) => Promise<void>;
  notify?: Notify;
  now?: () => number;
}

const PROBLEMS: Record<TransitionProblem, { status: number; message: string }> = {
  TARGET_NOT_MANAGEABLE: { status: 403, message: 'Admin accounts (and your own) cannot be changed here' },
  BANNED_IS_PERMANENT: { status: 409, message: 'A banned account is locked permanently' },
  ALREADY_IN_STATUS: { status: 409, message: 'The account already has this status' },
  PROFILE_PENDING_VERIFICATION: {
    status: 409,
    message: 'The nurse is waiting for credential review: approve the dossier there, or ban the account',
  },
  NO_NURSE_PROFILE: { status: 409, message: 'This nurse has no profile yet' },
};

const ref = (b: BookingRef) => ({ id: b.id, bookingCode: b.booking_code });

export class AdminUsersService {
  constructor(private readonly deps: AdminUsersDeps) {}

  private now(): Date {
    return new Date((this.deps.now ?? Date.now)());
  }

  private toItem(u: UserRow): AdminUserListItem {
    return {
      id: u.id,
      role: u.role,
      fullName: u.full_name,
      phone: u.phone,
      email: u.email,
      status: effectiveStatus(u) as AdminUserListItem['status'],
      accountStatus: u.status,
      profileStatus: u.profile_status,
      suspendedReason: u.role === UserRole.NURSE ? u.suspended_reason : null,
      tier: u.tier,
      trustScore: u.trust_score,
      kycStatus: u.kyc_status,
      createdAt: new Date(u.created_at).toISOString(),
    };
  }

  /** GET /admin/users */
  async list(q: ListQuery): Promise<AdminUserList> {
    const { rows, total } = await repo.listUsers(this.deps.read, q);
    return { items: rows.map((u) => this.toItem(u)), total, limit: q.limit, offset: q.offset };
  }

  /** GET /admin/users/:id */
  async detail(id: string): Promise<AdminUserDetail> {
    const db = this.deps.read;
    const u = await repo.findUser(db, id);
    if (!u || u.role === UserRole.ADMIN) throw notFound('USER_NOT_FOUND', 'User not found');
    const isNurse = u.role === UserRole.NURSE && u.profile_status !== null;
    const [counts, history, standing] = await Promise.all([
      repo.bookingCounts(db, id),
      repo.statusHistory(db, id),
      isNurse ? repo.nurseStanding(db, id, this.now()) : Promise.resolve(null),
    ]);
    return {
      ...this.toItem(u),
      avatarUrl: u.avatar_url,
      cccdMasked: maskCccd(u.cccd_number),
      nurse:
        isNurse && standing
          ? {
              gphnNumber: u.gphn_number,
              gphnExpiryDate: u.gphn_expiry_date,
              yearsOfExp: u.years_of_exp ?? 0,
              ratingAvg: Number(u.rating_avg ?? 0),
              isOnline: u.is_online === true,
              depositBalance: standing.depositBalance,
              minDeposit: standing.minDeposit,
              overdueCommissionCount: standing.overdueCommissions,
              reactivationBlockers: reactivationBlockers(standing),
            }
          : null,
      bookings: counts,
      statusHistory: history.map((h) => ({
        at: new Date(h.created_at).toISOString(),
        actorId: h.actor_id,
        actorName: h.actor_name,
        from: h.old_value?.status ?? null,
        to: h.new_value?.status,
        reason: h.new_value?.reason ?? null,
      })),
    };
  }

  /** PATCH /admin/users/:id/status */
  async setStatus(adminId: string, id: string, body: SetStatusBody, ip?: string | null): Promise<AdminSetStatusResult> {
    const to = body.status as AdminSettableStatus;
    const now = this.now();
    const out = await this.deps.withTx(async (db) => {
      const u = await repo.lockUser(db, id);
      if (!u) throw notFound('USER_NOT_FOUND', 'User not found');
      const problem = transitionProblem(u, to, adminId);
      if (problem) throw new AppError(PROBLEMS[problem].status, problem, PROBLEMS[problem].message);

      const role = u.role as ManagedRole;
      const previous = effectiveStatus(u);
      let released: BookingRef[] = [];
      let running: BookingRef[] = [];
      let customerOpen: BookingRef[] = [];
      let waived = false;

      if (role === UserRole.NURSE && u.profile_status) {
        if (to === 'ACTIVE') {
          const blockers = reactivationBlockers(await repo.nurseStanding(db, id, now));
          const hard = hardBlockers(blockers, body.waiveTrustScore === true);
          if (hard.length > 0) {
            throw new AppError(409, 'REACTIVATION_BLOCKED', 'The cause of the suspension is not cleared yet', { blockers: hard });
          }
          waived = blockers.includes('TRUST_SCORE_BELOW_THRESHOLD');
          await repo.setProfileStatus(db, id, ProfileStatus.ACTIVE, null);
        } else {
          await repo.setProfileStatus(db, id, to, to === 'BANNED' ? ADMIN_BANNED_REASON : ADMIN_SUSPENDED_REASON);
          if (to === 'BANNED') await repo.setAccountStatus(db, id, 'BANNED');
          released = await repo.releaseFutureBookings(db, id, now);
          running = await repo.runningNurseBookings(db, id);
        }
      } else if (role === UserRole.NURSE) {
        // Nurse account without a profile yet (signed up, never onboarded): only a ban reaches here.
        await repo.setAccountStatus(db, id, 'BANNED');
      } else {
        await repo.setAccountStatus(db, id, to);
        if (to === 'BANNED') customerOpen = await repo.openCustomerBookings(db, id);
      }

      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.CHANGE_ACCOUNT_STATUS,
        targetTable: 'users',
        targetId: id,
        oldValue: { role, status: previous, accountStatus: u.status, profileStatus: u.profile_status, suspendedReason: u.suspended_reason },
        newValue: {
          role,
          status: to,
          reason: body.reason,
          ...(waived ? { trustScoreWaived: true } : {}),
          ...(released.length ? { releasedBookingIds: released.map((b) => b.id) } : {}),
        },
        ...(ip ? { ipAddress: ip.slice(0, 45) } : {}),
      });
      return { u, role, previous, released, running, customerOpen };
    });

    // After COMMIT: sessions, re-dispatch, notifications. A failure here never undoes the (audited) decision.
    let sessionsRevoked = false;
    if (to === 'BANNED') {
      try {
        await this.deps.revokeSessions(id);
        sessionsRevoked = true;
      } catch (err) {
        // refresh() also refuses a banned account, so the session dies at the next refresh at the latest
        console.error(`[admin-users] could not revoke sessions of ${id}: ${(err as Error).message}`);
      }
    }
    for (const b of out.released) {
      const payload: RedispatchPayload = {
        bookingId: b.id,
        reason: to === 'BANNED' ? 'NURSE_BANNED' : 'NURSE_SUSPENDED',
        releasedNurseId: id,
        matchingMode: b.matching_mode as RedispatchPayload['matchingMode'],
      };
      try {
        await this.deps.scheduler.scheduleJob(REDISPATCH_JOB, payload, now, `redispatch:${b.id}:${id}`);
      } catch (err) {
        console.error(`[admin-users] could not schedule redispatch for booking ${b.id}: ${(err as Error).message}`);
      }
    }
    const notices: Notice[] = [
      { userId: id, type: `ACCOUNT_${to}`, ...statusNotice(to, out.role, body.reason), data: { status: to } },
      ...out.released.map((b) => ({
        userId: b.customer_id,
        bookingId: b.id,
        type: 'BOOKING_REDISPATCHED',
        title: `Đang tìm điều dưỡng thay thế cho đơn ${b.booking_code}`,
        body: 'Điều dưỡng trước không thể thực hiện ca này. Hệ thống đang tìm người thay, bạn không mất phí.',
        data: { bookingId: b.id },
      })),
    ];
    await sendNotices(this.deps.notify, notices);

    return {
      updated: true,
      userId: id,
      role: out.role,
      previousStatus: out.previous,
      status: to,
      sessionsRevoked,
      releasedBookings: out.released.map(ref),
      inProgressBookings: out.running.map(ref),
      openCustomerBookings: out.customerOpen.map((b) => ({ ...ref(b), executionStatus: b.execution_status })),
    };
  }
}

let singleton: AdminUsersService | null = null;

export function getAdminUsersService(): AdminUsersService {
  if (!singleton) {
    singleton = new AdminUsersService({
      read: getPool(),
      withTx: (fn) => withTransaction(fn),
      scheduler: jobs,
      revokeSessions: revokeAllSessionsForUser,
      notify: notifyUser,
    });
  }
  return singleton;
}
