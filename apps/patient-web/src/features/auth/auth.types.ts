/**
 * Kiểu dữ liệu cho luồng đăng nhập OTP (SH1/SH2).
 *
 * TODO: Các union type trạng thái bên dưới (UserRole, KycStatus, AccountStatus) phải
 * được import từ '@healthcare-system/shared' theo quy định của team. Khai báo tạm ở đây
 * vì packages/shared chưa export — khi BE-1 export xong thì xoá phần này và import lại.
 */

export type UserRole = 'PATIENT' | 'NURSE' | 'ADMIN';
export type KycStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';

/** Vai trò người dùng mới được tự chọn ở SH2 (Admin không tự đăng ký). */
export type SelfSignupRole = Extract<UserRole, 'PATIENT' | 'NURSE'>;

export interface AuthUser {
  id: string;
  role: UserRole;
  status: AccountStatus;
  kyc_status: KycStatus;
  full_name?: string | null;
  phone?: string; // E.164 — hiển thị đã che ở menu avatar
}

/* ----- Contract đề xuất — cần BE-1 xác nhận ----- */

export interface RequestOtpRequest {
  phone: string; // E.164: +84905123456
}

export interface RequestOtpResponse {
  expires_in_sec: number; // OTP còn hiệu lực bao lâu
  resend_after_sec: number; // bao lâu nữa mới được gửi lại
  is_new_user: boolean; // true → SH2 hiển thị phần chọn vai trò
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
  role?: SelfSignupRole; // chỉ gửi khi is_new_user = true
}

export interface VerifyOtpResponse {
  access_token: string;
  user: AuthUser;
}

/** Mã lỗi backend trả về cho 2 API OTP. */
export const AuthErrorCode = {
  INVALID_PHONE: 'INVALID_PHONE',
  OTP_RATE_LIMITED: 'OTP_RATE_LIMITED', // details: { retry_after_sec }
  OTP_INVALID: 'OTP_INVALID', // details: { attempts_left }
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;
