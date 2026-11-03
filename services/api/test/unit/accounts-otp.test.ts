import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { KycStatus, ProfileStatus, UserRole, UserStatus, type SystemConfigKey } from '@healthcare-system/shared';
import { AppError } from '../../src/core/errors';
import { MemoryKeyValueStore } from '../../src/core/redis';
import { normalizeVietnamPhone } from '../../src/modules/accounts-otp/accounts-otp.schema';
import { AccountsOtpService } from '../../src/modules/accounts-otp/accounts-otp.service';
import { base32Decode, hotp, totpStep } from '../../src/modules/accounts-otp/accounts-otp.totp';
import type { AccountsRepo, AuthUserRecord, OtpSender } from '../../src/modules/accounts-otp/accounts-otp.types';

const CONFIG: Partial<Record<SystemConfigKey, number>> = {
  OTP_LENGTH: 6,
  OTP_TTL_SECONDS: 300,
  OTP_MAX_VERIFY_ATTEMPTS: 5,
  OTP_RESEND_COOLDOWN_SECONDS: 60,
  OTP_MAX_SENDS_PER_PHONE_PER_HOUR: 5,
  OTP_MAX_SENDS_PER_IP_PER_HOUR: 20,
  ACCESS_TOKEN_TTL_MINUTES: 15,
  REFRESH_TOKEN_TTL_DAYS: 30,
  ADMIN_SESSION_IDLE_MINUTES: 30,
};

class FakeRepo implements AccountsRepo {
  users: AuthUserRecord[] = [];
  totp = new Map<string, string>();
  async getTotpSecretEnc(userId: string) {
    return this.totp.get(userId) ?? null;
  }
  async enableTotp(userId: string, enc: string) {
    const u = this.users.find((x) => x.id === userId);
    if (!u || u.role !== UserRole.ADMIN || u.totpEnabled) return false;
    this.totp.set(userId, enc);
    u.totpEnabled = true;
    return true;
  }
  async findByPhone(phone: string) {
    return this.users.find((u) => u.phone === phone) ?? null;
  }
  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }
  async createUser(input: { phone: string; fullName: string; role: UserRole.PATIENT | UserRole.NURSE }) {
    if (this.users.some((u) => u.phone === input.phone)) return null;
    const u: AuthUserRecord = {
      id: `00000000-0000-4000-8000-${String(this.users.length + 1).padStart(12, '0')}`,
      phone: input.phone,
      fullName: input.fullName,
      role: input.role,
      status: UserStatus.ACTIVE,
      kycStatus: KycStatus.UNVERIFIED,
      nurseProfileStatus: null,
      totpEnabled: false,
    };
    this.users.push(u);
    return u;
  }
}

class CapturingSender implements OtpSender {
  sent: { phone: string; code: string }[] = [];
  fail = false;
  async sendLoginOtp(phone: string, code: string) {
    if (this.fail) throw new Error('provider down');
    this.sent.push({ phone, code });
  }
  last() {
    return this.sent[this.sent.length - 1]!.code;
  }
}

function setup() {
  let now = 1_000_000;
  const clock = {
    now: () => now,
    advance: (s: number) => {
      now += s * 1000;
    },
  };
  const kv = new MemoryKeyValueStore(clock.now);
  const repo = new FakeRepo();
  const sender = new CapturingSender();
  const svc = new AccountsOtpService({
    kv,
    repo,
    sender,
    getNumber: async (k) => {
      const v = CONFIG[k];
      if (v === undefined) throw new Error(`missing ${k}`);
      return v;
    },
    otpSecret: 'x'.repeat(40),
    totpKey: Buffer.alloc(32, 9),
    now: clock.now,
  });
  return { svc, repo, sender, kv, clock };
}

const PHONE = '0901000001';
const ctx = { ip: '1.2.3.4' };

function user(over: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    phone: PHONE,
    fullName: 'Nguyen Van A',
    role: UserRole.PATIENT,
    status: UserStatus.ACTIVE,
    kycStatus: KycStatus.UNVERIFIED,
    nurseProfileStatus: null,
    totpEnabled: false,
    ...over,
  };
}

async function expectAppError(p: Promise<unknown>, status: number, code: string) {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  expect((err as AppError).code).toBe(code);
}

