# User Story US-HP-22: Nurse Checks Out & Submits the Mandatory Care Report

> **Epic:** EPIC E — Shift Execution  
> **Bounded Context:** `Shift Execution`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-22`
- **Story Title:** Nurse Checks Out & Submits the Mandatory Care Report
- **Bounded Context:** `Shift Execution`
- **Primary Persona:** Nurse
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-SHIFT-04 · FR-PAY-02 · FR-PRIV-01 · FR-RATE-01 · SRS §8 `POST /api/v1/bookings/:id/check-out` · SRS §7 (`shift_logs`)

---

## 💡 Real-World Context & Problem Statement

1. **A shift without a closing record cannot be settled or defended:** The care report (final vital signs, tasks performed, handover notes) is the clinical record of the shift, the customer's acceptance basis, and core evidence if a dispute is opened within 24 hours (FR-DISP-01).
2. **Check-out is the trigger for everything downstream (FR-SHIFT-04):** Recording `checkout_time` closes the shift, starts the 24-hour dispute/settlement window, starts the 12-hour countdown after which the nurse's medical-record access closes, and opens two-sided ratings. None of this can happen reliably if check-out is optional or the report can be skipped.

---

## 📖 User Story Statement

> As a **Nurse finishing a shift**,  
> I want to check out by confirming the actual end time and submitting the mandatory care report (final vital signs, tasks performed, handover notes),  
> So that the shift is formally completed, settlement and ratings can proceed, and the care provided is documented.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Care Report Is Mandatory — Check-Out Is Blocked Without It
- **Given** a booking in `execution_status = IN_PROGRESS`,
- **When** the nurse attempts to check out via `POST /api/v1/bookings/:id/check-out` without completing the minimum care report (final vital signs, list of tasks performed, handover notes),
- **Then** the check-out is rejected until the report is completed and stored in `shift_logs` (`vital_signs_log`, `care_activities_log`).

### AC-02: Successful Check-Out Completes the Booking and Starts the Timers
- **Given** a complete care report and the nurse confirming the actual end time,
- **When** the check-out is submitted,
- **Then** the system records `checkout_time`, transitions the booking to `execution_status = COMPLETED`, starts the 24-hour dispute window (FR-DISP-01) and settlement cooling period (`SETTLEMENT_COOLING_HOURS = 24`, FR-PAY-02), starts the 12-hour medical-access closure countdown (FR-PRIV-01), and opens two-sided ratings (FR-RATE-01).

### AC-03: Early Finish of a Task-Based Service Is Paid in Full
- **Given** a task-based service (per-procedure booking) whose tasks are all completed before the scheduled end time,
- **When** the nurse checks out early with the completed care report,
- **Then** the service is charged at its full price despite the early finish (FR-SHIFT-04); for shift-based bookings ended early, settlement follows the actual-work rule of SRS §5.2 row 4 (see US-HP-24).

### AC-04: Cash Bookings Generate the Commission Payment Link at Check-Out
- **Given** a completed booking with `payment_method = CASH`,
- **When** check-out succeeds,
- **Then** the system calculates the 15% platform commission on the in-app booking price and issues a VietQR / payment link (`POST /api/v1/bookings/:id/commission-payment-link`) for the nurse to self-pay within 24 hours (FR-PAY-02); the commission is never deducted from the nurse's deposit wallet.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP22-01` | Check out with a complete care report | Functional | `checkout_time` recorded; booking `COMPLETED`; 24h dispute window and 12h access-closure countdown started |
| `TC-USHP22-02` | Attempt check-out without the care report | Compliance | Check-out blocked with validation error; booking remains `IN_PROGRESS` |
| `TC-USHP22-03` | Early check-out on a fully completed task-based service | Functional | Full service price charged; no early-finish penalty |
| `TC-USHP22-04` | Cash booking check-out issues commission link | Functional | VietQR/payment link for 15% of the in-app price generated for the nurse |
| `TC-USHP22-05` | Ratings open at completion | Functional | Both parties can submit ratings once the booking is `COMPLETED` |
