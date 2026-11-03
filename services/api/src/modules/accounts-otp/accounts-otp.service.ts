/**
 * accounts-otp — phone + OTP sign-in, self-registration and sessions (BE-1 / Dev A, Phase 1).
 * Traceability: SRS §8 POST /auth/request-otp, /auth/verify-otp · FR-AUTH-03 · US-HP-01, US-HP-05
 *               SEC-1.1, 1.2, 1.4, 1.5, 1.7, 1.8 · OD-09 (parameters in system_configs, migration 0003)
 *
 * Design:
 *  - OTP: CSPRNG digits, stored only as HMAC-SHA256(OTP_SECRET, phone:code) in Redis with TTL,
 *    single-use (atomic DEL), invalidated after OTP_MAX_VERIFY_ATTEMPTS wrong tries.
 *  - Rate limits: resend cooldown per phone, hourly caps per phone and per IP — all server-side.
 *  - Anti-enumeration: request-otp answers the same for registered, unregistered and banned numbers.
 *  - Sessions: opaque 256-bit random tokens (not JWT) stored as SHA-256 hashes in Redis, so a
 *    ban/logout revokes them immediately (SEC-1.7). Refresh tokens rotate on every use.
 *  - Admin: verify-otp never returns a session for ADMIN; it returns a 2FA challenge.
 *    The TOTP step (POST /auth/verify-2fa) is the next increment — until then Admin cannot sign in.
 */

import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { UserRole, type SystemConfigKey } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { AppError } from '../../core/errors';
import type { AuthenticatedUser } from '../../core/middleware';
import { getKeyValueStore, type KeyValueStore } from '../../core/redis';
import { isLoginBlocked, requiresSecondFactor, toPublicUser } from './accounts-otp.policy';
import { PgAccountsRepo } from './accounts-otp.repo';
import type {
  AccountsRepo,
  AuthUserRecord,
  OtpSender,
  PublicUser,
  RequestContext,
  RequestOtpResult,
  SelfRegisterRole,
  SessionRecord,
  TokenPair,
  VerifyOtpResult,
} from './accounts-otp.types';

const HOUR_SECONDS = 3600;
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

export interface AccountsOtpDeps {
  kv: KeyValueStore;
  repo: AccountsRepo;
  sender: OtpSender;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  /** Server-side secret for OTP HMACs (env OTP_SECRET). */
  otpSecret: string;
  /** Return the OTP in the API response (dev/QA only — never in production). */
  devEcho?: boolean;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}

const keys = {
  otpCode: (phone: string) => `otp:code:${phone}`,
  otpFails: (phone: string) => `otp:fail:${phone}`,
  otpCooldown: (phone: string) => `otp:cooldown:${phone}`,
  otpSentPhone: (phone: string) => `otp:sent:phone:${phone}`,
  otpSentIp: (ip: string) => `otp:sent:ip:${ip}`,
  registration: (hash: string) => `auth:reg:${hash}`,
  twoFactor: (hash: string) => `auth:2fa:${hash}`,
  access: (hash: string) => `sess:a:${hash}`,
  refresh: (hash: string) => `sess:r:${hash}`,
  sid: (sid: string) => `sess:sid:${sid}`,
  userSessions: (userId: string) => `sess:user:${userId}`,
};

const invalidOtp = (details?: unknown) =>
  new AppError(400, 'OTP_INVALID_OR_EXPIRED', 'The code is incorrect or has expired', details);
