/**
 * Giữ thông tin "đang chờ nhập OTP" giữa SH1 → SH2.
 * Dùng sessionStorage để F5 ở trang OTP không bị mất số điện thoại / đếm ngược.
 * Không lưu mã OTP ở đây.
 */

import type { RequestOtpResponse } from './auth.types';

const KEY = 'otp_pending';

export interface OtpPending {
  phone: string; // E.164
  isNewUser: boolean;
  resendAt: number; // epoch ms — thời điểm được phép gửi lại
  expiresAt: number; // epoch ms — thời điểm OTP hết hạn
}

export function buildPending(phone: string, res: RequestOtpResponse): OtpPending {
  const now = Date.now();
  return {
    phone,
    isNewUser: res.is_new_user,
    resendAt: now + res.resend_after_sec * 1000,
    expiresAt: now + res.expires_in_sec * 1000,
  };
}

export function savePending(pending: OtpPending): void {
  sessionStorage.setItem(KEY, JSON.stringify(pending));
}

export function loadPending(): OtpPending | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OtpPending) : null;
  } catch {
    return null;
  }
}

export function clearPending(): void {
  sessionStorage.removeItem(KEY);
}
