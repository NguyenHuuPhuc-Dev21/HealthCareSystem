# User Story US-HP-27: Admin Receives the SOS Alert With Live Location, Responds & Closes It

> **Epic:** EPIC F — Emergency SOS & Safety  
> **Bounded Context:** `Safety & SOS`, `Platform Administration`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-27`
- **Story Title:** Admin Receives the SOS Alert With Live Location, Responds & Closes It
- **Bounded Context:** `Safety & SOS`, `Platform Administration`
- **Primary Persona:** Medical Admin / Operator (Admin Portal)
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-SHIFT-05 · RISK-03 · FR-NOTIF-01 · SRS §2.1 (Admin actor) · SRS §7 (`shift_logs.emergency_incident_log`, `audit_logs`)

---

## 💡 Real-World Context & Problem Statement

1. **There is no hospital switchboard in the marketplace model:** When an SOS fires during a shift, the platform's own Admin/Operator team on the Admin Portal is the receiving point. They must see the alert instantly, with enough context — where the shift is, who is involved, and the patient's latest vital signs — to coordinate support (FR-SHIFT-05, step 2).
2. **An alert without an owned outcome is a liability gap:** Every SOS must end with a recorded outcome, so the platform can prove what happened, what it did, and when — for the family's sake and for any later dispute or legal review.

---

## 📖 User Story Statement

> As a **Platform Admin / Operator**,  
> I want to receive SOS alerts in real time on the Admin Portal with the shift's live location and clinical context, coordinate the response, and close the alert with a recorded outcome,  
> So that every emergency during a shift is actively handled and fully accountable.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Real-Time Alert Reception With Full Context
- **Given** an SOS triggered during an in-progress shift (US-HP-26),
- **When** the alert reaches the Admin Portal,
- **Then** it is presented as a high-priority alert (high-priority Push + SMS fallback per FR-NOTIF-01) showing the booking, the care address and GPS location, the customer and nurse involved, the trigger time and triggering party, and the patient's latest vital signs from the shift log.

### AC-02: Admin Coordinates Support
- **Given** a received SOS alert,
- **When** the Admin responds,
- **Then** the Admin can contact the family and the nurse through the platform's channels and coordinate external support (e.g. confirming that 115 has been called, notifying authorities where the situation requires it), while the incident timeline is recorded on the booking's `emergency_incident_log`. The platform supports and logs the response; it does not replace the 115 emergency service (FR-SHIFT-05).

### AC-03: Closure Requires a Recorded Outcome
- **Given** an SOS alert whose situation has been resolved,
- **When** the Admin closes the alert,
- **Then** the closure records the handling Admin, the closing time, and the outcome/resolution note; an alert cannot be closed without an outcome note.

### Open Items
- SRS v2.0 (FR-SHIFT-05) specifies the alert's content, channels, and the < 2-second delivery target, but does **not** specify an Admin acknowledgement SLA, an escalation chain if an alert is unacknowledged, or a fixed taxonomy of closure outcomes — these are **[Not specified in SRS v2.0 — open item]** and must not be assumed from the superseded hospital-baseline version.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP27-01` | SOS alert received on Admin Portal | Functional / Safety | Alert displayed with location, parties, trigger time, latest vitals |
| `TC-USHP27-02` | Response actions recorded | Functional | Admin contacts/coordination steps appended to `emergency_incident_log` |
| `TC-USHP27-03` | Attempt closing SOS without an outcome note | Compliance | Closure blocked; outcome note required |
| `TC-USHP27-04` | Closed SOS retained as booking evidence | Compliance | Full incident (trigger → response → outcome) retrievable from the booking record |
