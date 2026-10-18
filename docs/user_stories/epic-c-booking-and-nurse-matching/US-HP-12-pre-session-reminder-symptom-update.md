# User Story US-HP-12: Pre-Session Reminder & Optional Symptom Update

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`, `Patient Profile & Screening`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-12`
- **Story Title:** Pre-Session Reminder & Optional Symptom Update
- **Bounded Context:** `Booking & Matching`, `Patient Profile & Screening`
- **Primary Persona:** Patient
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC119 · BR-15 · Activity Flow 06

---

## 💡 Real-World Context & Problem Statement

1. **Patient conditions change between booking and visit:** Wound exudate, fever, or pain levels can change; inviting the patient to optionally update symptoms helps the visiting nurse prepare appropriate supplies.
2. **Non-mandatory nature:** Symptom updates must remain strictly optional—ignoring the update prompt must never cancel or delay the scheduled appointment (BR-22).

---

## 📖 User Story Statement

> As a **Patient**,  
> I want to receive an advance reminder notification with an option to update my symptoms prior to the nurse's visit,  
> So that the care team is informed of my latest health status while leaving the update entirely voluntary.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Automated Timed Reminder Notification
- **Given** an upcoming confirmed appointment,
- **When** the configured reminder time (e.g., 24h or 2h prior) is reached,
- **Then** the system sends a notification via email and in-app with a link to optionally submit updated symptoms.

### AC-02: Unhindered Session Execution if Update Skipped
- **Given** a patient who does not submit an updated symptom form,
- **When** the appointment time arrives,
- **Then** the visit proceeds normally; the nurse conducts the mandatory on-site initial assessment regardless.

### AC-03: Dynamic Re-Triage on Submitted Updates
- **Given** updated symptoms entered by the patient,
- **When** submitted,
- **Then** the system generates a new screening record; if emergency criteria are triggered, emergency instructions are immediately presented.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP12-01` | Scheduled reminder dispatch | Functional | Email and in-app notifications sent at configured thresholds |
| `TC-USHP12-02` | Appointment continuity without update | Functional | Shift remains active and ready for nurse check-in |
| `TC-USHP12-03` | Re-triage triggered by symptom update | Functional | New screening created without altering original booking record |
