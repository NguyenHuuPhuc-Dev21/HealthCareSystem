/**
 * admin-users — types (BE-2 · Phase 7 · FR-ADMIN-01). Public shapes live in packages/shared (admin-users.contracts).
 */
import type { NurseTier, ProfileStatus, UserRole, UserStatus } from '@healthcare-system/shared';

/** suspended_reason codes written by this module (the automatic lifts never clear them). */
export const ADMIN_SUSPENDED_REASON = 'ADMIN_SUSPENDED';
export const ADMIN_BANNED_REASON = 'ADMIN_BANNED';

/** One account as the list / detail read it. */
export interface UserRow {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  cccd_number: string | null;
  kyc_status: string;
  status: UserStatus;
  created_at: Date;
  profile_status: ProfileStatus | null;
  suspended_reason: string | null;
  tier: NurseTier | null;
  trust_score: number | null;
  rating_avg: string | number | null;
  gphn_number: string | null;
  gphn_expiry_date: string | null;
  years_of_exp: number | null;
  is_online: boolean | null;
  total?: string | number;
}

/** What decides whether a SUSPENDED nurse may become ACTIVE again (read under the profile lock). */
export interface NurseStanding {
  depositBalance: number;
  inGrace: boolean;
  minDeposit: number;
  overdueCommissions: number;
  trustScore: number;
  trustThreshold: number;
}

export interface BookingRef {
  id: string;
  booking_code: string;
  customer_id: string;
  matching_mode: string;
  execution_status: string;
}

export interface ListFilter {
  q?: string;
  role?: 'PATIENT' | 'NURSE';
  status?: string;
  limit: number;
  offset: number;
}
