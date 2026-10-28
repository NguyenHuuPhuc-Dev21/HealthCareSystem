# User Story US-HP-09: Customer Books a Shift or Task in Advance

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-09`
- **Story Title:** Customer Books a Shift/Task in Advance (incl. Doctor's-Order Upload + Admin Review for Invasive Services)
- **Bounded Context:** `Booking & Matching`
- **Primary Persona:** Customer (Patient / Family Member)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-BOOK-01 · FR-BOOK-02 · FR-AUTH-03 · FR-PRIV-01 · SRS §8 API `POST /api/v1/bookings`

---

## 💡 Real-World Context & Problem Statement

1. **Two booking shapes, one engine:** The marketplace sells single procedures (task-based, priced per time) and staffed shifts (shift-based 4h / 8h / 12h / 24h, including night shifts such as 20:00–06:00). Both are booked in advance through the same flow; long-term weekly/monthly contracts are Phase 2 and out of this story's scope.
2. **Invasive services need a paper trail before anyone travels:** An injection or infusion at home is lawful only against a doctor's order (y lệnh). The booking must therefore capture the order image and its issue date up front, hold the booking for Admin review, and let the assigned Tier 2 nurse re-check the order before accepting and again on site.
3. **Prices must be fully explainable before payment:** Night hours, holidays and heavy-patient care change the price by fixed parameters from `system_configs`. The customer sees the complete breakdown before confirming — no hospital fee schedule and no deposit percentage exists in this model; bank-transfer bookings are prepaid 100% (US-HP-14).

---

## 📖 User Story Statement

> As a **Customer**,  
> I want to book a task or shift in advance for my care recipient — uploading the doctor's order when the service is invasive — and see the full price breakdown before confirming,  
> So that the booking is lawful, correctly priced and ready for matching.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Booking Creation with Pre-Checks
- **Given** a signed-in customer with a care-recipient profile,
- **When** they create a booking (service, start/end time, care location, payment method),
- **Then** the system verifies the Nghị định 13/2023 consent for the profile and — for private-home care — the customer account's completed eKYC, then creates the booking in `execution_status = DRAFT`, `payment_status = UNPAID`, held for 15 minutes pending payment (PAYMENT_TIMEOUT_MINUTES = 15).

### AC-02: Parameterised Price Calculation & Breakdown
- **Given** a booking being priced,
- **When** the system calculates the total from `system_configs`,
- **Then** Total = Base price + night surcharge (+20% for the hours falling in 22:00–06:00) + holiday surcharge (Tết Nguyên đán +300% of base; other public holidays +200% of base) + heavy-patient surcharge (+15% if weight ≥ 80 kg or BEDRIDDEN), with all surcharges added on the base price, never compounded. Worked example from FR-BOOK-01: a 20:00–06:00 shift at 50,000 VND/hour on a normal day → base 500,000 VND; the 8 night hours (22:00–06:00) add 80,000 VND; total 580,000 VND.

### AC-03: Invasive Services Require a Doctor's Order + Admin Review
- **Given** a selected service with `is_invasive = true`,
- **When** the customer creates the booking,
- **Then** uploading the doctor's-order/prescription image (showing patient name, medication/dosage, doctor's signature/stamp, issue date ≤ 7 days old) and entering the issue date are mandatory — without the image the booking is rejected (HTTP 400) — and the booking is held in PENDING_ADMIN_REVIEW until Admin approval; afterwards the assigned TIER_2_SPECIALIST nurse reviews the order image before accepting the job (FR-BOOK-02).

### AC-04: Prohibited Services Cannot Be Booked
- **Given** a service flagged `is_prohibited = true` (e.g. blood transfusion, high-risk IV antibiotics, anaesthesia/minor surgery at home),
- **When** a customer attempts to create a booking for it,
- **Then** booking creation is blocked outright (SRS §4.2 service catalogue, Group 3).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-PRICE-01` (SRS §10) | Night-shift price calculation | Functional | 20:00–06:00 shift at 50,000 VND/h totals 580,000 VND (base 500,000 + 80,000 night surcharge); changing surcharge values in `system_configs` changes new bookings without redeployment |
| `TC-BOOK-01` (SRS §10) | Invasive booking without a doctor's-order image | Functional / Compliance | HTTP 400 Bad Request; no booking created |
| `TC-AUTH-03` (SRS §10) | Prohibited service booking attempt | Functional / Compliance | Booking creation blocked for `is_prohibited = true` services |
| `TC-STATE-01` (SRS §10) | Booking left unpaid past the hold window | Functional | After 15 minutes the booking moves to `execution_status = EXPIRED` |
| `TC-USHP09-01` | Advance booking with Tết holiday surcharge | Functional | Holiday surcharge computed as +300% of base price and shown as a separate breakdown line |
