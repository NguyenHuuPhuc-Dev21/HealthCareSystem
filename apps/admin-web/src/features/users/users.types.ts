/**
 * Quản lý người dùng (FR-ADMIN-01, CT-20) — khớp docs/api/admin-users.api.md.
 * `status` là trạng thái QUYẾT ĐỊNH theo vai trò: điều dưỡng → `profile_status` (nguồn duy nhất cho quyền nhận ca),
 * khách → `users.status`. Tài khoản Admin không bao giờ xuất hiện trong danh sách.
 */

export type ManagedRole = 'PATIENT' | 'NURSE';
export type UserStatus = 'PENDING' | 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';
export type ChangeableStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export type SuspendedReason =
  | 'DEPOSIT_SHORTFALL'
  | 'COMMISSION_OVERDUE'
  | 'TRUST_SCORE_BELOW_THRESHOLD'
  | 'ADMIN_SUSPENDED'
  | 'ADMIN_BANNED';

export type ReactivationBlocker = 'DEPOSIT_SHORTFALL' | 'COMMISSION_OVERDUE' | 'TRUST_SCORE_BELOW_THRESHOLD';

export interface AdminUserItem {
  id: string;
  role: ManagedRole;
  fullName: string;
  phone: string;
  email: string | null;
  status: UserStatus;
  accountStatus: string;
  profileStatus: string | null;
  suspendedReason: SuspendedReason | null;
  tier: 'TIER_1_BASIC' | 'TIER_2_SPECIALIST' | null;
  trustScore: number | null;
  kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
  createdAt: string;
}

export interface UserList {
  items: AdminUserItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface StatusHistoryEntry {
  at: string;
  actorId: string;
  actorName: string;
  from: UserStatus;
  to: UserStatus;
  reason: string;
}

export interface AdminUserDetail extends AdminUserItem {
  avatarUrl: string | null;
  cccdMasked: string | null;
  bookings: { total: number; open: number; inProgress: number };
  statusHistory: StatusHistoryEntry[];
  nurse?: {
    gphnNumber: string | null;
    gphnExpiryDate: string | null;
    yearsOfExp: number | null;
    ratingAvg: number | null;
    isOnline: boolean;
    depositBalance: number;
    minDeposit: number;
    overdueCommissionCount: number;
    reactivationBlockers: ReactivationBlocker[];
  };
}

export interface BookingRef {
  id: string;
  bookingCode: string;
}

export interface ChangeStatusResult {
  updated: boolean;
  userId: string;
  role: ManagedRole;
  previousStatus: UserStatus;
  status: UserStatus;
  sessionsRevoked: boolean;
  releasedBookings: BookingRef[];
  inProgressBookings: BookingRef[];
  openCustomerBookings: BookingRef[];
}

export interface UserSearchParams {
  q?: string;
  role?: ManagedRole | '';
  status?: UserStatus | '';
  limit?: number;
  offset?: number;
}

export const REASON_MIN = 5;
export const REASON_MAX = 500;

export const STATUS_LABEL: Record<UserStatus, { text: string; tone: 'teal' | 'amber' | 'red' | '' }> = {
  ACTIVE: { text: 'Đang hoạt động', tone: 'teal' },
  PENDING: { text: 'Chờ kích hoạt', tone: 'amber' },
  PENDING_VERIFICATION: { text: 'Chờ thẩm định hồ sơ', tone: 'amber' },
  SUSPENDED: { text: 'Tạm khoá', tone: 'amber' },
  BANNED: { text: 'Đã cấm vĩnh viễn', tone: 'red' },
};

export const SUSPENDED_REASON_LABEL: Record<SuspendedReason, string> = {
  DEPOSIT_SHORTFALL: 'Ký quỹ thấp hơn mức tối thiểu',
  COMMISSION_OVERDUE: 'Nợ hoa hồng tiền mặt quá 24 giờ',
  TRUST_SCORE_BELOW_THRESHOLD: 'TrustScore dưới ngưỡng cho phép',
  ADMIN_SUSPENDED: 'Admin tạm khoá',
  ADMIN_BANNED: 'Admin cấm vĩnh viễn',
};

export const BLOCKER_LABEL: Record<ReactivationBlocker, string> = {
  DEPOSIT_SHORTFALL: 'Ký quỹ chưa đủ mức tối thiểu — điều dưỡng cần nạp thêm',
  COMMISSION_OVERDUE: 'Còn hoa hồng tiền mặt quá hạn chưa nộp',
  TRUST_SCORE_BELOW_THRESHOLD: 'TrustScore đang dưới ngưỡng (có thể miễn nếu đã đào tạo lại)',
};

export const ROLE_LABEL: Record<ManagedRole, string> = { PATIENT: 'Khách hàng', NURSE: 'Điều dưỡng' };
