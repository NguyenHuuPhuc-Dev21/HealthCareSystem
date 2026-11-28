import { describe, expect, it } from 'vitest';
import { MemoryKeyValueStore } from '../../src/core/redis';
import { createOtpDelivery } from '../../src/modules/accounts-otp/accounts-otp.senders';
import {
  ZALO_TOKEN_URL,
  ZALO_ZNS_URL,
  ZaloApiError,
  ZaloZnsOtpSender,
  toZaloPhone,
  znsConfigFromEnv,
  type FetchLike,
} from '../../src/modules/accounts-otp/accounts-otp.zns';

/** Zalo ZNS OTP sender (OTP_CHANNEL=zns) with a fake Zalo — no network. */
const ENV = {
  OTP_CHANNEL: 'zns',
  ZALO_APP_ID: 'app-1',
  ZALO_APP_SECRET: 'secret-1',
  ZALO_ZNS_OTP_TEMPLATE_ID: 'tpl-1',
  ZALO_REFRESH_TOKEN: 'refresh-0',
};

type Call = { url: string; headers: Record<string, string>; body: string };

function fakeZalo(script: { token?: (n: number) => unknown; send?: (n: number, body: any) => unknown; status?: number } = {}) {
  const calls: Call[] = [];
  let tokens = 0;
  let sends = 0;
  const fetchFn: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    if (url === ZALO_TOKEN_URL) {
      tokens += 1;
      const json = script.token ? script.token(tokens) : { access_token: `access-${tokens}`, refresh_token: `refresh-${tokens}`, expires_in: '90000' };
      return { ok: true, status: 200, json: async () => json };
    }
    sends += 1;
    const json = script.send ? script.send(sends, JSON.parse(init.body)) : { error: 0, message: 'Success', data: { msg_id: 'm1' } };
    return { ok: (script.status ?? 200) < 400, status: script.status ?? 200, json: async () => json };
  };
  return { calls, fetchFn, tokenCalls: () => tokens };
}

const sender = (kv: MemoryKeyValueStore, fetchFn: FetchLike, env: Record<string, string> = ENV) =>
  new ZaloZnsOtpSender(znsConfigFromEnv(env), kv, fetchFn, async () => undefined);

