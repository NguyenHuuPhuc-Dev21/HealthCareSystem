/**
 * Đăng nhập Admin Portal: SĐT + OTP (như mọi tài khoản) → BẮT BUỘC thêm lớp 2FA (SRS §8, thiết kế SH1 biến thể Admin).
 *
 * TODO: UserRole, KycStatus, AccountStatus → import từ '@healthcare-system/shared' khi BE-1 export.
 */

export type UserRole = 'PATIENT' | 'NURSE' | 'ADMIN';
export type KycStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export interface AuthUser {
  id: string;
  role: UserRole;
  status: AccountStatus;
  kyc_status: KycStatus;
  full_name?: string | null;
  phone?: string;
}

export interface RequestOtpResponse {
  expires_in_sec: number;
  resend_after_sec: number;
  is_new_user: boolean;
}

/*
 * ⚠️ Contract đề xuất — cần BE-1 xác nhận.
 * verify-otp với tài khoản ADMIN KHÔNG trả access_token ngay mà trả challenge để làm bước 2FA.
 */
export type VerifyOtpResponse =
  | { requires_2fa: false; access_token: string; user: AuthUser }
  | { requires_2fa: true; challenge_token: string; challenge_expires_in_sec: number };

export interface Verify2faResponse {
  access_token: string;
  user: AuthUser;
}

export const AuthErrorCode = {
  INVALID_PHONE: 'INVALID_PHONE',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  TWO_FA_INVALID: 'TWO_FA_INVALID', // details: { attempts_left }
  TWO_FA_CHALLENGE_EXPIRED: 'TWO_FA_CHALLENGE_EXPIRED',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;