const otpLocked = () =>
  new AppError(400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many wrong attempts. Request a new code.');
const sessionInvalid = () => new AppError(401, 'SESSION_INVALID', 'Session expired or revoked. Sign in again.');

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export class SessionManager {
  constructor(private readonly deps: Pick<AccountsOtpDeps, 'kv' | 'repo' | 'getNumber'>) {}

  private async ttls(role: UserRole): Promise<{ access: number; refresh: number }> {
    const access = (await this.deps.getNumber('ACCESS_TOKEN_TTL_MINUTES')) * 60;
    const refresh =
      role === UserRole.ADMIN
        ? (await this.deps.getNumber('ADMIN_SESSION_IDLE_MINUTES')) * 60
        : (await this.deps.getNumber('REFRESH_TOKEN_TTL_DAYS')) * 24 * HOUR_SECONDS;
    return { access: Math.min(access, refresh), refresh };
  }

  private async issue(user: { id: string; role: UserRole }, sid: string, deviceId?: string): Promise<TokenPair> {
    const { kv } = this.deps;
    const ttl = await this.ttls(user.role);
    const accessToken = newToken();
    const refreshToken = newToken();
    const accessHash = sha256(accessToken);
    const refreshHash = sha256(refreshToken);
    const record: SessionRecord = { userId: user.id, role: user.role, sid, ...(deviceId ? { deviceId } : {}) };

    await kv.set(keys.access(accessHash), JSON.stringify(record), ttl.access);
    await kv.set(keys.refresh(refreshHash), JSON.stringify(record), ttl.refresh);
    await kv.set(keys.sid(sid), JSON.stringify({ a: accessHash, r: refreshHash }), ttl.refresh);
    await kv.setAdd(keys.userSessions(user.id), sid, ttl.refresh);

    return {
      tokenType: 'Bearer',
      accessToken,
      accessTokenExpiresIn: ttl.access,
      refreshToken,
      refreshTokenExpiresIn: ttl.refresh,
    };
  }

  create(user: { id: string; role: UserRole }, ctx: RequestContext): Promise<TokenPair> {
    return this.issue(user, randomUUID(), ctx.deviceId);
  }

  /** Returns the user for a valid access token, or null. Used by core authGuard. */
  async verifyAccessToken(token: string): Promise<AuthenticatedUser | null> {
    if (!TOKEN_FORMAT.test(token)) return null;
    const raw = await this.deps.kv.get(keys.access(sha256(token)));
    if (!raw) return null;
    const rec = JSON.parse(raw) as SessionRecord;
    return { id: rec.userId, role: rec.role };
  }

  /** Rotates the refresh token. A used/expired/revoked refresh token is rejected. */
  async refresh(refreshToken: string, ctx: RequestContext): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const { kv, repo } = this.deps;
    if (!TOKEN_FORMAT.test(refreshToken)) throw sessionInvalid();
    const key = keys.refresh(sha256(refreshToken));
    const raw = await kv.get(key);
    // del() === 1 makes the refresh single-use even under concurrent requests.
    if (!raw || (await kv.del(key)) !== 1) throw sessionInvalid();
    const rec = JSON.parse(raw) as SessionRecord;

    const user = await repo.findById(rec.userId);
    if (!user || isLoginBlocked(user)) {
      await this.revokeAllForUser(rec.userId);
      throw sessionInvalid();
    }

    // Drop the old access token of this session, then issue a new pair under the same sid.
    const sidRaw = await kv.get(keys.sid(rec.sid));
    if (sidRaw) await kv.del(keys.access((JSON.parse(sidRaw) as { a: string }).a));
    const tokens = await this.issue(user, rec.sid, rec.deviceId ?? ctx.deviceId);
    return { user: toPublicUser(user), tokens };
  }

  async revokeSession(sid: string, userId?: string): Promise<void> {
    const { kv } = this.deps;
    const raw = await kv.get(keys.sid(sid));
    if (raw) {
      const { a, r } = JSON.parse(raw) as { a: string; r: string };
      await kv.del(keys.access(a));
      await kv.del(keys.refresh(r));
      await kv.del(keys.sid(sid));
    }
    if (userId) await kv.setRemove(keys.userSessions(userId), sid);
  }

  /**
   * Revoke every session of a user — call on BAN/SUSPEND, phone re-binding, etc. (SEC-1.7).
   * Exposed for admin-users (BE-2), reviews-trustscore and any lifecycle change.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    const sids = await this.deps.kv.setMembers(keys.userSessions(userId));
    for (const sid of sids) await this.revokeSession(sid);
    await this.deps.kv.del(keys.userSessions(userId));
  }

  /** Logout = revoke the session behind this access token (server-side, SEC-1.7). */
  async logout(accessToken: string): Promise<void> {
    if (!TOKEN_FORMAT.test(accessToken)) return;
    const raw = await this.deps.kv.get(keys.access(sha256(accessToken)));
    if (!raw) return;
    const rec = JSON.parse(raw) as SessionRecord;
    await this.revokeSession(rec.sid, rec.userId);
  }
}

