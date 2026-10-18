# User Story US-HP-22: Mandatory Post-Session Care Report

> **Epic:** EPIC E — Home Care Visit Execution  
> **Bounded Context:** `Care Session`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-22`
- **Story Title:** Mandatory Post-Session Care Report
- **Bounded Context:** `Care Session`
- **Primary Persona:** Nurse
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC36 · BR-22 · Activity Flow 07A

---

## 💡 Real-World Context & Problem Statement

1. **Incomplete care documentation creates clinical discontinuity:** Every completed visit must produce a formal care report detailing procedures performed, patient tolerance, vital sign trends, and follow-up guidance.
2. **Universal requirement regardless of pre-visit symptom entry (BR-22):** Even if the patient entered zero symptoms prior to the visit, filing a care report remains **strictly mandatory** before the visit can be closed.

---

## 📖 User Story Statement

> As a **Nurse**,  
> I want to submit a mandatory post-session care report upon concluding nursing care,  
> So that clinical documentation is archived for the hospital and shared with the patient and attending physician.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Mandatory Report Submission Before Shift Completion
- **Given** a nursing session where procedures have concluded,
- **When** the nurse attempts to complete the session,
- **Then** the system enforces submission of a completed care report.

### AC-02: Universal Enforcement Independent of Initial Symptoms (BR-22)
- **Given** a visit where the patient entered no pre-visit symptoms,
- **When** the nurse finishes care,
- **Then** the care report requirement remains strictly enforced with no exceptions.

### AC-03: Multi-Role Clinical Accessibility
- **Given** a submitted care report,
- **When** stored in the electronic record,
- **Then** it is permanently linked to the patient profile and accessible to the patient, visiting nurse, and hospital clinical staff.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP22-01` | Submit complete post-visit care report | Functional | Visit completes successfully; report attached to patient profile |
| `TC-USHP22-02` | Attempt completion without care report (BR-22) | Compliance | System blocks completion with validation error |
| `TC-USHP22-03` | Verify multi-role report accessibility | Functional | Report is readable by patient, nurse, and hospital doctor |
