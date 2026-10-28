# BR-05: Platform Commission & Cash Handling

> **Group:** Group D — Payments, Refunds & Reconciliation  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** FR-PAY-01, FR-PAY-02, FR-PAY-03, SRS §1.3, §2.3, §5.1 (`PLATFORM_COMMISSION_RATE`), RISK-06  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **One Commission, Two Collection Paths:** The platform charges a single **15% commission** on the in-app booking price. How it is collected depends on how the customer paid: deducted at settlement for transfer bookings, self-paid by the nurse for cash bookings.
2. **The Platform Holds Money in This Model — Stated Explicitly:** This rule **supersedes** the hospital baseline's non-custodial architecture. Under SRS v2.0 the platform **does** hold prepaid customer funds in a simulated escrow ledger for `BANK_TRANSFER` bookings (SRS §1.3, FR-PAY-01). It never holds cash: cash passes directly from customer to nurse.

---

## 2. Rule Specifications

### 2.1 Commission Base & Rate (SRS §5.1)

- Rate: `PLATFORM_COMMISSION_RATE = 0.15` (**15%**), read from `system_configs` — never hard-coded.
- Base: the **booking price as displayed in the app** (`total_amount` of the booking). Commission is computed on this in-app price **even if the two parties privately agree a different price off-platform** (RISK-06).
- **Tips are excluded:** any amount the customer gives the nurse above the in-app price is a tip belonging to the nurse and is **not** commissioned (FR-PAY-01, SRS §1.3 "Cash Payment").

### 2.2 Transfer Path — Deducted at Settlement (FR-PAY-02)

- The customer prepays 100% via the gateway; funds sit in escrow (`ESCROW_HELD`) per booking (BR-04 §2.1).
- At settlement (24h after check-out or on earlier customer confirmation, with `dispute_status = NONE`), the platform deducts 15% and credits **85%** to the nurse's `available_balance`. The nurse takes no payment action.

### 2.3 Cash Path — Nurse Self-Pays the Commission (FR-PAY-02, RISK-06)

- The customer pays the nurse **100% of the in-app price in cash** at shift end. The platform holds none of this money.
- Immediately at check-out (`COMPLETED`), the system computes 15% of the in-app booking price and generates a **VietQR code / Payment Link** for that exact amount on Nurse Web & Mobile App (`POST /api/v1/bookings/:id/commission-payment-link`).
- The nurse **self-pays** the commission by bank transfer within **24 hours of check-out**. The payment is recorded as a `COMMISSION_PAYMENT` wallet transaction — kept strictly separate from `PENALTY_DEDUCT`.
- **The deposit wallet is never used for commission:** the system must not deduct cash-booking commission from `deposit_balance` (nor from `available_balance`) (FR-PAY-02, FR-PAY-03).
- When the payment gateway webhook confirms receipt of the full 15%, the booking's `payment_status` becomes `SETTLED`.
- **Late payment:** if the commission is still unpaid **24 hours after check-out**, the nurse is **SUSPENDED from new bookings** until it is paid in full (SRS §2.3).

### 2.4 Cancellation Compensation Splits Are Not Commission

The platform shares in SRS §5.2 rows 2–3 (5% when the customer cancels 2–12h ahead; 10% when cancelling <2h ahead) are **cancellation-compensation splits** of the forfeited amount, defined by the SLA matrix — they are distinct from, and do not change, the standard 15% commission on completed shifts (see BR-04 §2.4, BR-18 §2.1).

### 2.5 Anti-Leakage Controls Supporting Commission Collection (RISK-06)

- All customer↔nurse communication stays **in-app with masked phone numbers** (FR-CHAT-01); messages containing a phone number or an external contact link trigger a violation warning to the sender and are logged.
- Value that exists only inside the platform — TrustScore accrual, two-sided ratings, dispute protection, matching priority — is the retention mechanism that makes paying the 15% worthwhile (RISK-06).

### 2.6 Superseded Hospital-Baseline Mechanics

The following do **not** exist in SRS v2.0 and must not be implemented: the hospital's own gateway merchant account with funds flowing outside the platform; the nurse's 48-hour cash remittance duty to a hospital treasury; monthly platform commission invoicing to a hospital tenant; and any platform subscription fee charged to hospitals (there are no hospital tenants in this model).

---

## 3. Traceability & Dependencies

- **SRS References:** FR-PAY-01, FR-PAY-02, FR-PAY-03; SRS §1.3 (Cash Payment, Simulated Escrow), §2.3 (wallet lifecycle), §5.1; RISK-06
- **APIs:** `POST /api/v1/bookings/:id/commission-payment-link`; `POST /api/v1/payments/escrow-webhook`
- **Related Rules:** BR-04 (escrow, deposit, settlement), BR-18 (penalties vs commission debt), BR-11 (disputes), BR-02 (suspension triggers)