// ---------------------------------------------------------------------------
// OTP sign-in & registration
// ---------------------------------------------------------------------------

export class AccountsOtpService {
  readonly sessions: SessionManager;

  constructor(private readonly deps: AccountsOtpDeps) {
    if (!deps.otpSecret || deps.otpSecret.length < 32) {
      throw new Error('OTP_SECRET must be at least 32 characters');
    }
    this.sessions = new SessionManager(deps);
  }

  private hashOtp(phone: string, code: string): string {
    return createHmac('sha256', this.deps.otpSecret).update(`otp:${phone}:${code}`).digest('hex');
  }

  private async cfg(key: SystemConfigKey): Promise<number> {
    return this.deps.getNumber(key);
  }

  /** POST /auth/request-otp. `phone` must already be normalised by the schema. */
  async requestOtp(phone: string, ctx: RequestContext): Promise<RequestOtpResult> {
    const { kv, repo } = this.deps;
    const [ttl, cooldown, maxPerPhone, maxPerIp, length] = await Promise.all([
      this.cfg('OTP_TTL_SECONDS'),
      this.cfg('OTP_RESEND_COOLDOWN_SECONDS'),
      this.cfg('OTP_MAX_SENDS_PER_PHONE_PER_HOUR'),
      this.cfg('OTP_MAX_SENDS_PER_IP_PER_HOUR'),
      this.cfg('OTP_LENGTH'),
    ]);

    if (!(await kv.setIfAbsent(keys.otpCooldown(phone), '1', cooldown))) {
      const left = await kv.ttl(keys.otpCooldown(phone));
      throw new AppError(429, 'OTP_RESEND_TOO_SOON', 'Please wait before requesting another code', {
        retryAfterSeconds: Math.max(left, 1),
      });
    }
    if ((await kv.incrWithTtl(keys.otpSentIp(ctx.ip), HOUR_SECONDS)) > maxPerIp) {
      throw new AppError(429, 'OTP_RATE_LIMITED', 'Too many code requests. Try again later.');
    }
    if ((await kv.incrWithTtl(keys.otpSentPhone(phone), HOUR_SECONDS)) > maxPerPhone) {
      throw new AppError(429, 'OTP_RATE_LIMITED', 'Too many code requests. Try again later.');
    }

    const result: RequestOtpResult = { expiresInSeconds: ttl, resendAfterSeconds: cooldown };

    // Anti-enumeration: a banned number gets the same answer but no SMS.
    const existing = await repo.findByPhone(phone);
    if (existing && isLoginBlocked(existing)) return result;

    const code = randomInt(0, 10 ** length).toString().padStart(length, '0');
    await kv.set(keys.otpCode(phone), this.hashOtp(phone, code), ttl);
    await kv.del(keys.otpFails(phone));

    try {
      await this.deps.sender.sendLoginOtp(phone, code, ttl);
    } catch {
      await kv.del(keys.otpCode(phone));
      await kv.del(keys.otpCooldown(phone)); // let the user retry right away
      throw new AppError(503, 'OTP_DELIVERY_FAILED', 'Could not send the code. Please try again.');
    }
    return this.deps.devEcho ? { ...result, devOtp: code } : result;
  }

