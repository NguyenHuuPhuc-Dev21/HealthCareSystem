# Security Policy Group 1 — Authentication & Session Management

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (§8 auth endpoints, FR-AUTH-01…03, FR-PRIV-01) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | Phone + OTP Authentication, eKYC Identity Proofing, Credential Storage, Session Tokens (Web + Mobile), Admin 2FA, Account Recovery |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |
| **System Context** | **Phone + OTP Authentication Model:** Customers and nurses authenticate with their phone number and a one-time code (`POST /api/v1/auth/request-otp`, `POST /api/v1/auth/verify-otp`). Identity for higher-trust operations is established separately by eKYC (CCCD + live selfie). Email is a profile attribute, **not** an authentication factor. |

---

## Authentication & Session Rules

### SEC-1.1 [P0] Primary Authentication: Phone Number + OTP
- Login for the `PATIENT` and `NURSE` roles is phone-number + OTP only, via the two SRS §8 endpoints:
  - `POST /api/v1/auth/request-otp` — issues a code to the registered phone number.
  - `POST /api/v1/auth/verify-otp` — verifies the code and issues the session.
- The phone number is the account's unique login identifier (`users.phone`, UNIQUE). An OTP request for an unregistered number must return a response indistinguishable from a registered one (anti-enumeration, SEC-4.4).
- OTP delivery uses the SMS/ZNS channel; OTP codes must never be delivered via push notification payloads or in-app messages, and must never appear in application logs (SEC-3.5).

### SEC-1.2 [P0] Mandatory Properties of the Login OTP
Every generated OTP must strictly satisfy all five security properties *(numeric parameters are a retained engineering standard — not specified in SRS v2.0)*:
1. **Cryptographically Secure Randomness:** Minimum 6 numerical digits derived from a Cryptographically Secure Pseudo-Random Number Generator (CSPRNG).
2. **Short Validity Window:** Maximum validity of **≤ 5 minutes** from issuance.
3. **Single-Use, Atomic Consumption:** The OTP is invalidated the moment it is successfully verified, and verification attempts are serialized so the same code cannot be redeemed twice concurrently (see SEC-6.5).
4. **Brute-Force Lockout:** Verification for an account is locked after a maximum of **5 consecutive incorrect attempts**; a new code must be requested.
5. **Rate-Limited Dispatch:** OTP issuance is throttled per phone number and per requesting IP/device (e.g., minimum resend interval and hourly cap), with the limits enforced server-side.

### SEC-1.3 [P0] Identity Proofing (eKYC) Is Separate from Login
Authentication (who controls this phone) and identity proofing (who this person legally is) are separate layers and must never be conflated:
- **Nurses:** Onboarding (`POST /api/v1/auth/nurse-onboarding`) requires CCCD (both sides), a live-captured portrait, graduation degree, and GPHN where applicable (FR-AUTH-01). The account remains `PENDING_VERIFICATION` until an Admin approves the credentials (`nurse_credentials.reviewed_by` → `users.id` of the Admin) and assigns the tier (FR-AUTH-02). An OTP login alone never grants job-claim rights.
- **Customers:** Phone + OTP suffices for bookings at a hospital location; bookings for care at a private home (`location_type = HOME`) additionally require completed CCCD eKYC (`users.kyc_status = VERIFIED`) before the booking can be created (FR-AUTH-03, CT-14).
- Check-in identity at the care location is proven by GPS + live selfie (FR-SHIFT-01), not by any reusable code: gallery uploads are blocked and mock-location flags reject the check-in (SEC-7.1).

### SEC-1.4 [P0] Cryptographic Credential Storage
- Where passwords exist (`users.password_hash`), they must be hashed using a dedicated, memory-hard key derivation function: **Argon2id** (recommended: minimum 19 MiB memory, 2 iterations, 1 parallelism thread) or **bcrypt** (work factor cost ≥ 12), per SRS §6 (NFR-SEC-01).
- OTP codes must be stored only as salted hashes (e.g., bcrypt/Argon2 or HMAC with a server-side secret); plaintext OTP storage is prohibited.
- Storing passwords or OTPs in plaintext, reversible encryption, or fast hash functions (MD5, SHA-1, unsalted SHA-256) is strictly prohibited.

