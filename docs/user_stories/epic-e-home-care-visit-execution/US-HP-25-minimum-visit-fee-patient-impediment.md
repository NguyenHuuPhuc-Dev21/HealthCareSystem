# User Story US-HP-25: Customer No-Show / On-Site Impediment — Nurse Waits, Reports & Leaves

> **Epic:** EPIC E — Shift Execution  
> **Bounded Context:** `Shift Execution`, `Payment`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-25`
- **Story Title:** Customer No-Show / On-Site Impediment — Nurse Waits, Reports & Leaves
- **Bounded Context:** `Shift Execution`, `Payment`
- **Primary Persona:** Nurse, Customer
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-SHIFT-01 · FR-CHAT-01 · SRS §5.2 (cancellation & compensation policy) · SRS §7 (`shift_logs`)

---

## 💡 Real-World Context & Problem Statement

1. **The nurse travelled; nobody is there:** A nurse can arrive at the care address at the booked time and find the customer/patient absent, unreachable, or refusing entry — the mirror image of a nurse no-show. The nurse's travel and reserved time must not be silently lost, and the platform needs on-site evidence of what happened.
2. **Evidence first, money second:** The nurse's presence at the address is provable through the same GPS tooling as check-in (FR-SHIFT-01), and contact attempts run through the in-app chat/call channel whose logs are kept as evidence (FR-CHAT-01).

---

## 📖 User Story Statement

> As a **Nurse**,  
> I want, when I arrive at the care address and the customer/patient is absent or will not admit me, to log my on-site presence, attempt contact through the app, wait for the customer, and then report the impediment and leave,  
> So that the wasted trip is documented with evidence and compensated under the platform's policy instead of being treated as my failure to attend.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: On-Site Presence Logged at the Care Address
- **Given** a booking in `execution_status = CONFIRMED` at its scheduled start time,
- **When** the nurse arrives and finds nobody available to receive care,
- **Then** the nurse records their presence at the booking coordinates through the app (GPS evidence handled with the same anti-fraud controls as check-in, FR-SHIFT-01), so the case can never be recorded as a nurse no-show.

### AC-02: Contact Attempts Through the In-App Channel
- **Given** a logged on-site presence with the customer absent/unreachable,
- **When** the nurse attempts to reach the customer,
- **Then** contact is attempted via in-app chat/call (FR-CHAT-01, phone numbers masked), and every attempt is timestamped in the booking's conversation log as evidence.

### AC-03: Wait, Then Report the Impediment & Leave
- **Given** the customer still has not appeared or admitted the nurse after the waiting period,
- **When** the nurse submits the customer no-show / impediment report with the on-site evidence,
- **Then** the booking is closed under the customer-impediment scenario, the nurse is free to leave and to accept other work, and the record (arrival evidence, contact log, timestamps) is stored for Admin review and any later dispute (FR-DISP-01).
- **Note:** The length of the waiting period and the exact pay/compensation amount for a customer no-show are **[Not specified in SRS v2.0 — open item]**. SRS §5.2 defines compensation for the adjacent cases — late customer cancellation before check-in (row 3: nurse compensated 40% of the booking value) and early stop after check-in (row 4: 100% of actual hours worked, minimum 1 hour) — but contains no dedicated customer no-show row; the figure must be fixed in `system_configs` before this scenario can be implemented as specified.

### AC-04: No Penalty to the Nurse
- **Given** a booking closed as customer no-show / impediment with valid on-site evidence,
- **When** sanctions are evaluated,
- **Then** no no-show sanction, deposit penalty, or TrustScore deduction is applied to the nurse; the nurse no-show rule of SRS §5.2 row 8 applies only where the nurse failed to attend.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP25-01` | Log on-site presence when customer is absent | Functional | GPS presence evidence stored; case not recordable as nurse no-show |
| `TC-USHP25-02` | Contact attempts via in-app chat/call | Functional | Timestamped attempts present in the booking conversation log |
| `TC-USHP25-03` | Submit impediment report and leave | Functional | Booking closed under customer-impediment scenario; nurse released for other work |
| `TC-USHP25-04` | Sanction evaluation after customer no-show | Compliance | No deposit penalty, no TrustScore deduction, no BANNED action against the nurse |