describe('accounts-otp · Zalo ZNS sender (unit)', () => {
  it('config: every ZALO_* variable is required; the code parameter defaults to "otp"', () => {
    expect(() => znsConfigFromEnv({ OTP_CHANNEL: 'zns' })).toThrow(/ZALO_APP_ID, ZALO_APP_SECRET, ZALO_ZNS_OTP_TEMPLATE_ID, ZALO_REFRESH_TOKEN/);
    expect(znsConfigFromEnv(ENV)).toMatchObject({ codeParam: 'otp', developmentMode: false });
    expect(znsConfigFromEnv({ ...ENV, ZALO_ZNS_OTP_PARAM: 'ma_otp', ZALO_ZNS_DEV_MODE: 'true' })).toMatchObject({ codeParam: 'ma_otp', developmentMode: true });
  });

  it('phone → 84… form', () => {
    expect(toZaloPhone('0912345678')).toBe('84912345678');
    expect(() => toZaloPhone('84912345678')).toThrow();
  });

  it('first send: refreshes with the env token, stores the NEW refresh token, then sends the template', async () => {
    const kv = new MemoryKeyValueStore();
    const z = fakeZalo();
    await sender(kv, z.fetchFn).sendLoginOtp('0912345678', '123456', 300);

    const [tokenCall, sendCall] = z.calls;
    expect(tokenCall!.url).toBe(ZALO_TOKEN_URL);
    expect(tokenCall!.headers.secret_key).toBe('secret-1');
    expect(Object.fromEntries(new URLSearchParams(tokenCall!.body))).toEqual({ app_id: 'app-1', grant_type: 'refresh_token', refresh_token: 'refresh-0' });
    expect(await kv.get('zalo:oa:refresh-token')).toBe('refresh-1');

    expect(sendCall!.url).toBe(ZALO_ZNS_URL);
    expect(sendCall!.headers.access_token).toBe('access-1');
    const body = JSON.parse(sendCall!.body);
    expect(body).toMatchObject({ phone: '84912345678', template_id: 'tpl-1', template_data: { otp: '123456' } });
    expect(body.tracking_id).toEqual(expect.any(String));
    expect(body).not.toHaveProperty('mode');
  });

  it('later sends reuse the cached access token; the next refresh uses the STORED refresh token', async () => {
    const kv = new MemoryKeyValueStore();
    const z = fakeZalo();
    const s = sender(kv, z.fetchFn);
    await s.sendLoginOtp('0912345678', '111111', 300);
    await s.sendLoginOtp('0912345679', '222222', 300);
    expect(z.tokenCalls()).toBe(1);

    await kv.del('zalo:oa:access-token'); // expired
    await s.sendLoginOtp('0912345678', '333333', 300);
    const refreshes = z.calls.filter((c) => c.url === ZALO_TOKEN_URL);
    expect(new URLSearchParams(refreshes[1]!.body).get('refresh_token')).toBe('refresh-1');
    expect(await kv.get('zalo:oa:refresh-token')).toBe('refresh-2');
  });

  it('an access-token error (-124) refreshes once and retries', async () => {
    const kv = new MemoryKeyValueStore();
    await kv.set('zalo:oa:access-token', 'stale', 3600);
    const z = fakeZalo({ send: (n) => (n === 1 ? { error: -124, message: 'Access token is invalid' } : { error: 0 }) });
    await sender(kv, z.fetchFn).sendLoginOtp('0912345678', '123456', 300);
    expect(z.tokenCalls()).toBe(1);
    expect(z.calls.filter((c) => c.url === ZALO_ZNS_URL).map((c) => c.headers.access_token)).toEqual(['stale', 'access-1']);
  });

  it('any other Zalo error throws (→ 503 OTP_DELIVERY_FAILED upstream); no retry', async () => {
    const z = fakeZalo({ send: () => ({ error: -225, message: 'Invalid phone' }) });
    await expect(sender(new MemoryKeyValueStore(), z.fetchFn).sendLoginOtp('0912345678', '123456', 300)).rejects.toBeInstanceOf(ZaloApiError);
    expect(z.calls.filter((c) => c.url === ZALO_ZNS_URL)).toHaveLength(1);
  });

  it('a failed refresh throws and keeps the stored refresh token as it was', async () => {
    const kv = new MemoryKeyValueStore();
    await kv.set('zalo:oa:refresh-token', 'refresh-9', 3600);
    const z = fakeZalo({ token: () => ({ error: -14014, error_name: 'Invalid refresh token' }) });
    await expect(sender(kv, z.fetchFn).sendLoginOtp('0912345678', '123456', 300)).rejects.toMatchObject({ step: 'token' });
    expect(await kv.get('zalo:oa:refresh-token')).toBe('refresh-9');
  });

  it('HTTP errors throw', async () => {
    const z = fakeZalo({ status: 500, send: () => ({}) });
    await expect(sender(new MemoryKeyValueStore(), z.fetchFn).sendLoginOtp('0912345678', '123456', 300)).rejects.toMatchObject({ step: 'send', zaloError: 500 });
  });

  it('development mode adds mode: "development"', async () => {
    const z = fakeZalo();
    await sender(new MemoryKeyValueStore(), z.fetchFn, { ...ENV, ZALO_ZNS_DEV_MODE: 'true' }).sendLoginOtp('0912345678', '123456', 300);
    expect(JSON.parse(z.calls[1]!.body).mode).toBe('development');
  });

  it('while another instance holds the refresh lock, waits and uses its token instead of refreshing again', async () => {
    const kv = new MemoryKeyValueStore();
    await kv.set('zalo:oa:refresh-lock', '1', 30);
    const z = fakeZalo();
    let waited = 0;
    const s = new ZaloZnsOtpSender(znsConfigFromEnv(ENV), kv, z.fetchFn, async () => {
      waited += 1;
      if (waited === 2) await kv.set('zalo:oa:access-token', 'from-other-instance', 3600);
    });
    await s.sendLoginOtp('0912345678', '123456', 300);
    expect(z.tokenCalls()).toBe(0);
    expect(z.calls[0]!.headers.access_token).toBe('from-other-instance');
  });

  it('createOtpDelivery: zns builds the Zalo sender (no mock inbox); missing config fails at startup', () => {
    const d = createOtpDelivery(ENV, new MemoryKeyValueStore());
    expect(d.sender).toBeInstanceOf(ZaloZnsOtpSender);
    expect(d.mockInbox).toBeNull();
    expect(() => createOtpDelivery({ OTP_CHANNEL: 'zns' }, new MemoryKeyValueStore())).toThrow(/needs ZALO_APP_ID/);
  });
});
