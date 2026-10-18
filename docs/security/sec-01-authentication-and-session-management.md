# Security Policy Group 1 — Authentication & Session Management

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` (BR-20, BR-21, UC1, UC14, UC15, UC40, UC82, UC83) |
| **Applicable Scope** | User Identification, Credential Storage, Email OTP Engine, Session Tokens, 2FA, Account Recovery |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |
| **System Context** | **Email-Only Authentication Model:** Because SMS and National ID (CCCD) collection are excluded (BR-20), the email authentication vector bears all operational security risks and requires hardened defenses. |

---

## Authentication & Session Rules

### SEC-1.1 [P0] Cryptographic Password Storage & Policy
- User passwords must be hashed using dedicated, memory-hard key derivation functions: **Argon2id** (recommended: minimum 19 MiB memory, 2 iterations, 1 parallelism thread) or **bcrypt** (work factor cost ≥ 12).
- Storing passwords in plaintext, reversible encryption, or fast hash functions (MD5, SHA-1, or unsalted SHA-256) is strictly prohibited.
- **Password Complexity Policy:** Minimum 10 characters. Passwords must be verified against public breached-password dictionaries (e.g., HaveIBeenPwned API or offline bloom filters). Arbitrary periodic password expiration is prohibited to avoid user-induced weak patterns.

### SEC-1.2 [P0] Five Mandatory Properties of Email OTP
Because Email OTP is the sole primary verification mechanism for patients (BR-20), every generated OTP must strictly satisfy all five security properties:
1. **Cryptographically Secure Randomness:** Minimum 6 numerical digits derived from a Cryptographically Secure Pseudo-Random Number Generator (CSPRNG).
2. **Short Validity Window:** Maximum validity window of **≤ 10 minutes** (5 minutes for initial registration/login per FR-01.1; 15 minutes for password reset).
3. **Single-Use Enforcement:** The OTP is immediately invalidated and destroyed upon its first evaluation, regardless of whether verification succeeded or failed.
4. **Brute-Force Lockout:** Account OTP verification is locked after a maximum of **5 consecutive incorrect attempts**.
5. **Rate-Limited Dispatch:** OTP dispatch frequency is strictly throttled per target email account and per requesting client IP address.

### SEC-1.3 [P0] Anti-Brute-Force & Credential Stuffing Defenses
- Enforce tiered rate limiting based on account identifier, client IP address, and client fingerprint.
- Introduce exponential backoff delays following repeated authentication failures.
- Render adaptive CAPTCHA challenges after 3 consecutive failed login attempts.
- Dispatch instantaneous email security notifications to the account owner upon logins from unrecognized devices, geographic locations, or new IP subnets.

### SEC-1.4 [P0] Mandatory Two-Factor Authentication (2FA) for Operational Roles
- Per **BR-21**, Two-Factor Authentication is **strictly mandatory** for all hospital and platform personnel: Nurse, Attending Doctor, Hospital Administrator, and Platform Administrator.
- **Factor Types:** Priority given to phishing-resistant authentication methods (FIDO2 / WebAuthn passkeys or Time-based One-Time Password / TOTP via authenticator apps).
- **Backup Recovery Codes:** Pre-generated backup codes must be stored hashed in the database and invalidated upon single use.
- **Patient Context:** While general patient logins do not mandate 2FA (BR-20), any **high-risk administrative mutation** (e.g., modifying registered email, changing password, bulk consent revocation) mandates step-up re-authentication via a newly issued Email OTP.

### SEC-1.5 [P0] Hardened Session Lifecycle Management
- Session identifiers must be high-entropy, cryptographically random strings (minimum 128 bits of entropy).
- Web session cookies must enforce strict security flags: `HttpOnly; Secure; SameSite=Lax` (or `SameSite=Strict` for sensitive administrative zones).
- Sessions must be instantaneously invalidated server-side upon password change, email address modification, or role/permission revocation.
- Idle session timeouts for clinical and administrative staff must be significantly shorter than patient session lifetimes (e.g., 15–30 minutes idle timeout).
- User logout must execute complete server-side session revocation and token blacklisting, not merely a client-side cookie deletion.

### SEC-1.6 [P0] Absolute Isolation of the Three Verification Code Types
Developers must never consolidate authentication codes into a single shared "6-digit code" handler. Per baseline **BR-20**, the system maintains three entirely separate code types with independent scopes, cryptographic stores, and lifecycles:
1. **Account Email OTP:** Used exclusively for account login, password reset, and sensitive profile operations.
2. **In-Session Care Check-In Code (UC40):** Generated dynamically within the patient's mobile app at the time of the home visit to verify physical arrival; never delivered via email.
3. **Email Consent Confirmation Token:** A cryptographic URL token dispatched to adult relatives for legal care consent; never interchangeable with user authentication credentials.

### SEC-1.7 [P0] Secure Tokenized Action Links
- All one-click action links delivered via email (consent confirmation, password reset links, email update verifications) must carry a high-entropy cryptographic token (≥ 128-bit random token).
- Tokens must be single-use, strictly time-bounded, and stored in hashed form on the server.
- Following an email link must never execute a state-changing mutation directly via an HTTP `GET` request. The link must route to an authenticated landing page where the user explicitly reviews and confirms the action.

### SEC-1.8 [P0] Formal Account Recovery Protocol for Compromised Emails
- If a user loses access to their registered email address, account recovery must follow the formally approved Customer Support Standard Operating Procedure (SOP).
- The support system must immediately apply a temporary protective freeze to the account upon receiving the recovery request.
- The identity of the requester must be verified against multi-attribute data points already established in the system (e.g., historical appointment records, validated recipient addresses).
- Modifying the account email takes effect only after an enforced **24-hour cooling-off delay**, during which security alert notifications are repeatedly dispatched to the legacy email address.
- Support personnel are strictly prohibited from generating, viewing, or manually inputting OTPs on behalf of users.

### SEC-1.9 [P1] Automated Anomaly Detection & Mass Takeover Defense
- Deploy background telemetry to monitor credential stuffing, password spraying, and mass account takeover patterns (e.g., rapid attempts across multiple accounts from common IP clusters or anomalous user-agent spikes).
- Automatically challenge staff and administrative sessions with step-up verification whenever sudden geographic displacements or suspicious device changes are detected.
