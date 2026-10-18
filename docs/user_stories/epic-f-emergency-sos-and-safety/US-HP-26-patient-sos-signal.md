# User Story US-HP-26: Patient/Relative SOS Signal

> **Epic:** EPIC F — Emergency SOS & Safety  
> **Bounded Context:** `Safety & SOS`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-26`
- **Story Title:** Patient/Relative SOS Signal
- **Bounded Context:** `Safety & SOS`
- **Primary Persona:** Patient, Family Member Present during Care Session
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC140 · BR-23 · Q-48 · Activity Flow 17

---

## 💡 Real-World Context & Problem Statement

1. **Life-threatening emergencies during home nursing:** Sudden cardiac arrest, respiratory failure, anaphylactic shock, or domestic violence incidents require immediate emergency mobilization.
2. **5-minute SLA escalation policy (Q-48):** The platform does not make automated phone calls to 115 (the national emergency service) during the MVP pilot (Q-48). However, it must immediately alert on-duty hospital medical personnel and auto-escalate if unacknowledged within 5 minutes.

---

## 📖 User Story Statement

> As a **Patient or Family Member present during a home visit**,  
> I want to trigger an emergency SOS alert directly from the active session screen,  
> So that the hospital on-duty clinical response team is alerted immediately with my real-time visit context.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: SOS Incident Generation with Immutable Timestamp
- **Given** an ongoing home care visit,
- **When** the patient or family member presses the SOS button,
- **Then** the system creates an SOS incident record stamping `triggered_at`, captures GPS coordinates, and dispatches urgent alerts to configured hospital on-duty responders.

### AC-02: Automated 5-Minute Escalation if Unacknowledged
- **Given** an active SOS incident that has not been acknowledged,
- **When** 5 minutes elapse from `triggered_at`,
- **Then** the system automatically escalates the incident to the secondary hospital emergency focal point and logs the escalation event.

### AC-03: No Automated 115 Phone Calls in MVP (Q-48)
- **Given** any triggered SOS incident,
- **When** the event is processed,
- **Then** the platform does not execute automated telephonic calls to 115; the user interface explicitly presents prominent instructions to dial 115 directly for immediate national dispatch.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP26-01` | Trigger SOS emergency button | Functional / Safety | Incident created with `triggered_at`; immediate alert delivered |
| `TC-USHP26-02` | Unacknowledged 5-minute escalation timer | Functional / Reliability | Incident auto-escalates to backup focal point at 5:00 mark |
| `TC-USHP26-03` | Emergency 115 guidance display | UI / Safety | Explicit 115 emergency dialing banner displayed to user |
