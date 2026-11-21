import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { SystemConfigKey } from '@healthcare-system/shared';
import { errorHandler } from '../../src/core/middleware';
import { MemoryKeyValueStore } from '../../src/core/redis';
import { createAccountsOtpRouter } from '../../src/modules/accounts-otp/accounts-otp.routes';
import {
  MockInboxOtpSender,
  createOtpDelivery,
  resolveOtpChannel,
} from '../../src/modules/accounts-otp/accounts-otp.senders';
import { AccountsOtpService } from '../../src/modules/accounts-otp/accounts-otp.service';
import type { AccountsRepo, MockOtpInbox, OtpSender } from '../../src/modules/accounts-otp/accounts-otp.types';

/**
 * accounts-otp — OTP delivery channels (OD-09): OTP_CHANNEL selection and the mock inbox
 * that lets FE/QA sign in on dev and staging without a real SMS/ZNS provider.
 */
const PHONE = '0901000001';

function clockAt(start = 1_700_000_000_000) {
  let now = start;
  return { now: () => now, advance: (seconds: number) => void (now += seconds * 1000) };
}

describe('resolveOtpChannel', () => {
  it('defaults to mock outside production', () => {
    expect(resolveOtpChannel({})).toBe('mock');
    expect(resolveOtpChannel({ NODE_ENV: 'development', OTP_CHANNEL: '  ' })).toBe('mock');
  });

  it('accepts mock and zns, ignoring case and spaces', () => {
    expect(resolveOtpChannel({ OTP_CHANNEL: ' MOCK ' })).toBe('mock');
    expect(resolveOtpChannel({ NODE_ENV: 'production', OTP_CHANNEL: 'zns' })).toBe('zns');
  });

  it('rejects an unknown channel', () => {
    expect(() => resolveOtpChannel({ OTP_CHANNEL: 'sms' })).toThrow(/"mock" or "zns"/);
  });

  it('production: requires the variable and refuses mock', () => {
    expect(() => resolveOtpChannel({ NODE_ENV: 'production' })).toThrow(/required in production/);
    expect(() => resolveOtpChannel({ NODE_ENV: 'production', OTP_CHANNEL: 'mock' })).toThrow(/must not be used in production/);
  });
});

describe('createOtpDelivery', () => {
  it('mock channel: the sender is also the inbox', () => {
    const d = createOtpDelivery({}, new MemoryKeyValueStore());
    expect(d.mockInbox).not.toBeNull();
    expect(d.sender).toBe(d.mockInbox);
  });

  it('zns channel fails closed until it is implemented (never falls back to mock)', () => {
    expect(() => createOtpDelivery({ OTP_CHANNEL: 'zns' }, new MemoryKeyValueStore())).toThrow(/not implemented yet/);
  });
});

describe('MockInboxOtpSender', () => {
  it('keeps the latest code per phone with its lifetime', async () => {
    const clock = clockAt();
    const inbox = new MockInboxOtpSender(new MemoryKeyValueStore(clock.now), undefined, clock.now);

    await inbox.sendLoginOtp(PHONE, '111111', 300);
    clock.advance(10);
    await inbox.sendLoginOtp(PHONE, '222222', 300);

    const message = await inbox.latest(PHONE);
    expect(message).toMatchObject({ phone: PHONE, code: '222222', channel: 'mock' });
    expect(Date.parse(message!.expiresAt) - Date.parse(message!.issuedAt)).toBe(300_000);
    expect(await inbox.latest('0901000002')).toBeNull();
  });

  it('forgets the code when the OTP expires', async () => {
    const clock = clockAt();
    const inbox = new MockInboxOtpSender(new MemoryKeyValueStore(clock.now), undefined, clock.now);
    await inbox.sendLoginOtp(PHONE, '111111', 300);

    clock.advance(301);

    expect(await inbox.latest(PHONE)).toBeNull();
  });

  it('is open without an access key and requires the exact key when one is set', () => {
    const kv = new MemoryKeyValueStore();
    expect(new MockInboxOtpSender(kv).isAuthorized(undefined)).toBe(true);

    const locked = new MockInboxOtpSender(kv, 's3cret-key');
    expect(locked.isAuthorized(undefined)).toBe(false);
    expect(locked.isAuthorized('wrong')).toBe(false);
    expect(locked.isAuthorized('s3cret-key')).toBe(true);
  });
});

describe('GET /auth/dev/otp-inbox', () => {
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
  const repo: AccountsRepo = {
    findByPhone: async () => null,
    findById: async () => null,
    createUser: async () => null,
    getTotpSecretEnc: async () => null,
    enableTotp: async () => false,
  };

  function app(opts: { inbox: boolean; accessKey?: string }) {
    const kv = new MemoryKeyValueStore();
    const inbox = new MockInboxOtpSender(kv, opts.accessKey);
    const silent: OtpSender = { sendLoginOtp: async () => undefined };
    const mockInbox: MockOtpInbox | undefined = opts.inbox ? inbox : undefined;
    const service = new AccountsOtpService({
      kv,
      repo,
      sender: opts.inbox ? inbox : silent,
      ...(mockInbox ? { mockInbox } : {}),
      getNumber: async (k) => CONFIG[k]!,
      otpSecret: 'x'.repeat(40),
      totpKey: Buffer.alloc(32, 9),
    });
    const server = express();
    server.use(express.json());
    server.use('/auth', createAccountsOtpRouter(service));
    server.use(errorHandler);
    return server;
  }

  it('returns the code that request-otp just issued, and that code signs the user in', async () => {
    const server = app({ inbox: true });
    await request(server).post('/auth/request-otp').send({ phone: PHONE }).expect(200);

    const res = await request(server).get('/auth/dev/otp-inbox').query({ phone: '+84 901 000 001' }).expect(200);
    expect(res.body.data.message).toMatchObject({ phone: PHONE, channel: 'mock' });
    expect(res.body.data.message.code).toMatch(/^\d{6}$/);

    const verify = await request(server)
      .post('/auth/verify-otp')
      .send({ phone: PHONE, otp: res.body.data.message.code })
      .expect(200);
    expect(verify.body.data.status).toBe('REGISTRATION_REQUIRED');
  });

  it('answers message: null when no code is waiting, and 400 for a bad phone', async () => {
    const server = app({ inbox: true });
    const empty = await request(server).get('/auth/dev/otp-inbox').query({ phone: PHONE }).expect(200);
    expect(empty.body.data.message).toBeNull();

    const bad = await request(server).get('/auth/dev/otp-inbox').query({ phone: 'abc' }).expect(400);
    expect(bad.body.error.code).toBe('INVALID_PHONE');
    await request(server).get('/auth/dev/otp-inbox').expect(400);
  });

  it('requires X-OTP-Inbox-Key when an access key is configured', async () => {
    const server = app({ inbox: true, accessKey: 's3cret-key' });
    await request(server).get('/auth/dev/otp-inbox').query({ phone: PHONE }).expect(401);
    await request(server).get('/auth/dev/otp-inbox').query({ phone: PHONE }).set('X-OTP-Inbox-Key', 'nope').expect(401);
    await request(server).get('/auth/dev/otp-inbox').query({ phone: PHONE }).set('X-OTP-Inbox-Key', 's3cret-key').expect(200);
  });

  it('does not exist when the channel is not mock', async () => {
    await request(app({ inbox: false })).get('/auth/dev/otp-inbox').query({ phone: PHONE }).expect(404);
  });
});
