/**
 * Zalo ZNS OTP sender (OTP_CHANNEL=zns) — BE-1 / Dev A · OD-09.
 *
 * Sends the login code as a Zalo Notification Service message from the team's Zalo Official Account (OA),
 * using a ZNS template of type OTP that Zalo has approved.
 *
 *   1. OA access token (valid ~25 h) — cached in Redis until shortly before it expires.
 *   2. When missing/expired: POST https://oauth.zaloapp.com/v4/oa/access_token
 *        header  secret_key: <ZALO_APP_SECRET>, form  app_id, grant_type=refresh_token, refresh_token
 *      Zalo returns a NEW refresh token every time and the old one stops working, so the new one is stored in
 *      Redis at once. ZALO_REFRESH_TOKEN (env) is only the first one, used while Redis has none.
 *      One instance refreshes at a time (Redis lock): a second, parallel refresh would burn the token.
 *   3. POST https://business.openapi.zalo.me/message/template
 *        header  access_token, JSON  { phone: "84…", template_id, template_data: { <param>: code }, tracking_id }
 *      An access-token error drops the cached token and retries once with a fresh one.
 *
 * Never logs the code or a token. Any failure throws → accounts-otp answers 503 OTP_DELIVERY_FAILED
 * (the code is discarded, the user can ask again at once) — it never pretends a code was delivered.
 */
import { randomUUID } from 'node:crypto';
import type { KeyValueStore } from '../../core/redis';
import type { OtpSender } from './accounts-otp.types';

type Env = Record<string, string | undefined>;
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export const ZALO_TOKEN_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';
export const ZALO_ZNS_URL = 'https://business.openapi.zalo.me/message/template';

const KEYS = {
  access: 'zalo:oa:access-token',
  refresh: 'zalo:oa:refresh-token',
  lock: 'zalo:oa:refresh-lock',
};
/** Zalo refresh tokens last about 3 months; keep ours a little longer than that, Zalo decides anyway. */
const REFRESH_TTL_SECONDS = 100 * 24 * 3600;
/** Stop using an access token this long before Zalo's expiry. */
const ACCESS_MARGIN_SECONDS = 300;
const LOCK_SECONDS = 30;
const HTTP_TIMEOUT_MS = 10_000;
/** Zalo error codes that mean "this access token is no longer valid". */
const TOKEN_ERRORS = new Set([-124, -216]);

export interface ZnsConfig {
  appId: string;
  appSecret: string;
  templateId: string;
  /** Name of the code parameter in the approved template (often "otp"). */
  codeParam: string;
  /** First refresh token (from the Zalo API Explorer); later ones live in Redis. */
  initialRefreshToken: string;
  /** mode: "development" — Zalo checks the call but sends to the OA admins' test numbers only. */
  developmentMode: boolean;
}

/** Reads the ZALO_* variables. Throws listing every missing one (fail closed at startup). */
export function znsConfigFromEnv(env: Env): ZnsConfig {
  const need = ['ZALO_APP_ID', 'ZALO_APP_SECRET', 'ZALO_ZNS_OTP_TEMPLATE_ID', 'ZALO_REFRESH_TOKEN'] as const;
  const missing = need.filter((k) => !env[k]?.trim());
  if (missing.length) throw new Error(`OTP_CHANNEL=zns needs ${missing.join(', ')}`);
  return {
    appId: env.ZALO_APP_ID!.trim(),
    appSecret: env.ZALO_APP_SECRET!.trim(),
    templateId: env.ZALO_ZNS_OTP_TEMPLATE_ID!.trim(),
    codeParam: env.ZALO_ZNS_OTP_PARAM?.trim() || 'otp',
    initialRefreshToken: env.ZALO_REFRESH_TOKEN!.trim(),
    developmentMode: env.ZALO_ZNS_DEV_MODE?.trim().toLowerCase() === 'true',
  };
}

/** 0912345678 → 84912345678 (ZNS wants the international form without "+"). */
export function toZaloPhone(localPhone: string): string {
  if (!/^0\d{9}$/.test(localPhone)) throw new Error('Expected a normalised 10-digit Vietnamese mobile number');
  return `84${localPhone.slice(1)}`;
}

