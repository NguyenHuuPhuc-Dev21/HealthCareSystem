/**
 * Mock cho POST /auth/request-otp và POST /auth/verify-otp.
 *
 * Kịch bản test (nhập ở SH1):
 *   0905 123 456  → khách cũ, đã eKYC (VERIFIED)          → vào trang chủ
 *   0905 111 222  → khách cũ, chưa eKYC (UNVERIFIED)      → vào trang chủ
 *   0909 888 777  → tài khoản điều dưỡng                 → báo "không dùng cho trang Khách hàng"
 *   0905 000 000  → bị giới hạn gửi OTP (429)
 *   số khác       → người dùng mới                        → hiện chọn vai trò → /onboarding
 *
 * Mã OTP (nhập ở SH2):
 *   123456 → đúng · 111111 → hết hạn · mã khác → sai (5 lần thì bị khoá)
 */

import type { AuthUser } from '../features/auth/auth.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';

const VALID_OTP = '123456';
const EXPIRED_OTP = '111111';
const MAX_ATTEMPTS = 5;

const existingUsers: Record<string, AuthUser> = {
  '+84905123456': { id: 'u-patient-verified', role: 'PATIENT', status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Nguyễn Văn An' },
  '+84905111222': { id: 'u-patient-unverified', role: 'PATIENT', status: 'ACTIVE', kyc_status: 'UNVERIFIED', full_name: null },
  '+84909888777': { id: 'u-nurse', role: 'NURSE', status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Trần Thị Mai' },
};

const attemptsLeft: Record<string, number> = {};

export const authHandlers: Record<string, MockHandler> = {
  'POST /api/v1/auth/request-otp': (body: { phone?: string }) => {
    const phone = body?.phone ?? '';
    if (!/^\+84(3|5|7|8|9)\d{8}$/.test(phone)) {
      return fail(400, 'INVALID_PHONE', 'Số điện thoại không hợp lệ');
    }
    if (phone === '+84905000000') {
      return fail(429, 'OTP_RATE_LIMITED', 'Too many OTP requests', { retry_after_sec: 120 });
    }
    attemptsLeft[phone] = MAX_ATTEMPTS;
    return ok({ expires_in_sec: 300, resend_after_sec: 45, is_new_user: !existingUsers[phone] });
  },

  'POST /api/v1/auth/verify-otp': (body: { phone?: string; otp?: string; role?: 'PATIENT' | 'NURSE' }) => {
    const phone = body?.phone ?? '';
    // F5 trang làm mất biến trong bộ nhớ của mock → coi như còn đủ lượt (backend thật lưu ở server)
    const left = attemptsLeft[phone] ?? MAX_ATTEMPTS;

    if (left <= 0) {
      return fail(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many attempts');
    }
    if (body?.otp === EXPIRED_OTP) {
      return fail(400, 'OTP_EXPIRED', 'OTP expired');
    }
    if (body?.otp !== VALID_OTP) {
      attemptsLeft[phone] = left - 1;
      if (attemptsLeft[phone] === 0) return fail(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many attempts');
      return fail(400, 'OTP_INVALID', 'Invalid OTP', { attempts_left: attemptsLeft[phone] });
    }

    delete attemptsLeft[phone];
    const user: AuthUser = existingUsers[phone] ?? {
      id: `u-new-${phone.slice(-4)}`,
      role: body.role ?? 'PATIENT',
      status: 'ACTIVE',
      kyc_status: 'UNVERIFIED',
      full_name: null,
    };
    user.phone = phone;
    existingUsers[phone] = user;
    return ok({ access_token: `mock-token-${user.id}`, user });
  },
};