describe('normalizeVietnamPhone', () => {
  it('accepts common spellings and returns the 10-digit local form', () => {
    expect(normalizeVietnamPhone('0901000001')).toBe('0901000001');
    expect(normalizeVietnamPhone('+84 901 000 001')).toBe('0901000001');
    expect(normalizeVietnamPhone('84901000001')).toBe('0901000001');
    expect(normalizeVietnamPhone('0901.000.001')).toBe('0901000001');
  });
  it('rejects landlines, short numbers and garbage', () => {
    expect(normalizeVietnamPhone('0241234567')).toBe(null);
    expect(normalizeVietnamPhone('090100')).toBe(null);
    expect(normalizeVietnamPhone('abc')).toBe(null);
  });
});

describe('request-otp', () => {
  it('sends a 6-digit code and never echoes it unless devEcho is on', async () => {
    const { svc, sender } = setup();
    const res = await svc.requestOtp(PHONE, ctx);
    expect(res).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 60 });
    expect(sender.last()).toMatch(/^\d{6}$/);
  });

  it('stores only a hash of the code', async () => {
    const { svc, sender, kv } = setup();
    await svc.requestOtp(PHONE, ctx);
    const stored = await kv.get(`otp:code:${PHONE}`);
    expect(stored).not.toContain(sender.last());
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it('enforces the resend cooldown (429 with retryAfterSeconds)', async () => {
    const { svc, clock } = setup();
    await svc.requestOtp(PHONE, ctx);
    await expectAppError(svc.requestOtp(PHONE, ctx), 429, 'OTP_RESEND_TOO_SOON');
    clock.advance(61);
    await expect(svc.requestOtp(PHONE, ctx)).resolves.toBeDefined();
  });

  it('caps sends per phone per hour', async () => {
    const { svc, clock } = setup();
    for (let i = 0; i < 5; i++) {
      await svc.requestOtp(PHONE, ctx);
      clock.advance(61);
    }
    await expectAppError(svc.requestOtp(PHONE, ctx), 429, 'OTP_RATE_LIMITED');
  });

  it('caps sends per IP per hour across different phones', async () => {
    const { svc } = setup();
    for (let i = 0; i < 20; i++) await svc.requestOtp(`09010000${String(i).padStart(2, '0')}`, ctx);
    await expectAppError(svc.requestOtp('0909999999', ctx), 429, 'OTP_RATE_LIMITED');
  });

  it('answers a banned number exactly like any other number but sends no SMS', async () => {
    const { svc, repo, sender } = setup();
    repo.users.push(user({ status: UserStatus.BANNED }));
    const res = await svc.requestOtp(PHONE, ctx);
    expect(res).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 60 });
    expect(sender.sent).toHaveLength(0);
  });

  it('returns 503 and lets the user retry immediately when the SMS provider fails', async () => {
    const { svc, sender } = setup();
    sender.fail = true;
    await expectAppError(svc.requestOtp(PHONE, ctx), 503, 'OTP_DELIVERY_FAILED');
    sender.fail = false;
    await expect(svc.requestOtp(PHONE, ctx)).resolves.toBeDefined();
  });
});

