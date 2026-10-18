# User Story US-HP-14: 30% Deposit via Hospital Payment Gateway

> **Epic:** EPIC D — Deposit, Payment & Refund  
> **Bounded Context:** `Payment & Deposit`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-14`
- **Story Title:** 30% Deposit via Hospital Payment Gateway
- **Bounded Context:** `Payment & Deposit`
- **Primary Persona:** Patient
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC15, UC16 · BR-04 · Activity Flow 04

---

## 💡 Real-World Context & Problem Statement

1. **Cash collection creates fake bookings and high no-show rates:** Requiring an immediate upfront electronic deposit verifies patient commitment and secures the allocated nurse's shift.
2. **Standard 30% deposit with minimum floor:** The baseline enforces 30% of order value with a 50,000 VND floor (BR-04) to ensure low-value visits adequately cover basic administrative dispatch costs.

---

## 📖 User Story Statement

> As a **Patient**,  
> I want to pay a 30% deposit (minimum 50,000 VND) via the hospital payment gateway to lock in my booking,  
> So that my appointment is securely confirmed without physical cash transactions.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Deposit Computation Rules
- **Given** an advance home-care booking order,
- **When** the system calculates the required deposit,
- **Then** the amount equals `max(30% of total estimate, 50,000 VND)`.

### AC-02: Payment Gateway Callback Verification & State Transition
- **Given** a patient redirected to the hospital payment gateway,
- **When** payment succeeds and the gateway webhook/callback signature is verified,
- **Then** the order transitions to "Deposit Paid" (`DA_DAT_COC`), the matched nurse shift is locked, and confirmation notifications are dispatched.

### AC-03: Expiration of Unpaid Deposit Orders
- **Given** a booking awaiting deposit payment,
- **When** the payment countdown timer expires without verified payment,
- **Then** the system cancels the pending order and releases the candidate nurse back to the available pool.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP14-01` | Validate deposit formula | Functional | Computed deposit strictly equals 30% with 50,000 VND floor |
| `TC-USHP14-02` | Process valid gateway callback | Functional | Order moves to `DA_DAT_COC`; nurse calendar locked |
| `TC-USHP14-03` | Deposit payment timeout | Functional | Pending order cancelled and nurse released |
