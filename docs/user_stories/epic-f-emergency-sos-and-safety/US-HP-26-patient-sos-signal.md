# User Story US-HP-26: Customer or Nurse Triggers SOS During a Shift

> **Epic:** EPIC F — Emergency SOS & Safety  
> **Bounded Context:** `Safety & SOS`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-26`
- **Story Title:** Customer or Nurse Triggers SOS During a Shift
- **Bounded Context:** `Safety & SOS`
- **Primary Persona:** Customer / Family, Nurse
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-SHIFT-05 · RISK-03 · RISK-04 · FR-NOTIF-01 · SRS §9 (FCM high priority + SMS fallback) · SRS §10 TC-SOS-01

---

## 💡 Real-World Context & Problem Statement

1. **Emergencies happen mid-shift:** A patient can suddenly become critical (stopped breathing, cyanosis, anaphylactic shock, stroke signs), and a nurse working alone in a private home can also face a personal-safety emergency. In both cases the first priority is real emergency help — not an app workflow.
2. **The app supports; it never replaces 115 (FR-SHIFT-05):** The platform's role is to open the 115 emergency dialler instantly for the person on site, and in parallel to alert the family and the platform Admin with the location and the patient's latest vital signs, logging everything. On-site first aid and the 115 call take absolute precedence over any in-app step.

---

## 📖 User Story Statement

> As a **Customer, family member, or Nurse during an in-progress shift**,  
> I want to trigger an SOS from the shift screen that immediately opens the 115 emergency dialler and simultaneously alerts my family and the platform Admin with the shift's location and latest vital signs,  
> So that real emergency services are called without delay while the platform coordinates support and keeps a complete incident log.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: One-Tap SOS Opens the 115 Dialler Immediately
- **Given** a booking in `execution_status = IN_PROGRESS`,
- **When** the customer/family or the nurse presses the SOS button on the shift screen,
- **Then** the app immediately opens the phone's 115 emergency dialler so the person on site can call emergency services and begin basic first aid within their competence (FR-SHIFT-05, step 1 — the on-site step has absolute priority).

### AC-02: Simultaneous Alert to Family & Admin With Location and Latest Vitals
- **Given** an SOS trigger,
- **When** the alert is dispatched,
- **Then** the system simultaneously sends an emergency alert (high-priority Push, with SMS fallback per FR-NOTIF-01 / SRS §9) to the patient's family contacts and to the Admin Portal, carrying the booking's GPS location and the patient's most recent vital signs from the shift log; delivery to Admin/family completes in under 2 seconds (SRS §10 TC-SOS-01).

### AC-03: Incident Logged on the Shift Record
- **Given** an SOS event during a shift,
- **When** the event is processed,
- **Then** the incident is written to the booking's `shift_logs.emergency_incident_log` with the trigger time, triggering party, and location, forming part of the booking's evidence record for any later review or dispute.

### AC-04: SOS Available to Both Parties, Only During a Shift
- **Given** the marketplace model (no hospital on-duty desk),
- **When** either the customer side or the assigned nurse opens the active shift screen,
- **Then** the SOS action is available to both parties for the duration of the in-progress shift.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP26-01` | Trigger SOS from the shift screen (SRS TC-SOS-01) | Functional / Safety | 115 dialler opens immediately; alert reaches Admin/family in < 2 seconds |
| `TC-USHP26-02` | Alert content completeness | Functional | Alert contains GPS location and the latest recorded vital signs |
| `TC-USHP26-03` | Push failure fallback for SOS | Reliability | SMS fallback sent when the push alert is not acknowledged within 60 seconds |
| `TC-USHP26-04` | SOS incident logging | Compliance | Incident written to `shift_logs.emergency_incident_log` with time, party, location |
