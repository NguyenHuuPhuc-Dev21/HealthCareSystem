/**
 * Mock đăng nhập Admin — trả ĐÚNG shape của BE thật (accounts-otp, camelCase)
 * để lớp ánh xạ trong features/auth/auth.api.ts chạy giống hệt cả hai chế độ.
 *   0901 000 001 → tài khoản ADMIN (bắt buộc 2FA, coi như đã enrol — mã 2FA: 246810)
 *   0905 123 456 → tài khoản khách (PATIENT) → bị chặn ở Admin Console
 *   0905 000 000 → bị giới hạn gửi OTP (429)
 * OTP SMS: 123456 đúng · 111111 hết hạn · khác → sai
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

/** PublicUser đúng như BE trả (camelCase). */
function publicUser(u: AuthUser) {
  return { id: u.id, phone: u.phone ?? '', fullName: u.full_name ?? '', role: u.role, kycStatus: u.kyc_status };
}

function tokenPair(userId: string) {
  return {
    tokenType: 'Bearer',
    accessToken: `mock-token-${userId}`,
    accessTokenExpiresIn: 900,
    refreshToken: `mock-refresh-${userId}`,
    refreshTokenExpiresIn: 2592000,
  };
}

const otpAttempts: Record<string, number> = {};
const challenges: Record<string, { phone: string; attempts: number }> = {};

export const authHandlers: Record<string, MockHandler> = {
  'POST /api/v1/auth/request-otp': (body: { phone?: string }) => {
    const phone = body?.phone ?? '';
    if (!/^\+84(3|5|7|8|9)\d{8}$/.test(phone)) return fail(400, 'VALIDATION_ERROR', 'Invalid Vietnamese mobile number');
    if (phone === '+84905000000') return fail(429, 'OTP_RATE_LIMITED', 'Too many OTP requests', { retryAfterSeconds: 120 });
    otpAttempts[phone] = MAX_ATTEMPTS;
    return ok({ expiresInSeconds: 300, resendAfterSeconds: 45 });
  },

  'POST /api/v1/auth/verify-otp': (body: { phone?: string; otp?: string }) => {
    const phone = body?.phone ?? '';
    const left = otpAttempts[phone] ?? MAX_ATTEMPTS;
    if (left <= 0) return fail(400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts');
    if (body?.otp === EXPIRED_OTP) return fail(400, 'OTP_INVALID_OR_EXPIRED', 'The code is incorrect or has expired');
    if (body?.otp !== VALID_OTP) {
      otpAttempts[phone] = left - 1;
      if (otpAttempts[phone] === 0) return fail(400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts');
      return fail(400, 'OTP_INVALID_OR_EXPIRED', 'The code is incorrect or has expired', { attemptsRemaining: otpAttempts[phone] });
    }
    const user = users[phone];
    if (!user) {
      return ok({ status: 'REGISTRATION_REQUIRED', registrationToken: `reg-${Date.now()}-mock-token-value`, expiresInSeconds: 300 });
    }
    if (user.role === 'ADMIN') {
      const token = `challenge-${Date.now()}-mock-challenge-value`;
      challenges[token] = { phone, attempts: MAX_ATTEMPTS };
      return ok({ status: 'SECOND_FACTOR_REQUIRED', challengeToken: token, expiresInSeconds: 300, enrolled: true });
    }
    return ok({ status: 'AUTHENTICATED', user: publicUser(user), tokens: tokenPair(user.id) });
  },

  'POST /api/v1/auth/2fa/setup': (body: { challengeToken?: string }) => {
    const challenge = challenges[body?.challengeToken ?? ''];
    if (!challenge) return fail(400, 'CHALLENGE_INVALID', 'Sign-in step expired');
    return ok({
      secret: ['JBSW', 'Y3DP', 'EHPK', '3PXP'].join(''),
      otpauthUrl: 'otpauth://totp/CareNest:admin%40carenest.local?secret=<redacted> CareNest',
      issuer: 'CareNest',
      accountName: 'admin@carenest.local',
    });
  },

  'POST /api/v1/auth/verify-2fa': (body: { challengeToken?: string; code?: string }) => {
    const challenge = challenges[body?.challengeToken ?? ''];
    if (!challenge) return fail(400, 'CHALLENGE_INVALID', 'Sign-in step expired');
    if (body?.code !== VALID_2FA) {
      challenge.attempts -= 1;
      if (challenge.attempts <= 0) {
        delete challenges[body!.challengeToken!];
        return fail(400, 'CHALLENGE_INVALID', 'Too many attempts');
      }
      return fail(400, 'TOTP_INVALID', 'The authenticator code is incorrect', { attemptsRemaining: challenge.attempts });
    }
    delete challenges[body!.challengeToken!];
    const user = users[challenge.phone];
    return ok({ user: publicUser(user), tokens: tokenPair(user.id) });
  },
};
