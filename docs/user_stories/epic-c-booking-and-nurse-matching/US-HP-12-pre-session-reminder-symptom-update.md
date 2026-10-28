# User Story US-HP-12: Pre-Shift Reminders & Customer Condition-Note Update

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`, `Patient Profile`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-12`
- **Story Title:** Pre-Shift Reminders and Customer Updates the Condition Note Before the Shift
- **Bounded Context:** `Booking & Matching`, `Patient Profile`
- **Primary Persona:** Customer; Nurse
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-NOTIF-01 · FR-AUTH-03 (condition declaration) · FR-SHIFT-02 (on-site verification of the declaration)

---

## 💡 Real-World Context & Problem Statement

1. **Forgotten shifts hurt both sides:** A customer who forgets a booked shift wastes the nurse's travel; a nurse who forgets strands a patient. Multi-channel reminders (push, in-app, realtime) — with an SMS fallback for urgent events and for elderly nurses whose devices miss push — are the platform's defence (FR-NOTIF-01).
2. **Conditions change between booking and shift:** Fever, wound state or mobility may change after booking. Letting the customer update the condition note before the shift helps the assigned nurse prepare — while the binding verification remains the nurse's on-site check in the first 30 minutes after check-in (FR-SHIFT-02, see US-HP-07). There is no automated re-triage of updates in SRS v2.0.

---

## 📖 User Story Statement

> As a **Customer**,  
> I want to receive reminders before my booked shift and be able to update the care recipient's condition note ahead of it,  
> So that neither side forgets the appointment and the nurse arrives prepared for the recipient's current state.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Multi-Channel Pre-Shift Reminders
- **Given** a booking in CONFIRMED status approaching its start time,
- **When** the reminder schedule fires,
- **Then** the customer and the assigned nurse receive reminders via Push Notification (FCM) and the in-app Notification Center, with realtime delivery over WebSocket where available (FR-NOTIF-01).

### AC-02: SMS Fallback for Critical Events
- **Given** an urgent event (e.g. a last-minute cancellation requiring urgent re-dispatch, or an SOS alert) targeting a nurse who is offline or whose device does not acknowledge the push within 60 seconds,
- **When** the fallback triggers,
- **Then** the system sends an SMS/Zalo ZNS message to the registered phone number (FR-NOTIF-01).

### AC-03: Customer Updates the Condition Note Before the Shift
- **Given** a CONFIRMED booking before its start time,
- **When** the customer edits the care recipient's condition note (mobility, symptoms, care notes),
- **Then** the updated note is stored against the care-recipient profile/booking and is visible to the assigned nurse in the pre-shift briefing; the booking itself, its price and its CONFIRMED status are unchanged by the update.

### AC-04: Skipping the Update Never Blocks the Shift
- **Given** a customer who does not update the condition note,
- **When** the shift start time arrives,
- **Then** the shift proceeds on the original declaration; the nurse's on-site condition verification in the first 30 minutes after check-in (FR-SHIFT-02) remains the authoritative check.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-NFR-01` (SRS §10) | Urgent push not acknowledged within 60 seconds | Functional | SMS fallback message sent to the registered phone number |
| `TC-USHP12-01` | Pre-shift reminder dispatch to customer and nurse | Functional | Push + in-app reminders delivered for the CONFIRMED booking |
| `TC-USHP12-02` | Customer updates the condition note before the shift | Functional | Updated note visible to the assigned nurse; booking status and price unchanged |
| `TC-USHP12-03` | No condition update submitted | Functional | Shift proceeds normally on the original declaration |

> **Open items:** the exact reminder lead times (e.g. 24h / 2h before the shift) are [Not specified in SRS v2.0 — open item]. Whether a pre-shift condition update can itself change the booking price (e.g. newly declared heavy-patient condition) is also [Not specified in SRS v2.0 — open item]; price corrections for mis-declared conditions are currently specified only for the on-site report in FR-SHIFT-02.
