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
| `accounts-otp.totp.ts` | RFC 6238 TOTP + AES-256-GCM encryption of Admin secrets (node:crypto only) |
| — `jobs.ts` | not needed: every expiry is a Redis TTL, no business timer |

## Rules implemented

- OTP: CSPRNG, `OTP_LENGTH` digits, valid `OTP_TTL_SECONDS`, stored only as HMAC-SHA256 with `OTP_SECRET`, single use, invalid after `OTP_MAX_VERIFY_ATTEMPTS` wrong tries.
- Throttling: `OTP_RESEND_COOLDOWN_SECONDS` per phone, `OTP_MAX_SENDS_PER_PHONE_PER_HOUR`, `OTP_MAX_SENDS_PER_IP_PER_HOUR`.
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
2. **SMS/ZNS provider** (OD-09) — dev uses `DevOtpSender` + `OTP_DEV_ECHO`; production refuses to start without a provider.
3. **Login audit** — SEC-1.5 asks to record Admin logins (IP, device). `audit_action_enum` has no login action yet (BE-3 owns `core/audit`).
4. **Web cookies** — tokens are returned in the JSON body (works for mobile + web). HttpOnly cookie delivery for web (SEC-1.7) to agree with FE-1.
