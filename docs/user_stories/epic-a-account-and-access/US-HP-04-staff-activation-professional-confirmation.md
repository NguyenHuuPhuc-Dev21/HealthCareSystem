# User Story US-HP-04: Two-Step Staff Activation & Professional Confirmation

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`, `Hospital Operations`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-04`
- **Story Title:** Two-Step Staff Activation & Professional Confirmation
- **Bounded Context:** `Identity & Consent`, `Hospital Operations`
- **Primary Persona:** Nurse, Doctor (Hospital Clinical Staff)
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC139 · BR-21 · Q-50 · Activity Flow 01

---

## 💡 Real-World Context & Problem Statement

1. **Account issuance does not equal clinical authorization:** The hospital provisions credentials, but professional medical credentials must be explicitly confirmed by hospital administration before staff interact with patients.
2. **Matching unverified staff is a critical patient safety hazard:** If the matching engine does not filter out accounts lacking completed two-step activation and credential confirmation, home care shifts could be assigned to unqualified personnel.

---

## 📖 User Story Statement

> As a **Newly Provisioned Nurse or Doctor**,  
> I want to complete two-step authentication setup and receive administrative professional confirmation before accepting shifts,  
> So that only authorized, verified healthcare professionals are eligible in the dispatch matching pool.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Unconfirmed Staff Excluded from Shift Matching
- **Given** a staff account that has not completed professional credential confirmation (UC139),
- **When** the system executes the matching algorithm,
- **Then** the account is strictly excluded from candidate pools for all shifts.

### AC-02: Profile Lifecycle State Compliance (BR-21)
- **Given** a staff profile undergoing activation,
- **When** the profile transitions between lifecycle stages,
- **Then** the state must strictly conform to the allowed status list in BR-21, and all transitions must be logged in the audit trail.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP04-01` | Matching candidate filter with unconfirmed staff | Functional | Staff lacking UC139 confirmation is excluded from candidate list |
| `TC-USHP04-02` | Profile lifecycle state transitions | Functional | Status strictly valid per BR-21 with complete transition logs |
