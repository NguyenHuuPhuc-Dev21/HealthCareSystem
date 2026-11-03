import type { KycStatus, ProfileStatus, UserRole, UserStatus } from '@healthcare-system/shared';

/** Roles a person may self-register as. ADMIN accounts are never self-created. */
export type SelfRegisterRole = UserRole.PATIENT | UserRole.NURSE;

/** What the auth flow needs to know about an account (repo output). */
export interface AuthUserRecord {
  id: string;
  phone: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  kycStatus: KycStatus;
  /** null for non-nurses and for nurses who have not onboarded yet. */
  nurseProfileStatus: ProfileStatus | null;
}

/** Safe subset returned to clients. */
export interface PublicUser {
  id: string;
  phone: string;
  fullName: string;
  role: UserRole;
  kycStatus: KycStatus;
}

export interface AccountsRepo {
  findByPhone(phone: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  /** Returns null if the phone is already taken (unique constraint). */
  createUser(input: { phone: string; fullName: string; role: SelfRegisterRole }): Promise<AuthUserRecord | null>;
}

/**
 * Delivers the login OTP by SMS/ZNS. The provider is not chosen yet (OD-09);
 * implementations must never log the code (SEC-1.1).
 */
export interface OtpSender {
  sendLoginOtp(phone: string, code: string, ttlSeconds: number): Promise<void>;
}

export interface RequestContext {
  ip: string;
  userAgent?: string;
  deviceId?: string;
}

export interface TokenPair {
  tokenType: 'Bearer';
  accessToken: string;
  accessTokenExpiresIn: number; // seconds
  refreshToken: string;
  refreshTokenExpiresIn: number; // seconds
}

export interface RequestOtpResult {
  expiresInSeconds: number;
  resendAfterSeconds: number;
  /** Only when OTP_DEV_ECHO=true outside production — lets FE/QA log in without SMS. */
  devOtp?: string;
}

export type VerifyOtpResult =
  | { status: 'AUTHENTICATED'; user: PublicUser; tokens: TokenPair }
  | { status: 'REGISTRATION_REQUIRED'; registrationToken: string; expiresInSeconds: number }
  | { status: 'SECOND_FACTOR_REQUIRED'; challengeToken: string; expiresInSeconds: number };

/** Stored against an access/refresh token hash. */
export interface SessionRecord {
  userId: string;
  role: UserRole;
  sid: string;
  deviceId?: string;
}
