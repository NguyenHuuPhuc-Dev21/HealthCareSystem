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
  /** Admin has completed TOTP enrolment (users.totp_enabled_at IS NOT NULL). */
  totpEnabled: boolean;
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
  /** Encrypted TOTP secret of an enrolled Admin, or null. */
  getTotpSecretEnc(userId: string): Promise<string | null>;
  /** Stores the encrypted secret and marks enrolment complete (only if not already enrolled). */
  enableTotp(userId: string, secretEnc: string): Promise<boolean>;
}

/**
 * Delivers the login OTP. Channels live in accounts-otp.senders.ts (OD-09: mock inbox now,
 * Zalo ZNS once the team has an Official Account). Implementations must never log the code (SEC-1.1).
 */
export interface OtpSender {
  sendLoginOtp(phone: string, code: string, ttlSeconds: number): Promise<void>;
}

/** One "delivered" code in the mock inbox (OTP_CHANNEL=mock — never in production). */
export interface MockOtpMessage {
  phone: string;
  code: string;
  channel: 'mock';
  /** ISO-8601 */
  issuedAt: string;
  /** ISO-8601 — the code and this message disappear together. */
  expiresAt: string;
}

/** Read side of the mock channel, used by GET /auth/dev/otp-inbox. */
export interface MockOtpInbox {
  /** The code currently waiting for this phone, or null. */
  latest(phone: string): Promise<MockOtpMessage | null>;
  /** False when OTP_MOCK_INBOX_KEY is set and the presented key does not match. */
  isAuthorized(presentedKey: string | undefined): boolean;
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
  | { status: 'SECOND_FACTOR_REQUIRED'; challengeToken: string; expiresInSeconds: number; enrolled: boolean };

export interface TotpSetupResult {
  /** base32 secret — show it as text for manual entry. */
  secret: string;
  /** otpauth:// URI — render it as a QR code. */
  otpauthUrl: string;
  issuer: string;
  accountName: string;
}

/** Stored against an access/refresh token hash. */
export interface SessionRecord {
  userId: string;
  role: UserRole;
  sid: string;
  deviceId?: string;
}
