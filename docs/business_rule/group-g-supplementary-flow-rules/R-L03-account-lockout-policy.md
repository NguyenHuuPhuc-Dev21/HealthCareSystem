# R-L03: Account Status & Lockout Policy

> **Group:** Group G — Supplementary Activity Flow Rules  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** SRS §2.3 (nurse & wallet lifecycles), §7 (`nurse_profiles`, `users`), FR-RATE-01, FR-PAY-02, FR-PAY-03, FR-ADMIN-01, FR-AUTH-02  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **Lockout in SRS v2.0 Is a Status, Not a Sign-In Counter:** Account restriction in the SRS v2.0 model is expressed through the account/profile **status lifecycles** — a nurse is locked out of new work by moving `profile_status` to `SUSPENDED` or `BANNED`, for defined business triggers (trust, deposit, unpaid commission, major infractions). SRS v2.0 authentication is phone + OTP; it defines **no** failed-sign-in lockout counter.
2. **Single Source of Truth:** `nurse_profiles.profile_status` is the **only** field the APIs may consult to decide a nurse's right to accept bookings (SRS §7, CT-19/CT-20). `users.status` governs the account generally and is managed by Admin (FR-ADMIN-01).

---

## 2. Rule Specifications

### 2.1 Nurse Profile Lifecycle (SRS §2.3)

`PENDING_VERIFICATION → ACTIVE ⇄ SUSPENDED → BANNED`

- **PENDING_VERIFICATION → ACTIVE:** Admin approves eKYC & credentials and assigns TIER_1_BASIC or TIER_2_SPECIALIST (FR-AUTH-01/02).
- **ACTIVE → SUSPENDED:** automatic on any trigger in §2.2.
- **SUSPENDED → ACTIVE:** when the cause is cured — deposit topped up to ≥ 300,000 VNĐ / outstanding cash commission paid / retraining completed — and Admin reviews and unlocks (SRS §2.3).
- **ACTIVE/SUSPENDED → BANNED:** on the major infractions in §2.3. BANNED is permanent.

### 2.2 Automatic Suspension Triggers

| Trigger | Source | Cure |
| :--- | :--- | :--- |
| **TrustScore < 60** | FR-RATE-01 | Retraining + Admin review (score recovery is +2 per settled ≥4-star shift, FR-RATE-01) |
| **`deposit_balance < 300,000 VNĐ`** after a `PENALTY_DEDUCT` fine | FR-PAY-03, SRS §2.3 | Top up the deposit to the full 300,000 VNĐ (`MIN_NURSE_DEPOSIT`) |
| **Cash-booking commission unpaid > 24h after check-out** | FR-PAY-02, SRS §2.3 | Self-pay the 15% commission in full via the generated VietQR/Payment Link (BR-05 §2.3) |

While `SUSPENDED`, the nurse cannot accept new bookings through either matching mechanism (FR-BOOK-03); bookings already in progress are unaffected unless Admin rules otherwise in a dispute (BR-11).

### 2.3 Permanent Ban Triggers (SRS §2.3, §5.2 row 8)

- **No-show** without a found replacement (BANNED on the first offence — BR-02 §2.2).
- **Forged credentials/GPHN** or identity documents.
- **Serious professional-ethics violations.**

### 2.4 Customer Accounts

- Customer accounts carry `users.status` (PENDING | ACTIVE | SUSPENDED | BANNED) and `kyc_status`, both manageable by Admin (FR-ADMIN-01). Verified customer fraud is sanctioned up to BANNED (BR-19 §2.1).
- Home-care booking additionally requires completed CCCD eKYC (`kyc_status = VERIFIED`); at-hospital bookings require phone verification only (FR-AUTH-03).

### 2.5 Not a Lockout: GPHN Expiry

An expired GPHN does **not** suspend or lock the account: the nurse is automatically demoted to TIER_1_BASIC and remains `ACTIVE` for non-invasive work, and is re-promoted on Admin approval of a renewed GPHN (FR-AUTH-02; BR-02 §2.5).

### 2.6 Sign-In Security — Open Item

Authentication is by phone number + OTP (`POST /api/v1/auth/request-otp`, `POST /api/v1/auth/verify-otp`). SRS v2.0 does **not** specify OTP attempt limits, OTP validity/resend throttling, or a failed-sign-in lockout counter — **[Not specified in SRS v2.0 — open item]**. The hospital baseline's rule (shared password + 2FA counter, 5 attempts → 15-minute lock) is **not** carried over: the email/password + 2FA identity model it protected no longer exists in SRS v2.0.

---

## 3. Traceability & Dependencies

- **SRS References:** SRS §2.3, §7 (`nurse_profiles.profile_status`, `users.status`, `users.kyc_status`); FR-RATE-01, FR-PAY-02, FR-PAY-03, FR-ADMIN-01, FR-AUTH-02, FR-AUTH-03
- **APIs:** `POST /api/v1/auth/request-otp`; `POST /api/v1/auth/verify-otp`; `PATCH /api/v1/admin/nurses/:id/verify`
- **Related Rules:** BR-02 (infractions & sanctions), BR-04 (deposit wallet), BR-05 (commission debt), BR-19 (customer sanctions)
