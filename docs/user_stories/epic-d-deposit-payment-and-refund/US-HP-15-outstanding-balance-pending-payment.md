# User Story US-HP-15: Nurse Pays the 15% Cash-Job Commission via Payment Link Within 24 Hours

> **Epic:** EPIC D — Payment & Settlement  
> **Bounded Context:** `Payment`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-15`
- **Story Title:** Nurse Pays the 15% Cash-Job Commission via Payment Link Within 24h; Overdue Amounts Block New Jobs
- **Bounded Context:** `Payment`
- **Primary Persona:** Nurse (Tier 1 / Tier 2)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-PAY-02 · FR-PAY-03 · RISK-06 · SRS §2.3 (Nurse & Wallet State Machines) · SRS §8 API `POST /api/v1/bookings/:id/commission-payment-link`

---

## 💡 Real-World Context & Problem Statement

1. **Cash jobs bypass the platform's hands — but not its commission:** For cash bookings the customer pays the nurse directly, so the platform never holds money from which to deduct its 15%. The nurse must therefore actively pay the commission back to the platform. Making this a self-service payment link with a hard 24-hour deadline — and a hard lock on new jobs when overdue — is the platform's main defence against off-platform leakage (RISK-06).
2. **The deposit wallet must never become the commission source:** The 300,000 VND deposit exists for one purpose only — SLA penalties. If the system quietly deducted cash-job commissions from it, nurses would be locked out of work by platform fees rather than by their own violations, and the penalty guarantee would be hollow. The SRS therefore forbids deducting commission from `deposit_balance` or `available_balance`: the nurse pays it by transfer, recorded as a distinct `COMMISSION_PAYMENT` transaction.

---

## 📖 User Story Statement

> As a **Nurse**,  
> After completing a cash-paid shift, I want to receive a payment link for the 15% platform commission and pay it by bank transfer within 24 hours,  
> So that my cash earnings stay mine, the platform gets its fee transparently, and my ability to accept new jobs is never blocked by a fee I have already paid.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Commission Link Generated at Check-Out
- **Given** a booking with `payment_method = CASH` reaching COMPLETED at check-out,
- **When** the shift closes,
- **Then** the system computes the commission as 15% of the in-app booking price (PLATFORM_COMMISSION_RATE = 0.15; any customer tip above the in-app price is excluded) and generates a VietQR / payment link on the Nurse Web Portal and Mobile App for exactly that amount.

### AC-02: On-Time Payment Settles the Booking
- **Given** a generated commission payment link,
- **When** the nurse transfers the full 15% and the gateway webhook confirms receipt,
- **Then** a `COMMISSION_PAYMENT` transaction is recorded and the booking's `payment_status` moves from UNPAID to SETTLED; neither `deposit_balance` nor `available_balance` is touched at any point in this flow.

### AC-03: Overdue Commission Locks New Jobs (SUSPENDED)
- **Given** a cash booking completed more than 24 hours ago with the commission still unpaid,
- **When** the deadline passes,
- **Then** the nurse profile moves to SUSPENDED and the nurse cannot accept any new job until the outstanding commission is paid in full; payment restores eligibility (SUSPENDED → ACTIVE path in SRS §2.3).

### AC-04: Deposit Top-Up Gate & Penalty Debt
- **Given** a nurse whose `deposit_balance` has fallen below 300,000 VND because SLA penalties were deducted (FR-PAY-03), or who carries unpaid penalty debt,
- **When** they attempt to accept a new job,
- **Then** the claim is blocked until the deposit is topped back up to 300,000 VND; unpaid penalty amounts are recorded as debt and deducted from later income per FR-PAY-03 — separately from, and never confused with, the cash-job commission flow in AC-01–AC-03.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-SETTLE-02` (SRS §10) | Cash booking settlement flow | Functional / Financial | No deposit deduction occurs; system issues a QR/payment link; on confirmed receipt of the full 15%, the booking becomes SETTLED |
| `TC-WALLET-01` (SRS §10) | Deposit wallet purpose isolation | Functional / Financial | `deposit_balance` changes only via SLA `PENALTY_DEDUCT` transactions; a settled 500,000 VND bank-transfer job credits the nurse 425,000 VND to `available_balance` |
| `TC-USHP15-01` | Commission unpaid after 24 hours | Functional | Nurse profile SUSPENDED; job claims rejected until the commission is paid |
| `TC-USHP15-02` | Deposit below 300,000 VND after a penalty | Functional / AuthZ | New job claims blocked (HTTP 403) until the deposit is topped back up |