describe('verify-otp', () => {
  it('signs in an existing patient and issues a working session', async () => {
    const { svc, repo, sender } = setup();
    repo.users.push(user());
    await svc.requestOtp(PHONE, ctx);
    const res = await svc.verifyOtp(PHONE, sender.last(), ctx);
    expect(res.status).toBe('AUTHENTICATED');
    if (res.status !== 'AUTHENTICATED') return;
    expect(res.user.phone).toBe(PHONE);
    expect(await svc.sessions.verifyAccessToken(res.tokens.accessToken)).toEqual({
      id: repo.users[0]!.id,
      role: UserRole.PATIENT,
    });
  });

  it('a code works only once (single use)', async () => {
    const { svc, repo, sender } = setup();
    repo.users.push(user());
    await svc.requestOtp(PHONE, ctx);
    const code = sender.last();
    await svc.verifyOtp(PHONE, code, ctx);
    await expectAppError(svc.verifyOtp(PHONE, code, ctx), 400, 'OTP_INVALID_OR_EXPIRED');
  });

  it('rejects an expired code (TC-USHP01-03)', async () => {
    const { svc, repo, sender, clock } = setup();
    repo.users.push(user());
    await svc.requestOtp(PHONE, ctx);
    clock.advance(301);
    await expectAppError(svc.verifyOtp(PHONE, sender.last(), ctx), 400, 'OTP_INVALID_OR_EXPIRED');
  });

  it('locks the code after 5 wrong attempts — even the right code then fails', async () => {
    const { svc, repo, sender } = setup();
    repo.users.push(user());
    await svc.requestOtp(PHONE, ctx);
    const right = sender.last();
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) await expectAppError(svc.verifyOtp(PHONE, wrong, ctx), 400, 'OTP_INVALID_OR_EXPIRED');
    await expectAppError(svc.verifyOtp(PHONE, wrong, ctx), 400, 'OTP_ATTEMPTS_EXCEEDED');
    await expectAppError(svc.verifyOtp(PHONE, right, ctx), 400, 'OTP_INVALID_OR_EXPIRED');
  });

  it('reports attemptsRemaining on a wrong code', async () => {
    const { svc, sender } = setup();
    await svc.requestOtp(PHONE, ctx);
    const wrong = sender.last() === '000000' ? '111111' : '000000';
    try {
      await svc.verifyOtp(PHONE, wrong, ctx);
    } catch (e) {
      expect((e as AppError).details).toEqual({ attemptsRemaining: 4 });
    }
  });

  it('new phone → REGISTRATION_REQUIRED → complete-registration creates a PATIENT (TC-USHP01-01)', async () => {
    const { svc, repo, sender } = setup();
    await svc.requestOtp(PHONE, ctx);
    const res = await svc.verifyOtp(PHONE, sender.last(), ctx);
    expect(res.status).toBe('REGISTRATION_REQUIRED');
    if (res.status !== 'REGISTRATION_REQUIRED') return;

    const done = await svc.completeRegistration(res.registrationToken, { fullName: 'Tran B', role: UserRole.PATIENT }, ctx);
    expect(done.user.role).toBe(UserRole.PATIENT);
    expect(repo.users).toHaveLength(1);
    // registration token is single-use
    await expectAppError(
      svc.completeRegistration(res.registrationToken, { fullName: 'Tran B', role: UserRole.PATIENT }, ctx),
      400,
      'REGISTRATION_TOKEN_INVALID',
    );
  });

  it('never creates a duplicate account for the same phone (TC-USHP01-02)', async () => {
    const { svc, repo, sender } = setup();
    await svc.requestOtp(PHONE, ctx);
    const res = await svc.verifyOtp(PHONE, sender.last(), ctx);
    if (res.status !== 'REGISTRATION_REQUIRED') throw new Error('expected registration');
    repo.users.push(user()); // someone registered the number in between
    await expectAppError(
      svc.completeRegistration(res.registrationToken, { fullName: 'X Y', role: UserRole.NURSE }, ctx),
      409,
      'PHONE_ALREADY_REGISTERED',
    );
  });

  it('banned nurse profile → 403 ACCOUNT_BANNED, no session', async () => {
    const { svc, repo, sender, kv } = setup();
    repo.users.push(user({ role: UserRole.NURSE, nurseProfileStatus: ProfileStatus.BANNED }));
    // banned numbers get no SMS, so plant a code directly to test the verify guard
    await svc.requestOtp('0902000002', ctx); // unrelated, just to have a code format
    const code = sender.last();
    await kv.set(`otp:code:${PHONE}`, createHmac('sha256', 'x'.repeat(40)).update(`otp:${PHONE}:${code}`).digest('hex'), 300);
    await expectAppError(svc.verifyOtp(PHONE, code, ctx), 403, 'ACCOUNT_BANNED');
  });

  it('suspended nurse can still sign in (to pay debt / top up deposit)', async () => {
    const { svc, repo, sender } = setup();
    repo.users.push(user({ role: UserRole.NURSE, nurseProfileStatus: ProfileStatus.SUSPENDED }));
    await svc.requestOtp(PHONE, ctx);
    const res = await svc.verifyOtp(PHONE, sender.last(), ctx);
    expect(res.status).toBe('AUTHENTICATED');
  });

  it('ADMIN never gets a session from OTP alone (TC-USHP05-01)', async () => {
    const { svc, repo, sender } = setup();
    repo.users.push(user({ role: UserRole.ADMIN }));
    await svc.requestOtp(PHONE, ctx);
    const res = await svc.verifyOtp(PHONE, sender.last(), ctx);
    expect(res.status).toBe('SECOND_FACTOR_REQUIRED');
    expect('tokens' in res).toBe(false);
    if (res.status === 'SECOND_FACTOR_REQUIRED') expect(res.enrolled).toBe(false);
  });
});

