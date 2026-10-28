# BR-20: Phone + OTP Identity and Communication Channels

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §2.1, §4.1 (FR-AUTH-01, FR-AUTH-03), §4.6 (FR-NOTIF-01, FR-CHAT-01), §7, §8  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Supersession Note:** This rule **replaces the former email-only identity rule in full**. The file name and BR-20 code are retained for traceability; identity is now phone-based. Email is no longer the account identifier, SMS is no longer prohibited (it is the fallback channel), and CCCD eKYC is now collected (see BR-21, BR-14).

---

## 1. Context & Business Intent

1. **Phone as Primary Identity:** Customers and Nurses register and sign in with a **phone number verified by OTP** (SRS §8). The `users.phone` field is `UNIQUE` and is the account identifier (SRS §7).
2. **Verified Identity for Home Care:** Because care is delivered in private homes, identity assurance is raised beyond the old model: Customers complete **CCCD eKYC** before booking home care (FR-AUTH-03), and Nurses complete full eKYC credentialing (BR-21).
3. **Privacy-Preserving Communication:** All Customer↔Nurse communication runs inside the app with **phone numbers fully masked**, both to protect privacy and to prevent off-platform leakage (RISK-06).

---

## 2. Rule Specifications

### 2.1 Phone + OTP Authentication (SRS §8)
- Registration and sign-in for `PATIENT` and `NURSE` accounts use OTP over the registered phone number:
  - `POST /api/v1/auth/request-otp` — request an OTP sent to the registered phone number.
  - `POST /api/v1/auth/verify-otp` — verify the OTP and issue the application session.
- Nurse onboarding (eKYC submission) starts from the phone-verified account: `POST /api/v1/auth/nurse-onboarding` (BR-21).
- [Not specified in SRS v2.0 — open item] OTP validity window, resend limits, and failed-attempt lockout thresholds are not fixed by SRS v2.0. (The `users` schema also retains `email` and `password_hash` columns, but SRS v2.0 specifies no password-based sign-in flow.)

### 2.2 Admin Authentication — Mandatory 2FA & Access Logging
- **Admin accounts require mandatory two-factor authentication (2FA)** in addition to sign-in.
- Admin sign-ins and sensitive actions are logged with **IP address / Device ID** in `audit_logs` (SRS §7; see BR-09 §2.9).
- [Not specified in SRS v2.0 — open item] The second-factor mechanism for Admins (authenticator app vs. OTP channel) is not specified in SRS v2.0.

### 2.3 Identity Verification (eKYC) — Replaces the Old "No CCCD" Rule
- **Nurses:** CCCD (both sides), live portrait photo, degree, and GPHN (if any) are mandatory onboarding documents (FR-AUTH-01, BR-21).
- **Customers:** CCCD eKYC is **mandatory before booking home-care services**; for care located at a hospital, phone verification alone is sufficient (FR-AUTH-03).

### 2.4 In-App Communication with Masked Phone Numbers (FR-CHAT-01)
- The **only** communication channel between Customer and Nurse is **in-app chat and in-app calling**, opened once the booking reaches `CONFIRMED`.
- The real phone numbers of both parties are **fully masked** — never displayed or exchanged.
- The system scans message content: when a phone number or an external contact link is detected, it shows a **violation warning** to the sender and **writes a log**.
- Full chat history and call logs (`conversations_messages`) are retained as evidence for dispute resolution (FR-DISP-01).

### 2.5 Notification Channels (FR-NOTIF-01)
- **Primary channels:** Push Notification (Firebase Cloud Messaging, high priority) + In-app Notification Center + WebSocket realtime updates.
- **SMS / Zalo ZNS fallback:** For urgent events — SOS alerts, last-minute cancellation re-dispatch, and new-job alerts for elderly nurses who are offline or whose device does not acknowledge Push within **60 seconds** — the system automatically sends an SMS/ZNS to the registered phone number.
- This fallback is a deliberate reversal of the superseded email-only baseline, in which SMS was prohibited.

---

## 3. Traceability & Dependencies

- **SRS References:** §2.1 (Actors), §3 RISK-06 (platform leakage), §4.1 FR-AUTH-01 / FR-AUTH-03, §4.6 FR-NOTIF-01 / FR-CHAT-01, §7 (`users.phone`, `conversations_messages`, `notifications`, `audit_logs`), §8 (auth & OTP endpoints), §9.2 (FCM & SMS/ZNS integration)
- **API Endpoints:** `POST /api/v1/auth/request-otp`, `POST /api/v1/auth/verify-otp`, `POST /api/v1/auth/nurse-onboarding`
- **Related Rules:** BR-09 (backend authorization & audit), BR-14 (eKYC prerequisite), BR-21 (nurse credentialing)
