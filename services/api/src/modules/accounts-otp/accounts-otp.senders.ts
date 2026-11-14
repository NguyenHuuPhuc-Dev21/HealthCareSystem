/**
 * OTP delivery channels for accounts-otp (BE-1 / Dev A). OD-09.
 *
 *   OTP_CHANNEL=mock  development / staging: nothing is sent. The code is kept in a mock inbox
 *                     (Redis, same lifetime as the OTP) that testers read through
 *                     GET /auth/dev/otp-inbox. Refused in production.
 *   OTP_CHANNEL=zns   Zalo ZNS (the channel the team chose). Not implemented yet: the team has
 *                     no Zalo Official Account / approved OTP template, so the server refuses
 *                     to start with it — it never pretends a code was delivered.
 *
 * Unset: `mock` outside production; in production the variable is required.
 * Adding the real sender = one class implementing `OtpSender` + one branch in `createOtpDelivery`.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { KeyValueStore } from '../../core/redis';
import type { MockOtpInbox, MockOtpMessage, OtpSender } from './accounts-otp.types';

export type OtpChannel = 'mock' | 'zns';

type Env = Record<string, string | undefined>;

/** Reads OTP_CHANNEL. Throws on an unknown value, and on `mock` / unset in production. */
export function resolveOtpChannel(env: Env): OtpChannel {
  const raw = env.OTP_CHANNEL?.trim().toLowerCase();
  const production = env.NODE_ENV === 'production';
  if (!raw) {
    if (production) throw new Error('OTP_CHANNEL is required in production (OD-09)');
    return 'mock';
  }
  if (raw !== 'mock' && raw !== 'zns') {
    throw new Error(`OTP_CHANNEL must be "mock" or "zns" (got "${raw}")`);
  }
  if (raw === 'mock' && production) {
    throw new Error('OTP_CHANNEL=mock must not be used in production');
  }
  return raw;
}

const inboxKey = (phone: string) => `otp:mock:${phone}`;
const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Mock channel: the "SMS" lands in Redis instead of on a phone.
 * This is the only place a login code exists in clear text, which is why the channel is
 * refused in production. The code is never written to the log.
 */
export class MockInboxOtpSender implements OtpSender, MockOtpInbox {
  /**
   * @param accessKey when set (OTP_MOCK_INBOX_KEY), reading the inbox requires this key —
   *                  use it on any environment reachable from outside the team (staging).
   */
  constructor(
    private readonly kv: KeyValueStore,
    private readonly accessKey?: string,
    private readonly now: () => number = Date.now,
  ) {}

  async sendLoginOtp(phone: string, code: string, ttlSeconds: number): Promise<void> {
    const issuedAt = this.now();
    const message: MockOtpMessage = {
      phone,
      code,
      channel: 'mock',
      issuedAt: new Date(issuedAt).toISOString(),
      expiresAt: new Date(issuedAt + ttlSeconds * 1000).toISOString(),
    };
    // One message per phone: a new code replaces the previous one, like the OTP itself.
    await this.kv.set(inboxKey(phone), JSON.stringify(message), ttlSeconds);
    console.log(`[accounts-otp] OTP for ***${phone.slice(-3)} stored in the mock inbox (OTP_CHANNEL=mock)`);
  }

  async latest(phone: string): Promise<MockOtpMessage | null> {
    const raw = await this.kv.get(inboxKey(phone));
    return raw ? (JSON.parse(raw) as MockOtpMessage) : null;
  }

  isAuthorized(presentedKey: string | undefined): boolean {
    if (!this.accessKey) return true;
    if (!presentedKey) return false;
    // Compare digests so the comparison is constant-time whatever the lengths are.
    return timingSafeEqual(digest(presentedKey), digest(this.accessKey));
  }
}

export interface OtpDelivery {
  sender: OtpSender;
  /** Present only on the mock channel. */
  mockInbox: MockOtpInbox | null;
}

/** Builds the sender for the configured channel. Fails closed: no silent fallback to mock. */
export function createOtpDelivery(env: Env, kv: KeyValueStore): OtpDelivery {
  const channel = resolveOtpChannel(env);
  if (channel === 'zns') {
    throw new Error(
      'OTP_CHANNEL=zns is not implemented yet (OD-09): it needs a Zalo Official Account and an approved ZNS OTP template',
    );
  }
  const inbox = new MockInboxOtpSender(kv, env.OTP_MOCK_INBOX_KEY?.trim() || undefined);
  return { sender: inbox, mockInbox: inbox };
}
