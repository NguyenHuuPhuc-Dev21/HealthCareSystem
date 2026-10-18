# User Story US-HP-20: Mandatory Initial Assessment by Service-Type Form

> **Epic:** EPIC E — Home Care Visit Execution  
> **Bounded Context:** `Care Session`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-20`
- **Story Title:** Mandatory Initial Assessment by Service-Type Form
- **Bounded Context:** `Care Session`
- **Primary Persona:** Nurse
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC34 · BR-09 · Activity Flow 07A

---

## 💡 Real-World Context & Problem Statement

1. **Clinical evaluation must precede medical interventions:** Vital signs (blood pressure, pulse, temperature, SpO2) and physical stability must be verified before administering injections, IV fluids, or complex wound care.
2. **Service-specific clinical protocols:** Different nursing procedures (e.g. post-operative surgical wound care vs pediatric care) require distinct standardized assessment forms.

---

## 📖 User Story Statement

> As a **Nurse**,  
> I want to complete a mandatory standardized clinical assessment form tailored to the booked service type immediately following check-in,  
> So that I can verify that the patient is clinically stable to safely receive the planned care.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Service-Type-Specific Assessment Template Loading
- **Given** a checked-in care session,
- **When** the nurse opens the assessment workflow,
- **Then** the system loads the clinical assessment template matching the booked service type.

### AC-02: Mandatory Prerequisite for Clinical Completion
- **Given** an incomplete initial assessment form,
- **When** the nurse attempts to submit supplies, file the care report, or complete the visit,
- **Then** the system blocks progression until the mandatory assessment form is validated and recorded.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP20-01` | Render service-specific assessment form | Functional | Correct fields (vitals, wound status, etc.) displayed for service |
| `TC-USHP20-02` | Enforce assessment completion prerequisite | Functional | Cannot submit subsequent procedures without completed assessment |
