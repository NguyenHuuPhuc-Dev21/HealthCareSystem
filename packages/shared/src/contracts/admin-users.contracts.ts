/**
 * Admin — user management (BE-2 · Phase 7 · FR-ADMIN-01 "Quản lý Người dùng"). Contract: docs/api/admin-users.api.md
 *
 * Two statuses exist and they mean different things:
 *  - accountStatus  = users.status          — can the person sign in (BANNED = no) / book (customer SUSPENDED = no)
 *  - profileStatus  = nurse_profiles.profile_status — the ONLY source of truth for a nurse's right to take shifts
 * `status` below is the one that matters for the role: profileStatus for a nurse, accountStatus otherwise.
 */
import type { NurseTier, ProfileStatus, UserRole, UserStatus } from '../enums';

export type ManagedRole = 'PATIENT' | 'NURSE';

/** Status an Admin may set. PENDING / PENDING_VERIFICATION are never set by hand (eKYC / credential review). */
export type AdminSettableStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

/** Why a nurse cannot be reactivated yet (all must be cleared first, except the trust score which an Admin may waive). */
export type ReactivationBlocker = 'DEPOSIT_SHORTFALL' | 'COMMISSION_OVERDUE' | 'TRUST_SCORE_BELOW_THRESHOLD';

/** GET /admin/users — one row. */
export interface AdminUserListItem {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  email: string | null;
  status: UserStatus | ProfileStatus;
  accountStatus: UserStatus;
  profileStatus: ProfileStatus | null;
  suspendedReason: string | null;
  tier: NurseTier | null;
  trustScore: number | null;
  kycStatus: string;
  createdAt: string;
}

export interface AdminUserList {
  items: AdminUserListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminStatusHistoryEntry {
  at: string;
  actorId: string | null;
  actorName: string | null;
  from: string | null;
  to: string;
  reason: string | null;
}

/** GET /admin/users/:id */
export interface AdminUserDetail extends AdminUserListItem {
  avatarUrl: string | null;
  cccdMasked: string | null; // only the last 4 digits
  nurse: {
    gphnNumber: string | null;
    gphnExpiryDate: string | null;
    yearsOfExp: number;
    ratingAvg: number;
    isOnline: boolean;
    depositBalance: number;
    minDeposit: number;
    overdueCommissionCount: number;
    reactivationBlockers: ReactivationBlocker[];
  } | null;
  bookings: { total: number; open: number; inProgress: number };
  statusHistory: AdminStatusHistoryEntry[];
}

/** PATCH /admin/users/:id/status */
export interface AdminSetStatusInput {
  status: AdminSettableStatus;
  reason: string; // 5–500 characters, stored in audit_logs
  /** Reactivating a nurse whose TrustScore is below the threshold (SRS: after retraining, Admin review). */
  waiveTrustScore?: boolean;
}

export interface AdminSetStatusResult {
  updated: true;
  userId: string;
  role: ManagedRole;
  previousStatus: string;
  status: AdminSettableStatus;
  sessionsRevoked: boolean;
  /** Nurse suspended/banned: future CONFIRMED shifts taken off the nurse and sent back to matching (no fee). */
  releasedBookings: Array<{ id: string; bookingCode: string }>;
  /** Shifts already running — left as they are, the Admin follows them up. */
  inProgressBookings: Array<{ id: string; bookingCode: string }>;
  /** Customer banned: bookings still open (not completed / cancelled) for the Admin to follow up. */
  openCustomerBookings: Array<{ id: string; bookingCode: string; executionStatus: string }>;
}
