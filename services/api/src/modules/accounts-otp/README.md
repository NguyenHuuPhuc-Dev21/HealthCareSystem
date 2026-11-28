# Module `accounts-otp` (BE-1 / Dev A · Phase 1)

Phone number + OTP sign-in, first-time registration, and session management for every role.

- **SRS:** §8 `POST /api/v1/auth/request-otp`, `POST /api/v1/auth/verify-otp` · FR-AUTH-03 · §2.1 actors
- **Stories:** US-HP-01 (customer sign-in), US-HP-05 (Admin mandatory 2FA)
- **Security:** SEC-1.1, 1.2, 1.4, 1.5, 1.7, 1.8 (`docs/security/sec-01-…`)
- **API contract:** [`docs/api/accounts-otp.api.md`](../../../../../docs/api/accounts-otp.api.md)

## Files

| File | Role |
|---|---|
| `accounts-otp.routes.ts` | Express routes under `/api/v1/auth` |
| `accounts-otp.service.ts` | OTP issue/verify, registration, `SessionManager`, real-dependency wiring |
| `accounts-otp.repo.ts` | `users` / `nurse_profiles` SQL |
| `accounts-otp.policy.ts` | who may sign in (BANNED blocked, SUSPENDED allowed), Admin needs 2FA |
| `accounts-otp.schema.ts` | Zod whitelists + Vietnamese phone normalisation (`0xxxxxxxxx`) |
| `accounts-otp.types.ts` | DTOs and interfaces (`AccountsRepo`, `OtpSender`) |
| `accounts-otp.senders.ts` | OTP delivery channels: `OTP_CHANNEL` selection, mock inbox (dev/staging) |
| `accounts-otp.zns.ts` | Zalo ZNS sender (`OTP_CHANNEL=zns`): OA token refresh (rotating refresh token kept in Redis), template send |
| `accounts-otp.totp.ts` | RFC 6238 TOTP + AES-256-GCM encryption of Admin secrets (node:crypto only) |
| — `jobs.ts` | not needed: every expiry is a Redis TTL, no business timer |

## Rules implemented

- OTP: CSPRNG, `OTP_LENGTH` digits, valid `OTP_TTL_SECONDS`, stored only as HMAC-SHA256 with `OTP_SECRET`, single use, invalid after `OTP_MAX_VERIFY_ATTEMPTS` wrong tries.
- Throttling: `OTP_RESEND_COOLDOWN_SECONDS` per phone, `OTP_MAX_SENDS_PER_PHONE_PER_HOUR`, `OTP_MAX_SENDS_PER_IP_PER_HOUR`.
- Brute-force lock (Phase 8, migration `0032`): wrong codes are also counted per phone over one hour, across every code;
  at `OTP_MAX_FAILED_VERIFY_PER_PHONE_PER_HOUR` (10) the phone is locked for `OTP_LOCKOUT_MINUTES` (60) → `429 OTP_LOCKED`,
  no verify and no new SMS. A successful sign-in clears the count. Admin authenticator codes: same, per Admin → `429 TOTP_LOCKED`.
- Anti-enumeration: `request-otp` gives the same answer for any number; banned numbers get no SMS.
- Admin 2FA: `verify-otp` → `SECOND_FACTOR_REQUIRED` (+ `enrolled`). First time `/2fa/setup` returns a QR URI;
  `/verify-2fa` enrols and signs in. Secrets AES-256-GCM encrypted (`TOTP_ENCRYPTION_KEY`), ±30 s drift,
  each code usable once, challenge destroyed after `OTP_MAX_VERIFY_ATTEMPTS` wrong codes. Migration `0004`.
- Sessions: opaque random tokens hashed in Redis — revocable immediately. Refresh tokens rotate and are single-use.
  Admin refresh tokens expire after `ADMIN_SESSION_IDLE_MINUTES` idle.
- All numbers come from `system_configs` (migration `0003`). **Values are proposed and pending PO approval (OD-09).**

## For other modules

```ts
import { revokeAllSessionsForUser } from '../accounts-otp/accounts-otp.service';
await revokeAllSessionsForUser(userId); // on BAN / SUSPEND / phone re-binding (SEC-1.7)
```

## Open items

1. **Admin 2FA backup codes / reset** — SEC-1.5 asks for single-use backup codes; not built yet. A lost
   authenticator is reset by clearing `users.totp_secret_enc` + `totp_enabled_at` (future admin-users action, audited).
   First enrolment relies on the phone OTP only — seed Admin phones must be real, controlled numbers.
2. **Zalo ZNS: the code is written, the accounts are not** (OD-09) — the sender exists (`accounts-otp.zns.ts`), but it
   only works once the team has the Zalo Official Account, the app and an approved OTP template (see below).
   Until then keep `OTP_CHANNEL=mock`; production refuses to start without a real channel.
3. **Login audit** — SEC-1.5 asks to record Admin logins (IP, device). `audit_action_enum` has no login action yet (BE-3 owns `core/audit`).
4. **Web cookies** — tokens are returned in the JSON body (works for mobile + web). HttpOnly cookie delivery for web (SEC-1.7) to agree with FE-1.

## Zalo ZNS setup (OTP_CHANNEL=zns)

1. **Zalo Official Account (OA)** — create it at oa.zalo.me and get it verified by Zalo (business OA).
2. **Zalo app** — at developers.zalo.me create an app, link it to the OA, enable ZNS; note **App ID** and **App Secret**.
3. **ZNS template of type OTP** — register it in the ZNS dashboard with one parameter for the code (e.g. `otp`) and
   wait for Zalo's approval; note the **template id**. Top up the ZNS balance (each message is billed).
4. **First refresh token** — API Explorer (developers.zalo.me/tools/explorer) → *OA Access Token* → grant → copy the
   **refresh token**.
5. `services/api/.env`:
   ```
   OTP_CHANNEL=zns
   ZALO_APP_ID=...            ZALO_APP_SECRET=...
   ZALO_ZNS_OTP_TEMPLATE_ID=...   ZALO_ZNS_OTP_PARAM=otp
   ZALO_REFRESH_TOKEN=...     ZALO_ZNS_DEV_MODE=true   # first tests: only the OA's test numbers receive it
   OTP_DEV_ECHO=false
   ```
6. Restart the API, request an OTP for a number that has Zalo → the code arrives as a Zalo message.

How tokens work: the access token (~25 h) is cached in Redis (`zalo:oa:access-token`). On expiry the sender
refreshes it; **Zalo returns a new refresh token each time and the old one stops working**, so the new one is saved in
Redis (`zalo:oa:refresh-token`) and `ZALO_REFRESH_TOKEN` is only used while Redis has none. One instance refreshes at a
time (Redis lock). If Redis is wiped, or the refresh token is unused for ~3 months, repeat step 4.

Failures (Zalo error, timeout, token refresh refused) → `503 OTP_DELIVERY_FAILED`; the code is discarded and the user
can ask again at once. The code and the tokens are never logged.
