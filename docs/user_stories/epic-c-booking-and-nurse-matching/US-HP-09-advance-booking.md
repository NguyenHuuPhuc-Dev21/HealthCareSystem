# User Story US-HP-09: Advance Booking

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-09`
- **Story Title:** Advance Booking
- **Bounded Context:** `Booking & Matching`
- **Primary Persona:** Patient
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** Activity Flow 04 · BR-03, BR-04

---

## 💡 Real-World Context & Problem Statement

1. **Bookings outside operating hours cannot be serviced:** The hospital provides home care dispatch strictly between 17:00 and 21:30 (BR-03); offering slots outside this window promises unfulfillable care.
2. **Hidden costs cause booking friction and disputes:** Patients must clearly see the service fee and mandatory deposit amount before confirming their appointment.

---

## 📖 User Story Statement

> As a **Patient**,  
> I want to select a nursing service, date, and time slot within hospital operational hours for an advance booking, and view the total estimated cost and deposit required prior to confirmation,  
> So that I can commit to the appointment with full schedule and financial clarity.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Display Valid Operational Slots Only
- **Given** the booking schedule interface,
- **When** the patient selects a visit date,
- **Then** only open slots within the 17:00–21:30 operating window are displayed; no on-demand / instant booking option is offered during the pilot.

### AC-02: Transparent Price & Deposit Breakdown
- **Given** a selected service and slot,
- **When** the patient reaches the confirmation screen,
- **Then** the system clearly displays the hospital service fee and the 30% deposit amount (minimum 50,000 VND) required to secure the slot.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP09-01` | Query available booking slots | Functional | Only slots between 17:00–21:30 with capacity are displayed |
| `TC-USHP09-02` | Verify pricing and deposit preview | Functional | Pricing matches hospital configuration prior to order confirmation |