describe('sessions', () => {
  async function signedIn() {
    const s = setup();
    s.repo.users.push(user());
    await s.svc.requestOtp(PHONE, ctx);
    const res = await s.svc.verifyOtp(PHONE, s.sender.last(), { ...ctx, deviceId: 'phone-1' });
    if (res.status !== 'AUTHENTICATED') throw new Error('expected session');
    return { ...s, tokens: res.tokens };
  }

  it('access token expires after ACCESS_TOKEN_TTL_MINUTES', async () => {
    const { svc, tokens, clock } = await signedIn();
    clock.advance(15 * 60 + 1);
    expect(await svc.sessions.verifyAccessToken(tokens.accessToken)).toBe(null);
  });

  it('refresh rotates both tokens; the old refresh and old access stop working', async () => {
    const { svc, tokens } = await signedIn();
    const next = await svc.sessions.refresh(tokens.refreshToken, ctx);
    expect(next.tokens.refreshToken).not.toBe(tokens.refreshToken);
    expect(await svc.sessions.verifyAccessToken(tokens.accessToken)).toBe(null);
    expect(await svc.sessions.verifyAccessToken(next.tokens.accessToken)).not.toBe(null);
    await expectAppError(svc.sessions.refresh(tokens.refreshToken, ctx), 401, 'SESSION_INVALID');
  });

  it('logout revokes the session server-side', async () => {
    const { svc, tokens } = await signedIn();
    await svc.sessions.logout(tokens.accessToken);
    expect(await svc.sessions.verifyAccessToken(tokens.accessToken)).toBe(null);
    await expectAppError(svc.sessions.refresh(tokens.refreshToken, ctx), 401, 'SESSION_INVALID');
  });

  it('revokeAllForUser kills every device immediately (ban → SEC-1.7)', async () => {
    const s = await signedIn();
    await s.clock.advance(61);
    await s.svc.requestOtp(PHONE, ctx);
    const second = await s.svc.verifyOtp(PHONE, s.sender.last(), { ...ctx, deviceId: 'laptop' });
    if (second.status !== 'AUTHENTICATED') throw new Error('expected session');

    await s.svc.sessions.revokeAllForUser(s.repo.users[0]!.id);
    expect(await s.svc.sessions.verifyAccessToken(s.tokens.accessToken)).toBe(null);
    expect(await s.svc.sessions.verifyAccessToken(second.tokens.accessToken)).toBe(null);
  });

  it('refresh is refused and all sessions revoked once the user is banned', async () => {
    const { svc, repo, tokens } = await signedIn();
    repo.users[0]!.status = UserStatus.BANNED;
    await expectAppError(svc.sessions.refresh(tokens.refreshToken, ctx), 401, 'SESSION_INVALID');
    expect(await svc.sessions.verifyAccessToken(tokens.accessToken)).toBe(null);
  });

  it('rejects malformed tokens without touching the store', async () => {
    const { svc } = setup();
    expect(await svc.sessions.verifyAccessToken('Bearer x')).toBe(null);
    expect(await svc.sessions.verifyAccessToken('a'.repeat(500))).toBe(null);
  });
});

describe('construction', () => {
  it('refuses a short OTP secret', () => {
    expect(
      () =>
        new AccountsOtpService({
          kv: new MemoryKeyValueStore(),
          repo: new FakeRepo(),
          sender: new CapturingSender(),
          getNumber: async () => 1,
          otpSecret: 'short',
          totpKey: Buffer.alloc(32),
        }),
    ).toThrow(/OTP_SECRET/);
  });
});

