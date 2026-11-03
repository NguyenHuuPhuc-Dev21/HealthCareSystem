/**
 * Mock đăng nhập Admin.
 *   0901 000 001 → tài khoản ADMIN (bắt buộc 2FA)
 *   0905 123 456 → tài khoản khách (PATIENT) → bị chặn ở Admin Console
 *   0905 000 000 → bị giới hạn gửi OTP (429)
 * OTP SMS: 123456 đúng · 111111 hết hạn · khác → sai
 * Mã 2FA (ứng dụng xác thực): 246810 đúng · khác → sai (5 lần)
 */

import type { AuthUser } from '../features/auth/auth.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';

const VALID_OTP = '123456';
const EXPIRED_OTP = '111111';
const VALID_2FA = '246810';
const MAX_ATTEMPTS = 5;

const users: Record<string, AuthUser> = {
  '+84901000001': { id: 'u-admin', role: 'ADMIN', status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Admin vận hành', phone: '+84901000001' },
  '+84905123456': { id: 'u-patient-verified', role: 'PATIENT', status: 'ACTIVE', kyc_status: 'VERIFIED', full_name: 'Nguyễn Văn An', phone: '+84905123456' },
};

const otpAttempts: Record<string, number> = {};
const challenges: Record<string, { phone: string; attempts: number }> = {};

export const authHandlers: Record<string, MockHandler> = {
  'POST /api/v1/auth/request-otp': (body: { phone?: string }) => {
    const phone = body?.phone ?? '';
    if (!/^\+84(3|5|7|8|9)\d{8}$/.test(phone)) return fail(400, 'INVALID_PHONE', 'Số điện thoại không hợp lệ');
    if (phone === '+84905000000') return fail(429, 'OTP_RATE_LIMITED', 'Too many OTP requests', { retry_after_sec: 120 });
    otpAttempts[phone] = MAX_ATTEMPTS;
    return ok({ expires_in_sec: 300, resend_after_sec: 45, is_new_user: !users[phone] });
  },

  'POST /api/v1/auth/verify-otp': (body: { phone?: string; otp?: string }) => {
    const phone = body?.phone ?? '';
    const left = otpAttempts[phone] ?? MAX_ATTEMPTS;
    if (left <= 0) return fail(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many attempts');
    if (body?.otp === EXPIRED_OTP) return fail(400, 'OTP_EXPIRED', 'OTP expired');
    if (body?.otp !== VALID_OTP) {
      otpAttempts[phone] = left - 1;
      if (otpAttempts[phone] === 0) return fail(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many attempts');
      return fail(400, 'OTP_INVALID', 'Invalid OTP', { attempts_left: otpAttempts[phone] });
    }
    const user = users[phone] ?? { id: `u-new-${phone.slice(-4)}`, role: 'PATIENT', status: 'ACTIVE', kyc_status: 'UNVERIFIED', phone };
    if (user.role === 'ADMIN') {
      const token = `challenge-${Date.now()}`;
      challenges[token] = { phone, attempts: MAX_ATTEMPTS };
      return ok({ requires_2fa: true, challenge_token: token, challenge_expires_in_sec: 300 });
    }
    return ok({ requires_2fa: false, access_token: `mock-token-${user.id}`, user });
  },

  'POST /api/v1/auth/verify-2fa': (body: { challenge_token?: string; code?: string }) => {
    const challenge = challenges[body?.challenge_token ?? ''];
    if (!challenge) return fail(400, 'TWO_FA_CHALLENGE_EXPIRED', 'Challenge expired');
    if (body?.code !== VALID_2FA) {
      challenge.attempts -= 1;
      if (challenge.attempts <= 0) {
        delete challenges[body!.challenge_token!];
        return fail(400, 'TWO_FA_CHALLENGE_EXPIRED', 'Too many attempts');
      }
      return fail(400, 'TWO_FA_INVALID', 'Invalid 2FA code', { attempts_left: challenge.attempts });
    }
    delete challenges[body!.challenge_token!];
    const user = users[challenge.phone];
    return ok({ access_token: `mock-token-${user.id}`, user });
  },
};
