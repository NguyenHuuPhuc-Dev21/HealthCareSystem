# BR-14: Booking Prerequisites & Debt Blocks

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §2.3, §4.1 (FR-AUTH-03, FR-PRIV-01), §4.2 (FR-SCHED-01), §4.3 (FR-BOOK-02, FR-BOOK-03), §4.5 (FR-PAY-02, FR-PAY-03), §5.1  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Supersession Note:** The old customer debt lock (`Cong_no` after a 24h-unpaid invoice), the 3-active-bookings cap, and the child-order exemption are not part of SRS v2.0. Blocking in the new model is **gate-based**: identity/eKYC/consent prerequisites on the Customer side, and deposit, tier, and debt blocks keyed to `profile_status` on the Nurse side.

---

## 1. Context & Business Intent

1. **Safety Before Booking:** Home care places a stranger inside a private home and may involve invasive procedures. The platform therefore verifies the Customer's identity, the data-processing consent, and — for invasive work — the doctor's order *before* a booking can exist.
2. **Solvency & Reliability Before Claiming:** A nurse may only take jobs when their deposit is fully funded and no platform debt is outstanding, so SLA penalties and cash-job commissions are always collectible.

---

## 2. Rule Specifications

### 2.1 Customer Prerequisites — Identity & eKYC (FR-AUTH-03)
- The Customer account is phone-verified by OTP (BR-20).
- **Home care:** the Customer **must complete CCCD eKYC** (CCCD both sides + selfie) before creating a home-care booking; the booking API refuses unverified accounts (RTM TC-KYC-01).
- **Care at a hospital location:** phone verification alone is sufficient.

### 2.2 Customer Prerequisites — Health-Data Consent (FR-PRIV-01)
- The patient profile must carry an accepted Nghị định 13/2023 health-data consent (`data_consent_accepted` with `consent_timestamp`); the booking API checks consent at creation (BR-17). Without consent, no profile and no booking.

### 2.3 Customer Prerequisites — Invasive Bookings (FR-BOOK-02)
- Invasive bookings (`is_invasive = true`) require the **doctor's order (y lệnh) image** at creation (issue date ≤ 7 days); missing attachment → **HTTP 400**.
- The booking is held for **Admin review of the y lệnh (`PENDING_ADMIN_REVIEW`)** before matching (BR-13 §2.3).
- **Prohibited services can never be booked**: creation is blocked for `is_prohibited = true` services (BR-09 §2.5).

### 2.4 Customer Prerequisites — Payment Method & Prepayment (FR-PAY-01)
- Every booking records `payment_method` (`BANK_TRANSFER` | `CASH`) at creation.
- **Bank transfer:** 100% prepayment into simulated escrow within the 15-minute hold, otherwise the booking expires (BR-03 §2.3).
- **Cash:** paid in full to the nurse at the care location at shift end; no prepayment gate applies.

### 2.5 Nurse Gate — Deposit (FR-PAY-03, FR-BOOK-03)
- A nurse may claim/accept jobs in **both** matching mechanisms only if `deposit_balance` ≥ **300,000 VNĐ** (`MIN_NURSE_DEPOSIT`), topped up **in full upfront** before the first job.
- A claim attempt below the threshold is blocked (**HTTP 403**, RTM TC-WALLET-01) with a top-up prompt.
- There is **no job-value cap** tied to the deposit, and **no progressive retention** from earnings.
- The deposit is used **exclusively** for SLA penalty deductions — never for cash-job commission (FR-PAY-02, BR-01 §2.3).

### 2.6 Nurse Blocks — Debt & Suspension Triggers (SRS §2.3)
`nurse_profiles.profile_status` (the single source of truth, BR-09 §2.8) moves to `SUSPENDED` — blocking all new job claims — when any of the following holds:
1. **Unpaid cash-job commission:** more than **24 hours** after check-out of a cash booking, the nurse has not self-transferred the 15% commission to the platform (FR-PAY-02). The block lifts when the commission is paid in full. (Commission is collected via the VietQR / Payment Link flow — `POST /api/v1/bookings/:id/commission-payment-link` — and is **never** deducted from `deposit_balance` or `available_balance`.)
2. **Deposit shortfall:** an SLA penalty deduction leaves `deposit_balance` < 300,000 VNĐ (including a recorded negative balance / deposit debt when the penalty exceeds the balance). The nurse must top back up to 300,000 VNĐ before claiming again (FR-PAY-03).
3. **TrustScore < 60** (FR-RATE-01; additionally requires retraining and Admin review to unlock, §2.3).
- `BANNED` (permanent block): no-show, forged credentials, serious ethics violations (BR-21 §2.4).

### 2.7 Schedule Conflicts (FR-SCHED-01)
- The platform prevents overlapping bookings for the assigned nurse: declared availability minus `CONFIRMED` / `IN_PROGRESS` bookings, with a **60-minute travel buffer** between consecutive shifts (BR-08 §2.4). A conflicting claim is refused regardless of the nurse's other gates.

### 2.8 Open Items
- [Not specified in SRS v2.0 — open item] A maximum number of simultaneous active bookings per customer or per patient profile (the old 3-booking cap) is not specified in SRS v2.0.
- [Not specified in SRS v2.0 — open item] A customer-side debt block equivalent to the old `Cong_no` lock is not specified; for cash bookings, customer cancellation fees are not collected through the system and are only recorded in the customer's cancellation history (§5.2 note).

---

## 3. Traceability & Dependencies

- **SRS References:** §2.3 (suspension triggers), §4.1 FR-AUTH-03 / FR-PRIV-01, §4.2 FR-SCHED-01, §4.3 FR-BOOK-02 / FR-BOOK-03, §4.5 FR-PAY-02 / FR-PAY-03, §5.1 (`MIN_NURSE_DEPOSIT`), §5.2 note (cash bookings), §10 RTM TC-KYC-01 / TC-WALLET-01 / TC-BOOK-01
- **API Endpoints:** `POST /api/v1/bookings`, `POST /api/v1/bookings/:id/commission-payment-link`
- **Related Rules:** BR-09 (tier gate & eligibility source of truth), BR-17 (consent), BR-20 (identity), BR-21 (credentialing & lifecycle)
