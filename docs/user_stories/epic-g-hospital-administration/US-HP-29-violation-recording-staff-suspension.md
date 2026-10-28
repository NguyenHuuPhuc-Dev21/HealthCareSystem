# User Story US-HP-29: Admin Records Violations & Applies SLA Sanctions

> **Epic:** EPIC G — Administration: Disputes, Violations & Sanctions  
> **Bounded Context:** `Platform Administration`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-29`
- **Story Title:** Admin Records Violations & Applies SLA Sanctions
- **Bounded Context:** `Platform Administration`
- **Primary Persona:** Medical Admin / Operator (Admin Portal)
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** SRS §5.2 (SLA policy rows 6–8) · SRS §2.3 (nurse profile lifecycle) · FR-PAY-03 · FR-RATE-01 · FR-ADMIN-01 · SRS §5.1 (`MIN_NURSE_DEPOSIT`, `NO_SHOW_PENALTY`) · SRS §7 (`nurse_profiles.profile_status`, `wallet_transactions` `PENALTY_DEDUCT`)

---

## 💡 Real-World Context & Problem Statement

1. **Sanctions in the marketplace are codified, not discretionary:** The SLA matrix (SRS §5.2) fixes the consequence for each violation in advance — money penalties are deducted from the nurse's deposit wallet, TrustScore points are deducted by rule, and status changes (SUSPENDED / BANNED) follow automatically from defined triggers. `nurse_profiles.profile_status` is the single source of truth for whether a nurse may accept shifts.
2. **The deposit wallet exists for exactly this purpose (FR-PAY-03):** The upfront 300,000 VNĐ deposit is used **only** to deduct SLA penalties — never to collect the 15% cash-booking commission — and a nurse whose deposit falls below the threshold cannot take new shifts until they top it back up.

---

## 📖 User Story Statement

> As a **Platform Admin**,  
> I want violations recorded against a nurse's profile with the SLA sanctions applied consistently — deposit penalties, TrustScore deductions, SUSPENDED/BANNED status changes, and reactivation when the nurse remedies the cause,  
> So that discipline on the platform is predictable, auditable, and identical for every nurse.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Nurse No-Show → BANNED + 50,000 VNĐ Penalty Converted to a Customer Voucher
- **Given** a nurse who has not arrived 30 minutes after the shift start time and the urgent re-dispatch (SOS Dispatch) found no replacement (SRS §5.2 row 8),
- **When** the no-show is confirmed,
- **Then** the nurse's `profile_status` becomes `BANNED` immediately (first offence), a 50,000 VNĐ penalty (`NO_SHOW_PENALTY`) is deducted from the deposit wallet as a `PENALTY_DEDUCT` transaction (recorded as debt if the balance is insufficient), the full 50,000 VNĐ is converted into an apology voucher for the customer, and a transfer booking is refunded 100% (`REFUNDED`).

### AC-02: Nurse Late Cancellation Penalties (SRS §5.2 Rows 6–7)
- **Given** a nurse cancelling a confirmed shift more than 12 hours before its start,
- **When** the cancellation is processed,
- **Then** no money penalty applies and the TrustScore is reduced by 5 points; the booking returns to `MATCHING` for a replacement.
- **Given** a nurse cancelling 12 hours or less before the start,
- **When** the cancellation is processed,
- **Then** 20% of the shift value is deducted from the deposit wallet (`PENALTY_DEDUCT`; any shortfall is recorded as debt against the deposit balance), the TrustScore is reduced by 20 points, and the full penalty amount is added to the booking as an Urgent Bonus for the replacement nurse.

### AC-03: Automatic SUSPENDED Triggers & Reactivation
- **Given** any of the automatic triggers — TrustScore < 60, `deposit_balance` < 300,000 VNĐ after a penalty deduction, or a cash-booking commission still unpaid more than 24 hours after check-out (SRS §2.3),
- **When** the trigger condition is detected,
- **Then** `profile_status` becomes `SUSPENDED` and the nurse cannot accept new shifts; the profile returns to `ACTIVE` once the nurse tops the deposit back up to 300,000 VNĐ / pays the outstanding commission / completes retraining and is re-approved by Admin review, as applicable.

### AC-04: TrustScore Movements Follow FR-RATE-01 Exactly
- **Given** a nurse's TrustScore (default 100, range 0–100),
- **When** rating/violation events occur,
- **Then** deductions are applied by rule (−5 cancellation > 12h before start; −20 cancellation ≤ 12h; −25 for a violation upheld through a customer dispute) and recovery is applied by rule (+2 for each `SETTLED` shift rated ≥ 4 stars, capped at 100); falling below 60 triggers AC-03 suspension.

### AC-05: Admin Manual Lock/Unlock & BANNED Grounds
- **Given** the Admin user-management functions (FR-ADMIN-01),
- **When** an Admin searches and opens a nurse or customer account,
- **Then** the Admin can set the account status (`ACTIVE` / `SUSPENDED` / `BANNED`) with the action recorded; `BANNED` applies to nurse no-show, forged credentials/GPHN, or serious professional-ethics violations (SRS §2.3), and every penalty deduction and status change is traceable in `wallet_transactions` and `audit_logs`.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP29-01` | Nurse no-show with no replacement found | Functional / Compliance | Profile `BANNED`; 50,000 VNĐ `PENALTY_DEDUCT`; 50,000 VNĐ voucher issued to customer; transfer booking refunded 100% |
| `TC-USHP29-02` | Nurse cancels ≤ 12h before start | Functional / Financial | 20% of shift value deducted from deposit (debt recorded if short); TrustScore −20; penalty added to booking as Urgent Bonus |
| `TC-USHP29-03` | TrustScore falls below 60 | Functional | `profile_status` auto-set to `SUSPENDED`; shift acceptance blocked |
| `TC-USHP29-04` | Deposit below 300,000 VNĐ after penalty | Functional / Financial | Nurse blocked from new shifts until deposit topped back up to 300,000 VNĐ |
| `TC-USHP29-05` | Cash commission unpaid > 24h after check-out | Functional | Profile `SUSPENDED` until the 15% commission is paid; deposit wallet untouched by the commission |
| `TC-USHP29-06` | Admin manual status change | Functional / Compliance | Status change applied and recorded in `audit_logs` |
