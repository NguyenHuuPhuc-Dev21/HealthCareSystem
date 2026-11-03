# API contract — `accounts-otp` (Phase 1, owner BE-1 / Dev A)

Base path `/api/v1/auth`. All bodies are JSON. Unknown fields are rejected (`400 VALIDATION_ERROR`).
Envelope: success `{ "success": true, "data": … }` · error `{ "success": false, "error": { "code", "message", "details?" } }`.

Phone numbers are accepted as `0901000001`, `+84 901 000 001`, `84901000001`, `0901.000.001`… and always returned as `0901000001`.

## Sign-in flow

```
request-otp ──► verify-otp ──┬─ AUTHENTICATED ─────────────► use accessToken
                             ├─ REGISTRATION_REQUIRED ─► complete-registration ─► use accessToken
                             └─ SECOND_FACTOR_REQUIRED (ADMIN) ─► verify-2fa (coming next)
access token expires ─► refresh (rotates both tokens) · logout ─► session revoked
```

Send the access token as `Authorization: Bearer <accessToken>`.

---

### `POST /auth/request-otp`
```json
{ "phone": "0903000003" }
```
`200`
```json
{ "success": true, "data": { "expiresInSeconds": 300, "resendAfterSeconds": 60, "devOtp": "482913" } }
```
- The answer is the same whether the number is registered or not.
- `devOtp` appears **only** on dev/staging with `OTP_DEV_ECHO=true` (no SMS provider yet). Never in production.

| Error | When |
|---|---|
| `429 OTP_RESEND_TOO_SOON` | asked again before `resendAfterSeconds`; `details.retryAfterSeconds` |
| `429 OTP_RATE_LIMITED` | hourly cap per phone or per IP reached |
| `503 OTP_DELIVERY_FAILED` | SMS provider failed — the user may retry immediately |

### `POST /auth/verify-otp`
```json
{ "phone": "0903000003", "otp": "482913", "deviceId": "optional-stable-device-id" }
```
`200` — one of three shapes, switch on `data.status`:
```json
{ "status": "AUTHENTICATED",
  "user": { "id": "…", "phone": "0903000003", "fullName": "…", "role": "PATIENT", "kycStatus": "UNVERIFIED" },
  "tokens": { "tokenType": "Bearer", "accessToken": "…", "accessTokenExpiresIn": 900,
              "refreshToken": "…", "refreshTokenExpiresIn": 2592000 } }
```
```json
{ "status": "REGISTRATION_REQUIRED", "registrationToken": "…", "expiresInSeconds": 300 }
```
```json
{ "status": "SECOND_FACTOR_REQUIRED", "challengeToken": "…", "expiresInSeconds": 300 }
```

| Error | When |
|---|---|
| `400 OTP_INVALID_OR_EXPIRED` | wrong, expired or already used; `details.attemptsRemaining` on a wrong code |
| `400 OTP_ATTEMPTS_EXCEEDED` | too many wrong tries — request a new code |
| `403 ACCOUNT_BANNED` | account permanently locked |

### `POST /auth/complete-registration` (first sign-in of a new number)
```json
{ "registrationToken": "…", "fullName": "Nguyễn Văn A", "role": "PATIENT", "deviceId": "optional" }
```
`role`: `PATIENT` from Patient Web/App, `NURSE` from Nurse Web/App. Admin accounts cannot self-register.
`201` → same body as `AUTHENTICATED` above.

| Error | When |
|---|---|
| `400 REGISTRATION_TOKEN_INVALID` | expired or already used — verify the phone again |
| `409 PHONE_ALREADY_REGISTERED` | number was registered meanwhile — sign in instead |

A new nurse is only an account at this point: next step is `POST /auth/nurse-onboarding` (eKYC). Job eligibility stays governed by `nurse_profiles.profile_status`.

### `POST /auth/refresh`
```json
{ "refreshToken": "…" }
```
`200` → `{ "user": {…}, "tokens": {…} }` (new access **and** new refresh token; the old refresh token is now invalid).
`401 SESSION_INVALID` → send the user back to sign-in.

### `POST /auth/logout` — `Authorization: Bearer …`
`200` → `{ "loggedOut": true }`. Revokes the session server-side.

### `GET /auth/me` — `Authorization: Bearer …`
`200` → the `user` object. `401 UNAUTHORIZED` if the token is missing, expired or revoked.

## Notes for FE
- Store the refresh token securely (mobile: secure storage). On any `401`, try `refresh` once, then go to sign-in.
- A banned/suspended state change revokes all sessions immediately; handle `401` anywhere.
- Parameters (OTP length, lifetimes, limits) come from `system_configs` and may change — do not hardcode countdowns; use `expiresInSeconds` / `resendAfterSeconds` from the response.
