# User Story US-HP-18: Nurse Pre-Session Briefing

> **Epic:** EPIC E — Home Care Visit Execution  
> **Bounded Context:** `Care Session`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-18`
- **Story Title:** Nurse Pre-Session Briefing
- **Bounded Context:** `Care Session`
- **Primary Persona:** Nurse
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC31, UC32 · BR-08 · Activity Flow 07

---

## 💡 Real-World Context & Problem Statement

1. **In-home nursing carries dynamic field risks:** Nurses travel independently to private residences and must review clinical history, reported symptoms, special family instructions, and location before departing.
2. **Patient privacy protection:** Detailed clinical notes and contact details must be exposed only to the assigned nurse during active shift preparation, not broadly accessible across the hospital.

---

## 📖 User Story Statement

> As an **Assigned Nurse**,  
> I want to review a comprehensive pre-session briefing (patient clinical history, reported symptoms, navigation address, and precautions),  
> So that I can pack appropriate medical supplies and review safety requirements prior to arriving at the patient's home.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Authorized Shift Briefing Access
- **Given** a nurse assigned to an upcoming home visit,
- **When** accessing the shift detail in the Nurse Mobile App,
- **Then** the system displays the patient medical summary, latest symptom screening records, and geocoded destination.

### AC-02: Immediate Access Revocation on Reassignment
- **Given** an unassigned or cancelled visit,
- **When** the previously assigned nurse views the app,
- **Then** access to the patient's personal and medical data is revoked immediately.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP18-01` | Retrieve pre-session briefing | Functional | Patient summary, symptoms, address displayed accurately |
| `TC-USHP18-02` | Access attempt by unassigned staff | Security / AuthZ | Access denied; unauthorized staff cannot view patient data |