  /** POST /auth/verify-otp */
  async verifyOtp(phone: string, code: string, ctx: RequestContext): Promise<VerifyOtpResult> {
    const { kv, repo } = this.deps;
    const [maxAttempts, ttl] = await Promise.all([this.cfg('OTP_MAX_VERIFY_ATTEMPTS'), this.cfg('OTP_TTL_SECONDS')]);

    const stored = await kv.get(keys.otpCode(phone));
    if (!stored) throw invalidOtp();

    const fails = Number((await kv.get(keys.otpFails(phone))) ?? 0);
    if (fails >= maxAttempts) {
      await kv.del(keys.otpCode(phone));
      throw otpLocked();
    }

    if (!safeEqualHex(stored, this.hashOtp(phone, code))) {
      const n = await kv.incrWithTtl(keys.otpFails(phone), ttl);
      if (n >= maxAttempts) {
        await kv.del(keys.otpCode(phone));
        throw otpLocked();
      }
      throw invalidOtp({ attemptsRemaining: maxAttempts - n });
    }

    // Single use: only the request that actually deletes the code wins (SEC-1.2 #3).
    if ((await kv.del(keys.otpCode(phone))) !== 1) throw invalidOtp();
    await kv.del(keys.otpFails(phone));

    const user = await repo.findByPhone(phone);

    if (!user) {
      const registrationToken = newToken();
      await kv.set(keys.registration(sha256(registrationToken)), phone, ttl);
      return { status: 'REGISTRATION_REQUIRED', registrationToken, expiresInSeconds: ttl };
    }

    if (isLoginBlocked(user)) {
      throw new AppError(403, 'ACCOUNT_BANNED', 'This account has been permanently locked');
    }

    if (requiresSecondFactor(user)) {
      const challengeToken = newToken();
      await kv.set(keys.twoFactor(sha256(challengeToken)), user.id, ttl);
      return { status: 'SECOND_FACTOR_REQUIRED', challengeToken, expiresInSeconds: ttl };
    }

    return { status: 'AUTHENTICATED', user: toPublicUser(user), tokens: await this.sessions.create(user, ctx) };
  }

  /** POST /auth/complete-registration — first sign-in of a new phone number (US-HP-01 AC-01). */
  async completeRegistration(
    registrationToken: string,
    input: { fullName: string; role: SelfRegisterRole },
    ctx: RequestContext,
  ): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const { kv, repo } = this.deps;
    const key = keys.registration(sha256(registrationToken));
    const phone = await kv.get(key);
    if (!phone || (await kv.del(key)) !== 1) {
      throw new AppError(400, 'REGISTRATION_TOKEN_INVALID', 'Registration expired. Verify your phone again.');
    }

    const created: AuthUserRecord | null = await repo.createUser({ phone, fullName: input.fullName, role: input.role });
    if (!created) {
      throw new AppError(409, 'PHONE_ALREADY_REGISTERED', 'This phone number already has an account. Sign in instead.');
    }
    return { user: toPublicUser(created), tokens: await this.sessions.create(created, ctx) };
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.deps.repo.findById(userId);
    if (!user) throw sessionInvalid();
    return toPublicUser(user);
  }
}

// ---------------------------------------------------------------------------
// Wiring with real dependencies
// ---------------------------------------------------------------------------

/**
 * Development sender: no SMS provider is chosen yet (OD-09). It never logs the
 * code — only a masked phone. Use OTP_DEV_ECHO=true to receive the code in the
 * API response while developing.
 */
export class DevOtpSender implements OtpSender {
  async sendLoginOtp(phone: string): Promise<void> {
    console.log(`[accounts-otp] OTP issued for ***${phone.slice(-3)} (no SMS provider configured)`);
  }
}

function readOtpSecret(): string {
  const secret = process.env.OTP_SECRET ?? '';
  if (process.env.NODE_ENV === 'production' && (secret.startsWith('replace_with') || secret.length < 32)) {
    throw new Error('OTP_SECRET must be a real random secret (≥ 32 chars) in production');
  }
  return secret;
}

function readDevEcho(): boolean {
  const on = process.env.OTP_DEV_ECHO === 'true';
  if (on && process.env.NODE_ENV === 'production') {
    throw new Error('OTP_DEV_ECHO must not be enabled in production');
  }
  return on;
}

function selectSender(): OtpSender {
  if (process.env.NODE_ENV === 'production') {
    // Fail closed until the SMS/ZNS provider decision (OD-09) is implemented.
    throw new Error('No SMS/ZNS OTP provider configured for production (OD-09)');
  }
  return new DevOtpSender();
}

let singleton: AccountsOtpService | null = null;

export function getAccountsOtpService(): AccountsOtpService {
  if (!singleton) {
    singleton = new AccountsOtpService({
      kv: getKeyValueStore(),
      repo: new PgAccountsRepo(),
      sender: selectSender(),
      getNumber: getConfigNumber,
      otpSecret: readOtpSecret(),
      devEcho: readDevEcho(),
    });
  }
  return singleton;
}

/** For other modules: revoke all sessions when an account is banned/suspended (SEC-1.7). */
export function revokeAllSessionsForUser(userId: string): Promise<void> {
  return getAccountsOtpService().sessions.revokeAllForUser(userId);
}