### SEC-1.5 [P0] Mandatory Two-Factor Authentication (2FA) for the Admin Portal
- Two-Factor Authentication is **strictly mandatory** for all Admin Portal accounts (`ADMIN`, and `Super Admin` operations in particular). An Admin session is not fully established until the second factor succeeds.
- **Factor Types:** Priority given to phishing-resistant methods (FIDO2 / WebAuthn passkeys or TOTP via authenticator apps) *(retained engineering standard — not specified in SRS v2.0)*.
- **Access Logging:** Every Admin login records the IP address and Device ID (mirroring the consent-record requirement of FR-PRIV-01), and every privileged Admin action is written to `audit_logs` (SEC-9.1).
- **Backup Recovery Codes:** Pre-generated backup codes must be stored hashed and invalidated upon single use *(retained engineering standard — not specified in SRS v2.0)*.
- Customers and nurses do not use 2FA in the MVP model; instead, high-risk self-service mutations on those accounts (changing the registered phone number, adding a withdrawal bank account) require a fresh OTP step-up to the currently registered number *(retained engineering standard — not specified in SRS v2.0)*.

### SEC-1.6 [P0] Separation of Verification Mechanisms
Developers must never consolidate distinct verification mechanisms into a single shared handler:
1. **Login OTP:** Proves control of the registered phone number; consumed by `/auth/verify-otp` only.
2. **eKYC Artifacts:** CCCD images and liveness selfies prove legal identity at onboarding; they are evidence records in `nurse_credentials`, never login credentials.
3. **Signed-URL Tokens:** Object-storage pre-signed URLs (10-minute validity, NFR-SEC-01) authorize one file download for one authorized viewer; they are not session credentials and must not be accepted as API authentication.
4. **Webhook Secrets:** Gateway HMAC secrets authenticate payment callbacks (SEC-5.3) and are never exposed to any client.

### SEC-1.7 [P0] Hardened Session Lifecycle Management (Web + Mobile)
- Session identifiers / access tokens must be high-entropy, cryptographically random (minimum 128 bits of entropy) *(retained engineering standard — not specified in SRS v2.0)*.
- Web session cookies must enforce `HttpOnly; Secure; SameSite=Lax` (or `SameSite=Strict` for the Admin Portal).
- Sessions must be invalidated server-side upon: phone-number change, credential reset, and any lifecycle change that removes access rights — `users.status` → `SUSPENDED`/`BANNED`, or `nurse_profiles.profile_status` → `SUSPENDED`/`BANNED` (see SEC-2.8). A banned nurse's existing sessions must stop working immediately, not at token expiry.
- Idle timeout for Admin Portal sessions must be significantly shorter than for customer/nurse sessions (e.g., 15–30 minutes) *(retained engineering standard — not specified in SRS v2.0)*.
- Logout must execute complete server-side session revocation, not merely client-side token deletion. Mobile refresh tokens must be bound to the device and revocable per device.

### SEC-1.8 [P0] Anti-Brute-Force & Credential Stuffing Defenses
- Enforce tiered rate limiting on `/auth/request-otp` and `/auth/verify-otp` by phone number, client IP, and device fingerprint — OTP endpoints are the platform's primary credential-stuffing and SMS-toll-fraud surface.
- Introduce exponential backoff following repeated verification failures, and alert operations on abnormal OTP dispatch volumes (cost and takeover signal, SEC-9.2).
- *(Retained engineering standard — not specified in SRS v2.0:)* adaptive CAPTCHA challenges after repeated failures on web surfaces, and security notifications to the account owner upon logins from unrecognized devices.

### SEC-1.9 [P0] Formal Account Recovery Protocol
- If a user loses access to their registered phone number, recovery follows the approved Customer Support SOP: the account is temporarily frozen on request, identity is re-proven by full eKYC (CCCD + live selfie matched against the onboarding artifacts), and only then is the phone number re-bound.
- Support personnel are strictly prohibited from generating, viewing, or manually inputting OTPs on behalf of users.
- Phone-number re-binding must be audit-logged and must invalidate all existing sessions and devices.

### SEC-1.10 [P1] Automated Anomaly Detection & Mass Takeover Defense
- Deploy background telemetry to monitor OTP flooding, credential stuffing, and mass account takeover patterns (e.g., rapid attempts across many phone numbers from common IP clusters).
- Automatically challenge Admin sessions with step-up verification whenever sudden geographic displacements or suspicious device changes are detected *(retained engineering standard — not specified in SRS v2.0)*.
