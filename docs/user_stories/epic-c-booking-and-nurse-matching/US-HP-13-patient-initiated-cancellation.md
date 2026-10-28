# User Story US-HP-13: Customer Cancels Under the §5.2 Refund Matrix

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`, `Payment`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-13`
- **Story Title:** Customer Cancels Under the §5.2 Refund Matrix
- **Bounded Context:** `Booking & Matching`, `Payment`
- **Primary Persona:** Customer
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** SRS §5.2 SLA Matrix rows 1–5 · SRS §2.2 (3-axis booking states)

---

## 💡 Real-World Context & Problem Statement

1. **Cancellations have a price curve, and it must be shown before confirming:** A nurse who reserves a shift turns away other work. The §5.2 matrix prices that loss by how close to the shift the customer cancels — free far ahead, increasingly shared as the start approaches — and the customer must see the exact refund/penalty split before they confirm the cancellation.
2. **The two payment methods behave differently:** Refund percentages apply to bank-transfer bookings, where the platform holds the money. For cash bookings the customer has prepaid nothing, so there is nothing to refund: the booking simply releases the nurse's schedule and the cancellation is recorded in the customer's cancellation history; the customer's cancellation fee is not collected through the system (§5.2 applicability note).

---

## 📖 User Story Statement

> As a **Customer**,  
> I want to cancel my booking in the app and see the exact refund or penalty that applies under the §5.2 matrix before I confirm,  
> So that I can cancel when I must, with complete financial transparency.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Early Cancellation (Δt > 12 Hours) — Full Refund
- **Given** a booking cancelled more than 12 hours before its start,
- **When** the cancellation is confirmed,
- **Then** the penalty is 0% and 100% of the prepaid amount is refunded (`payment_status = REFUNDED`); the nurse's schedule is released (§5.2 row 1).

### AC-02: Near Cancellation (2h ≤ Δt ≤ 12h) — 20% Penalty
- **Given** a booking cancelled between 2 and 12 hours before its start,
- **When** the cancellation is confirmed,
- **Then** 80% is refunded to the customer, 15% of the booking value is credited to the nurse's income wallet as schedule-holding compensation, and the platform retains 5% (§5.2 row 2).

### AC-03: Last-Minute Cancellation (Δt < 2 Hours, Before Check-In) — 50% Penalty
- **Given** a booking cancelled less than 2 hours before its start and the nurse has not checked in,
- **When** the cancellation is confirmed,
- **Then** 50% is refunded to the customer, 40% of the booking value is credited to the nurse's wallet as travel/opportunity compensation, and the platform retains 10% (§5.2 row 3).

### AC-04: Stop After Check-In — Pay for Work Actually Done, No Penalty
- **Given** a booking in IN_PROGRESS that the customer asks to end early (not due to nurse fault),
- **When** the shift is closed,
- **Then** the nurse is paid 100% for the hours actually worked (minimum 1 hour); for task-based services, completing all tasks earns the full service price even if finished early; 100% of the unused time value is refunded to the customer (bank-transfer bookings); the early end is not treated as a cancellation and produces no PARTIALLY_SETTLED state (§5.2 row 4).

### AC-05: Medical Force Majeure — Full Refund + Travel Support
- **Given** a cancellation because the patient is transferred to emergency/ICU care or has died, with supporting documents,
- **When** the cancellation is confirmed,
- **Then** 100% of the unused amount is refunded with no penalty, and if the nurse had already travelled, the platform pays the nurse the fixed 50,000 VND travel support (ICU_TRAVEL_SUPPORT) from the operations fund (§5.2 row 5).

### AC-06: Cash Bookings — No Refund, Schedule Released
- **Given** a booking with `payment_method = CASH`,
- **When** the customer cancels at any point,
- **Then** no refund or fee collection occurs through the system (nothing was prepaid); the booking is closed, the nurse's schedule is released, and the cancellation is recorded in the customer's cancellation history (§5.2 applicability note). Nurse-side SLA penalties, where applicable, are still deducted from the nurse's deposit wallet as specified.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-CANCEL-01` (SRS §10) | Cancellation outcomes across the matrix | Functional / Financial | Refund/penalty splits match §5.2 rows 1–3 exactly for the applicable Δt band |
| `TC-USHP13-01` | Cancel an IN_PROGRESS shift early | Functional / Financial | Nurse paid for actual hours (min 1h); 100% of unused time refunded; no penalty and no PARTIALLY_SETTLED state created |
| `TC-USHP13-02` | Cancel with ICU/death documentation | Functional / Financial | 100% refund of unused amount; 50,000 VND ICU_TRAVEL_SUPPORT paid to the nurse if already travelled |
| `TC-USHP13-03` | Cancel a CASH booking | Functional | No money movement; schedule released; cancellation recorded in customer history |
| `TC-USHP13-04` | Nurse schedule release on confirmed cancellation | Functional | Nurse's slot immediately freed for new matching |

> **Flagged inconsistency in the baseline:** SRS §10 RTM row CT-08/CT-18 (TC-CANCEL-01) describes an in-progress customer cancellation as "actual hours + a 30% penalty on the remaining hours", which conflicts with §5.2 row 4 ("pay for actual work, no penalty, refund 100% of unused time") and with the v2.0 revision decision recorded in SRS §0.2. This story follows §5.2 row 4; the RTM wording should be corrected in the SRS.
