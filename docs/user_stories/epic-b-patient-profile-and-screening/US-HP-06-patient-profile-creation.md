# User Story US-HP-06: Patient Profile Creation

> **Epic:** EPIC B — Patient Profile & Symptom Screening  
> **Bounded Context:** `Patient Profile & Screening`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-06`
- **Story Title:** Patient Profile Creation
- **Bounded Context:** `Patient Profile & Screening`
- **Primary Persona:** Patient, Account Owner
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC6, UC11 · BR-17 · Activity Flow 02

---

## 💡 Real-World Context & Problem Statement

1. **Re-entering data for every booking causes high user dropout:** Especially for elderly patients or family caretakers, profiles must be created once and seamlessly reused across subsequent bookings.
2. **Excess data collection creates privacy liability:** Profiles should only gather medical history and logistics necessary for home nursing; national ID cards (CCCD) have been removed from the architecture (Q-51) and must not be collected through backdoor form fields.

---

## 📖 User Story Statement

> As a **Patient or Account Owner**,  
> I want to create a care recipient profile (basic info, relevant medical history, home address),  
> So that I can reuse it across all home-care bookings without redundant data entry.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Profile Creation & Immediate Reusability
- **Given** an authenticated user account,
- **When** the account owner creates a patient profile,
- **Then** the profile is immediately usable for appointment booking and prepopulated on all subsequent visits.

### AC-02: Strict Exclusion of National ID Data
- **Given** the patient profile creation and edit forms,
- **When** auditing all form inputs,
- **Then** no national ID (CCCD) or identification photo upload fields exist.

### AC-03: Multi-Profile Management Under Legal Representation
- **Given** an account owner who acts as an authorized representative under BR-17,
- **When** creating profiles for family members,
- **Then** the system allows multi-profile management and clearly logs the declared representation relationship.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP06-01` | Create profile & execute booking | Functional | Booking succeeds without needing to re-enter patient data |
| `TC-USHP06-02` | Audit profile form schema | UI / Compliance | No national ID or identity document fields exist |
| `TC-USHP06-03` | Create dependent family profile | Functional | Profile saved with representation attestation per BR-17 |