export class ZaloApiError extends Error {
  constructor(
    readonly step: 'token' | 'send',
    readonly zaloError: number | string | null,
    message: string,
  ) {
    super(message);
    this.name = 'ZaloApiError';
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class ZaloZnsOtpSender implements OtpSender {
  constructor(
    private readonly cfg: ZnsConfig,
    private readonly kv: KeyValueStore,
    private readonly fetchFn: FetchLike = fetch as unknown as FetchLike,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {}

  async sendLoginOtp(phone: string, code: string, _ttlSeconds?: number): Promise<void> {
    const to = toZaloPhone(phone);
    let token = await this.accessToken();
    let res = await this.send(to, code, token);
    if (res.error !== 0 && TOKEN_ERRORS.has(Number(res.error))) {
      await this.kv.del(KEYS.access);
      token = await this.accessToken();
      res = await this.send(to, code, token);
    }
    if (res.error !== 0) {
      console.error(`[accounts-otp] ZNS OTP to ***${phone.slice(-3)} failed: Zalo error ${String(res.error)} ${res.message ?? ''}`);
      throw new ZaloApiError('send', res.error ?? null, `ZNS send failed (${String(res.error)})`);
    }
    console.log(`[accounts-otp] ZNS OTP sent to ***${phone.slice(-3)}`);
  }

  /** A valid OA access token: from Redis, else refreshed (one instance at a time). */
  async accessToken(): Promise<string> {
    const cached = await this.kv.get(KEYS.access);
    if (cached) return cached;

    for (let attempt = 0; attempt < 20; attempt++) {
      if (await this.kv.setIfAbsent(KEYS.lock, '1', LOCK_SECONDS)) {
        try {
          const again = await this.kv.get(KEYS.access); // another instance may have just refreshed
          return again ?? (await this.refresh());
        } finally {
          await this.kv.del(KEYS.lock);
        }
      }
      await this.wait(250);
      const fresh = await this.kv.get(KEYS.access);
      if (fresh) return fresh;
    }
    throw new ZaloApiError('token', null, 'Timed out waiting for another instance to refresh the Zalo token');
  }

  private async refresh(): Promise<string> {
    const refreshToken = (await this.kv.get(KEYS.refresh)) ?? this.cfg.initialRefreshToken;
    const body = new URLSearchParams({ app_id: this.cfg.appId, grant_type: 'refresh_token', refresh_token: refreshToken });
    const json = (await this.post(ZALO_TOKEN_URL, { 'Content-Type': 'application/x-www-form-urlencoded', secret_key: this.cfg.appSecret }, body.toString(), 'token')) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: string | number;
      error?: number | string;
      error_name?: string;
    };
    if (!json.access_token || !json.refresh_token) {
      console.error(`[accounts-otp] Zalo token refresh failed: ${String(json.error ?? '')} ${json.error_name ?? ''} — re-authorise the OA and set a new ZALO_REFRESH_TOKEN`);
      throw new ZaloApiError('token', json.error ?? null, 'Zalo token refresh failed');
    }
    // Store the new refresh token FIRST: the old one is already spent.
    await this.kv.set(KEYS.refresh, json.refresh_token, REFRESH_TTL_SECONDS);
    const lifetime = Math.max(Number(json.expires_in) || 3600, ACCESS_MARGIN_SECONDS * 2);
    await this.kv.set(KEYS.access, json.access_token, lifetime - ACCESS_MARGIN_SECONDS);
    return json.access_token;
  }

  private async send(to: string, code: string, token: string): Promise<{ error?: number | string; message?: string }> {
    const payload: Record<string, unknown> = {
      phone: to,
      template_id: this.cfg.templateId,
      template_data: { [this.cfg.codeParam]: code },
      tracking_id: randomUUID(),
    };
    if (this.cfg.developmentMode) payload.mode = 'development';
    return (await this.post(ZALO_ZNS_URL, { 'Content-Type': 'application/json', access_token: token }, JSON.stringify(payload), 'send')) as {
      error?: number | string;
      message?: string;
    };
  }

  private async post(url: string, headers: Record<string, string>, body: string, step: 'token' | 'send'): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT_MS);
    try {
      const res = await this.fetchFn(url, { method: 'POST', headers, body, signal: ctrl.signal });
      if (!res.ok) throw new ZaloApiError(step, res.status, `Zalo ${step} HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (e instanceof ZaloApiError) throw e;
      throw new ZaloApiError(step, null, `Zalo ${step} request failed: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
