/**
 * Sign-in policy (R-L03, SEC-1.7).
 * - BANNED (account or nurse profile) → no OTP is sent and no session is issued.
 * - SUSPENDED users CAN sign in: a suspended nurse must still reach the app to
 *   top up the deposit or pay overdue commission. What a SUSPENDED nurse may NOT
 *   do (accept jobs) is enforced by requireNurseEligibility on those routes.
 */
import { ProfileStatus, UserRole, UserStatus } from '@healthcare-system/shared';
import type { AuthUserRecord, PublicUser } from './accounts-otp.types';

export function isLoginBlocked(user: AuthUserRecord): boolean {
  return user.status === UserStatus.BANNED || user.nurseProfileStatus === ProfileStatus.BANNED;
}

/** Admin accounts need a second factor before any session exists (SEC-1.5, US-HP-05). */
export function requiresSecondFactor(user: AuthUserRecord): boolean {
  return user.role === UserRole.ADMIN;
}

export function toPublicUser(user: AuthUserRecord): PublicUser {
  return { id: user.id, phone: user.phone, fullName: user.fullName, role: user.role, kycStatus: user.kycStatus };
}
