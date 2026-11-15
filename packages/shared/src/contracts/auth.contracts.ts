import type { UserRole } from '../enums';
import type { NurseCredential, NurseProfile } from '../types';

export interface SessionUser {
  id: string;
  phone: string;
  full_name: string;
  role: UserRole;
}

export interface SessionData {
  token: string;
  refreshToken?: string;
  profileSource?: 'API' | 'MOCK';
  user: SessionUser;
  profile: NurseProfile | null;
  credentials: NurseCredential[];
}

export interface RequestOtpData {
  requestId: string;
  resendAfterSeconds: number;
  expiresInSeconds: number;
  devOtp?: string;
}

export type VerifyOutcome =
  | { status: 'AUTHENTICATED'; session: SessionData }
  | { status: 'REGISTRATION_REQUIRED'; registrationToken: string }
  | { status: 'SECOND_FACTOR_REQUIRED' };
