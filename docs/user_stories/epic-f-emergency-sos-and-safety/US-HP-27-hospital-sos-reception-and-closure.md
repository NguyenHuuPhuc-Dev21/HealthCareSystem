# User Story US-HP-27: On-Duty Hospital Contact Acknowledges & Closes SOS Incident

> **Epic:** EPIC F — Emergency SOS & Safety  
> **Bounded Context:** `Safety & SOS`, `Hospital Operations`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-27`
- **Story Title:** On-Duty Hospital Contact Acknowledges & Closes SOS Incident
- **Bounded Context:** `Safety & SOS`, `Hospital Operations`
- **Primary Persona:** On-Duty Physician, On-Duty Hospital Administrator
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC140 (Receiving side) · BR-23, Q-48 · Activity Flow 17

---

## 💡 Real-World Context & Problem Statement

1. **Emergency alerts require personal accountability:** A broadcast alert without designated personal ownership leads to bystander apathy; an on-duty clinician must actively acknowledge receipt within the 5-minute SLA.
2. **Mandatory clinical resolution notes upon incident closure:** An emergency incident cannot simply be closed or dismissed without documenting what intervention occurred (ambulance dispatched, physician telephone consultation, police notified, etc.).

---

## 📖 User Story Statement

> As an **On-Duty Physician or On-Duty Hospital Administrator**,  
> I want to receive real-time SOS alerts, acknowledge them within 5 minutes, and document resolution upon closing the incident,  
> So that emergency situations are addressed swiftly with complete medical and legal accountability.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Incident Acknowledgement within 5 Minutes
- **Given** an incoming SOS emergency incident,
- **When** the on-duty focal point responds,
- **Then** the acknowledgement is stamped with `acknowledged_at` and responder ID; if past 5 minutes, the escalation status is recorded.

### AC-02: Mandatory Resolution Documentation Before Closure
- **Given** an acknowledged SOS incident under handling,
- **When** the on-duty responder closes the incident,
- **Then** the system strictly enforces entry of clinical/operational resolution notes; closing without documented resolution is blocked.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP27-01` | Acknowledge SOS alert within 5 minutes | Functional | Status transitions to Handling; escalation timer halted |
| `TC-USHP27-02` | Attempt closing SOS without resolution | Compliance | Action blocked; resolution notes field required |
