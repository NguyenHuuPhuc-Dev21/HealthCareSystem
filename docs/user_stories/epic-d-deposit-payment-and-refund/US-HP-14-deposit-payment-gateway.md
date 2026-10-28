# User Story US-HP-14: Customer Pays 100% in Advance by Bank Transfer (Escrow) or Chooses Cash

> **Epic:** EPIC D — Payment & Settlement  
> **Bounded Context:** `Payment`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-14`
- **Story Title:** Customer Pays 100% in Advance by Bank Transfer (Escrow) or Chooses Cash at Booking
- **Bounded Context:** `Payment`
- **Primary Persona:** Customer
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-PAY-01 · FR-BOOK-01 (payment hold) · SRS §9 (gateway integration) · SRS §7 `bookings.payment_method` (`BANK_TRANSFER` | `CASH`)

---

## 💡 Real-World Context & Problem Statement

1. **There is no deposit in this model:** The superseded baseline collected a 30% deposit through a hospital gateway. SRS v2.0 replaces it with a per-booking choice of payment method, recorded on the booking at creation: bank transfer prepaid in full, or cash paid to the nurse at the end of the shift.
2. **Prepayment must be tamper-proof:** For bank-transfer bookings the customer's full payment is held in the platform's simulated escrow ledger until settlement. Webhook forgery or duplicate gateway callbacks must never create or double money — signature verification and idempotency are acceptance-level requirements, not implementation details.

---

## 📖 User Story Statement

> As a **Customer**,  
> I want to choose at booking time between paying 100% in advance by bank transfer (held in escrow) and paying cash to the nurse at the end of the shift,  
> So that I can pay the way that suits me while the platform guarantees the money flow for both sides.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Payment Method Recorded at Booking Creation
- **Given** a customer creating a booking,
- **When** they reach the payment step,
- **Then** they explicitly select `payment_method = BANK_TRANSFER` or `CASH`, and the choice is stored on the booking before matching proceeds (FR-PAY-01).

### AC-02: Bank Transfer — 100% Prepaid into Escrow
- **Given** a booking with `payment_method = BANK_TRANSFER` in DRAFT,
- **When** the customer pays 100% of the booking total through the sandbox gateway (PayOS / VNPay / VietQR) and the webhook verifies the HMAC-SHA256 signature,
- **Then** the amount is locked into the escrow ledger for that booking (`payment_status = ESCROW_HELD`, `ESCROW_LOCKED` transaction recorded) and matching is activated.

### AC-03: Webhook Idempotency
- **Given** a gateway that retries its payment webhook,
- **When** the same webhook (same `idempotency_key`) is delivered multiple times,
- **Then** exactly one ESCROW_HOLD transaction is recorded; repeat deliveries return HTTP 200 without changing any balance, and a webhook with an invalid signature is rejected with HTTP 401 (SRS §9).

### AC-04: Payment Timeout
- **Given** a bank-transfer booking awaiting payment,
- **When** 15 minutes pass without a verified payment (PAYMENT_TIMEOUT_MINUTES = 15),
- **Then** the booking moves to `execution_status = EXPIRED` and no matching or schedule lock persists.

### AC-05: Cash — Pay the Nurse at Shift End
- **Given** a booking with `payment_method = CASH`,
- **When** the booking is created and later completes,
- **Then** no prepayment is collected and no escrow is held; the customer pays 100% of the in-app booking price in cash directly to the nurse at the end of the shift, and any extra amount the customer gives beyond the in-app price is a tip for the nurse, excluded from commission calculation (FR-PAY-01).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-PAY-01` (SRS §10) | Forged webhook with an invalid HMAC-SHA256 signature | Security | HTTP 401; wallet balances unchanged |
| `TC-PAY-02` (SRS §10) | Same webhook delivered 5 times with one `idempotency_key` | Functional / Financial | Exactly one ESCROW_HOLD transaction recorded |
| `TC-SETTLE-01` (SRS §10) | Bank-transfer booking settled after the 24h window | Functional / Financial | Nurse receives 85% to `available_balance`; platform retains the 15% commission |
| `TC-USHP14-01` | Cash booking lifecycle money flow | Functional | No escrow hold at any point; booking completes with `payment_status = UNPAID` pending nurse commission payment (see US-HP-15) |
| `TC-USHP14-02` | Unpaid bank-transfer booking timeout | Functional | Booking EXPIRED after 15 minutes; no funds held |
