# User Story US-HP-11: Re-Matching / Refund When the Nurse Cancels

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-11`
- **Story Title:** System Re-Matches / Refunds per SLA When the Nurse Cancels
- **Bounded Context:** `Booking & Matching`
- **Primary Persona:** Customer; Nurse (cancelling); System (re-matching)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** SRS §5.2 SLA Matrix rows 6–8 · FR-BOOK-03 · FR-RATE-01 (TrustScore) · FR-PAY-03 (deposit penalties)

---

## 💡 Real-World Context & Problem Statement

1. **A nurse cancellation must not kill the customer's booking:** The customer has already paid (bank transfer) or planned care around the shift. The booking must fall back to MATCHING and find a replacement automatically, with the customer's money staying safely in escrow the whole time.
2. **Late cancellations and no-shows carry real consequences:** A nurse who cancels at short notice strands a patient. The SLA matrix answers with a graduated response — TrustScore deductions for early cancellation, a deposit-funded penalty that becomes an Urgent Bonus to attract a replacement for late cancellation, and a permanent ban plus a customer voucher for a no-show with no replacement found.

---

## 📖 User Story Statement

> As a **Customer**,  
> If my assigned nurse cancels or fails to show up, I want the system to automatically re-match a replacement — or refund me in full with a voucher when no replacement exists,  
> So that a nurse-side failure never leaves me without care or out of pocket.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Early Nurse Cancellation (> 12 Hours Before Start) — Automatic Re-Match
- **Given** a CONFIRMED booking whose nurse cancels more than 12 hours before the shift start,
- **When** the cancellation is recorded,
- **Then** the nurse pays no money penalty and loses 5 TrustScore points; the booking returns to MATCHING automatically and re-dispatches to other eligible nurses (§5.2 row 6).

### AC-02: Late Nurse Cancellation (≤ 12 Hours Before Start) — Penalty Funds the Replacement
- **Given** a CONFIRMED booking whose nurse cancels within 12 hours of the shift start,
- **When** the cancellation is recorded,
- **Then** 20% of the booking value is deducted from the nurse's deposit wallet (recorded as debt if the balance is insufficient), the nurse loses 20 TrustScore points, and the full penalty is added to the booking as an Urgent Bonus while SOS Dispatch pushes the job to find a replacement (§5.2 row 7).

### AC-03: No-Show With No Replacement — Ban, Full Refund, Voucher
- **Given** a nurse who has not arrived 30 minutes after the shift start and SOS Dispatch cannot find a replacement,
- **When** the no-show is confirmed,
- **Then** the nurse's account is BANNED immediately (first offence) and fined 50,000 VND (NO_SHOW_PENALTY) from the deposit wallet (debt if insufficient); the customer receives a 100% refund for bank-transfer bookings (`payment_status = REFUNDED`) plus a 50,000 VND apology voucher funded by that fine (§5.2 row 8).

### AC-04: Customer Continuity Throughout Re-Matching
- **Given** any nurse-side cancellation covered by AC-01–AC-03,
- **When** re-matching runs,
- **Then** the customer is notified of the change, keeps the same booking and price, and any escrowed prepayment remains held (ESCROW_HELD) — the customer never has to pay again or rebook.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-CANCEL-01` (SRS §10) | Nurse no-show with no replacement available | Functional / Financial | Customer refunded 100% + 50,000 VND voucher; nurse account BANNED and fined 50,000 VND |
| `TC-USHP11-01` | Nurse cancels > 12h before start | Functional | No deposit deduction; −5 TrustScore; booking returns to MATCHING and a replacement is dispatched |
| `TC-USHP11-02` | Nurse cancels ≤ 12h before start with insufficient deposit balance | Functional / Financial | 20% of booking value recorded: available part deducted from `deposit_balance`, remainder booked as debt; full penalty becomes the booking's Urgent Bonus; −20 TrustScore |
| `TC-USHP11-03` | Escrow state during re-matching | Functional / Financial | Prepaid funds remain ESCROW_HELD; no second charge to the customer |
