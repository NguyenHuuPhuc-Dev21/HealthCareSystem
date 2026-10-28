# User Story US-HP-23: Shift Extension — Request, Repricing, Customer Approval & Payment

> **Epic:** EPIC E — Shift Execution  
> **Bounded Context:** `Shift Execution`, `Payment`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-23`
- **Story Title:** Shift Extension — Request, Repricing, Customer Approval & Payment
- **Bounded Context:** `Shift Execution`, `Payment`
- **Primary Persona:** Customer, Nurse
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-SHIFT-03 · FR-BOOK-01 · FR-PAY-01 · FR-PAY-02 · SRS §8 `POST /api/v1/bookings/:id/extend` · SRS §5.1 (`SURCHARGE_NIGHT_SHIFT`)

---

## 💡 Real-World Context & Problem Statement

1. **Care needs regularly overrun the booked slot:** A procedure takes longer than expected, or the family needs the nurse to stay until a relative arrives. The shift must be extendable without ending the booking and re-matching from scratch.
2. **Extra time must never be worked unpaid or billed unilaterally:** The extension is repriced by the system from the same configured rates as the original booking, the nurse must be free (no clash with their next shift), and the customer must approve and pay the additional amount before the extra time is worked (FR-SHIFT-03).

---

## 📖 User Story Statement

> As a **Customer (with the Nurse's agreement)**,  
> I want to extend an in-progress shift in 1-hour blocks, with the system repricing the extra time and collecting the additional payment before the shift continues,  
> So that care continues seamlessly and the extra work is transparently priced and paid.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Extension Requested Before the Shift Ends, in 1-Hour Blocks
- **Given** a booking in `execution_status = IN_PROGRESS`,
- **When** the customer requests an extension 30 minutes before the scheduled end time via `POST /api/v1/bookings/:id/extend`,
- **Then** the extension is offered in multiples of 1 hour (FR-SHIFT-03).

### AC-02: Nurse Availability Check & Agreement
- **Given** an extension request,
- **When** the system checks the nurse's schedule,
- **Then** the extension proceeds only if the nurse has no conflicting next shift and confirms agreement in the Nurse app; otherwise the extension is declined and the shift ends as originally booked.

### AC-03: System Repricing from Configured Rates
- **Given** an agreed extension,
- **When** the system reprices,
- **Then** the additional amount is calculated from `system_configs` on the same basis as FR-BOOK-01 (base hourly price, with the +20% night surcharge applied to extension hours falling inside 22:00–06:00), and the itemised extra amount is shown to the customer before payment.

### AC-04: Payment of the Extra Amount Before Continuing
- **Given** a repriced extension on a `BANK_TRANSFER` booking,
- **When** the customer approves,
- **Then** the additional amount is paid through the payment gateway into the booking's held (escrow) balance, and only then is the booking's `end_time` extended and the shift continues.
- **Given** a repriced extension on a `CASH` booking,
- **When** the customer approves and confirms in the app,
- **Then** the booking's `end_time` and in-app total are extended, the extra is paid to the nurse in cash at the site, and the 15% commission on the extended in-app price is settled under the cash-commission flow at check-out (FR-PAY-02). *[The detailed cash-path wording for extensions is only summarised in SRS v2.0 FR-SHIFT-03, which names the escrow top-up — open item.]*

### AC-05: Unpaid or Declined Extension Leaves the Booking Unchanged
- **Given** an extension that the customer does not pay for, or that the nurse declines,
- **When** the original end time is reached,
- **Then** the shift ends as originally booked and the nurse checks out normally (US-HP-22); no extra amount is charged.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP23-01` | Customer requests a 1-hour extension 30 min before end | Functional | Extension offer created in 1-hour multiples |
| `TC-USHP23-02` | Nurse has a conflicting next shift | Functional | Extension declined; original end time unchanged |
| `TC-USHP23-03` | Repricing of night-time extension hours | Functional | Hours inside 22:00–06:00 carry the +20% night surcharge from `system_configs` |
| `TC-USHP23-04` | Transfer booking: extension paid via gateway | Functional | Extra amount held with the booking; `end_time` extended only after payment succeeds |
| `TC-USHP23-05` | Extension not paid | Functional | Shift ends at the original end time; no extra charge |
