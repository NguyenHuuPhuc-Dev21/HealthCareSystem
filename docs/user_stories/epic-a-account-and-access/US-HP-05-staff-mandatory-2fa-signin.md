# User Story US-HP-05: Mandatory Two-Factor Sign-In for Staff

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-05`
- **Story Title:** Mandatory Two-Factor Sign-In for Staff
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Hospital Staff (Nurse, Doctor, Admin, Dispatcher)
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** BR-20, BR-21 · Activity Flow 01

---

## 💡 Real-World Context & Problem Statement

1. **Staff accounts access protected health information and financial transactions:** A single compromised staff password exposes sensitive medical records and enables unauthorized financial/shift tampering.
2. **Enforcing 2FA universally damages usability for elderly patients:** The baseline establishes a clear boundary—staff must use mandatory 2FA, while patients are not burdened with mandatory 2FA.

---

## 📖 User Story Statement

> As a **Hospital Staff Member**,  
> I want to sign in with email and password supplemented by a mandatory second factor,  
> So that operational healthcare accounts cannot be compromised through credential stuffing or leaked passwords.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Enforcement of Second Factor for Staff Sessions
- **Given** a valid hospital staff account,
- **When** signing in with valid password credentials,
- **Then** the system requires the second factor verification before issuing an authenticated staff session token.

### AC-02: Patient Exemption from Mandatory 2FA
- **Given** a patient or family member account,
- **When** signing in,
- **Then** the system does not enforce a second factor for routine sign-in.

### AC-03: No Self-Service Helpdesk Recovery for Staff
- **Given** a staff member who has lost access credentials,
- **When** they request account recovery,
- **Then** recovery must proceed strictly through hospital administrative governance rather than the patient-facing call center.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP05-01` | Staff sign-in lacking 2FA verification | Security | Blocked at 2FA step; no session token granted |
| `TC-USHP05-02` | Patient standard sign-in | Functional | Sign-in succeeds without second factor prompt |
| `TC-USHP05-03` | Staff account recovery attempt | Security | No self-service call center route exists for staff |