describe('admin 2FA (TOTP)', () => {
  const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

  async function adminChallenge(s: ReturnType<typeof setup>) {
    if (!s.repo.users.some((u) => u.id === ADMIN_ID)) s.repo.users.push(user({ id: ADMIN_ID, role: UserRole.ADMIN }));
    await s.svc.requestOtp(PHONE, ctx);
    const res = await s.svc.verifyOtp(PHONE, s.sender.last(), ctx);
    if (res.status !== 'SECOND_FACTOR_REQUIRED') throw new Error('expected 2FA challenge');
    return res;
  }

  const codeFor = (secret: string, nowMs: number, offsetSteps = 0) =>
    hotp(base32Decode(secret), totpStep(nowMs) + offsetSteps);

  it('first sign-in: setup returns a QR URI, verify enrols and issues the session', async () => {
    const s = setup();
    const ch = await adminChallenge(s);
    const setupRes = await s.svc.setupSecondFactor(ch.challengeToken);
    expect(setupRes.otpauthUrl).toMatch(/^otpauth:\/\/totp\/HealthCareSystem%3A0901000001\?secret=/);
    expect(setupRes.secret).toMatch(/^[A-Z2-7]{32}$/);

    const done = await s.svc.verifySecondFactor(ch.challengeToken, codeFor(setupRes.secret, s.clock.now()), ctx);
    expect(done.status).toBe('AUTHENTICATED');
    expect(await s.svc.sessions.verifyAccessToken(done.tokens.accessToken)).toEqual({ id: ADMIN_ID, role: UserRole.ADMIN });
    // secret is stored encrypted, never in clear
    const stored = s.repo.totp.get(ADMIN_ID)!;
    expect(stored.startsWith('v1.')).toBe(true);
    expect(stored).not.toContain(setupRes.secret);
  });

  it('later sign-in uses the enrolled secret; setup is refused once enrolled', async () => {
    const s = setup();
    const first = await adminChallenge(s);
    const { secret } = await s.svc.setupSecondFactor(first.challengeToken);
    await s.svc.verifySecondFactor(first.challengeToken, codeFor(secret, s.clock.now()), ctx);

    s.clock.advance(61);
    const second = await adminChallenge(s);
    expect(second.enrolled).toBe(true);
    await expectAppError(s.svc.setupSecondFactor(second.challengeToken), 409, 'TOTP_ALREADY_ENROLLED');
    const ok = await s.svc.verifySecondFactor(second.challengeToken, codeFor(secret, s.clock.now()), ctx);
    expect(ok.status).toBe('AUTHENTICATED');
  });

  it('accepts ±1 time step of clock drift but not 2', async () => {
    const s = setup();
    const ch = await adminChallenge(s);
    const { secret } = await s.svc.setupSecondFactor(ch.challengeToken);
    await expectAppError(s.svc.verifySecondFactor(ch.challengeToken, codeFor(secret, s.clock.now(), -2), ctx), 400, 'TOTP_INVALID');
    const ok = await s.svc.verifySecondFactor(ch.challengeToken, codeFor(secret, s.clock.now(), -1), ctx);
    expect(ok.status).toBe('AUTHENTICATED');
  });

  it('the same authenticator code cannot be used twice (replay)', async () => {
    const s = setup();
    const first = await adminChallenge(s);
    const { secret } = await s.svc.setupSecondFactor(first.challengeToken);
    const code = codeFor(secret, s.clock.now());
    await s.svc.verifySecondFactor(first.challengeToken, code, ctx);

    // A second challenge within the same 30-second step (planted directly: the phone
    // OTP cooldown would otherwise push us past the TOTP window).
    const token = 'B'.repeat(43);
    await s.kv.set(`auth:2fa:${createHash('sha256').update(token).digest('hex')}`, JSON.stringify({ userId: ADMIN_ID }), 300);
    await expectAppError(s.svc.verifySecondFactor(token, code, ctx), 400, 'TOTP_INVALID');
  });

  it('verify before setup → TOTP_NOT_ENROLLED; no session (TC-USHP05-01)', async () => {
    const s = setup();
    const ch = await adminChallenge(s);
    await expectAppError(s.svc.verifySecondFactor(ch.challengeToken, '123456', ctx), 400, 'TOTP_NOT_ENROLLED');
  });

  it('too many wrong codes destroys the challenge (TC-USHP05-03)', async () => {
    const s = setup();
    const ch = await adminChallenge(s);
    const { secret } = await s.svc.setupSecondFactor(ch.challengeToken);
    const right = codeFor(secret, s.clock.now());
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) await expectAppError(s.svc.verifySecondFactor(ch.challengeToken, wrong, ctx), 400, 'TOTP_INVALID');
    await expectAppError(s.svc.verifySecondFactor(ch.challengeToken, wrong, ctx), 400, 'TOTP_ATTEMPTS_EXCEEDED');
    await expectAppError(s.svc.verifySecondFactor(ch.challengeToken, right, ctx), 400, 'CHALLENGE_INVALID');
  });

  it('the challenge expires with the OTP TTL', async () => {
    const s = setup();
    const ch = await adminChallenge(s);
    s.clock.advance(301);
    await expectAppError(s.svc.setupSecondFactor(ch.challengeToken), 400, 'CHALLENGE_INVALID');
  });

  it('a challenge token can never be used for a non-admin', async () => {
    const s = setup();
    const ch = await adminChallenge(s);
    s.repo.users[0]!.role = UserRole.PATIENT; // role changed meanwhile
    await expectAppError(s.svc.setupSecondFactor(ch.challengeToken), 400, 'CHALLENGE_INVALID');
  });
});
