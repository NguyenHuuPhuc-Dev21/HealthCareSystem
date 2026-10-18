# User Story US-HP-01: Email-Only Registration & Sign-In for Patients

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-01`
- **Story Title:** Email-Only Registration & Sign-In for Patients
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Patient, Family Member / Legal Representative
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC1, UC14, UC61, UC82, UC83 · BR-20 · Activity Flow 01

---

## 💡 Real-World Context & Problem Statement

1. **Tech-averse elderly patients:** Every additional sign-in requirement (phone number, national ID card/CCCD) introduces a drop-off point. Baseline decisions mandate email as the sole account identifier for patients (Q-51 → BR-20).
2. **Unnecessary sensitive identity data collection:** The platform does not collect national ID cards and consequently neither can nor needs to verify legal age/identity—collecting excess credentials only increases cybersecurity and privacy liabilities without fulfilling any operational requirement.

---

## 📖 User Story Statement

> As a **Patient or Family Member**,  
> I want to register and sign in using only my email and password (accompanied by an email OTP when requested by the system),  
> So that I can access home healthcare services effortlessly without being forced to provide a phone number or national ID.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Email Registration & Verification
- **Given** an unregistered user,
- **When** they register with an email address and password,
- **Then** the system creates the account and verifies email ownership via an OTP or verification link sent directly to that email.

### AC-02: Absence of Alternative Identity Channels
- **Given** any patient registration or sign-in interface,
- **When** a user interacts with the form,
- **Then** no phone number or national ID fields are displayed, and no SMS-based sign-in channel exists.

### AC-03: Password Reset Exclusively via Email
- **Given** an existing registered account,
- **When** the account owner requests a password reset,
- **Then** the system sends a reset OTP or secure link to the registered email; no alternative self-service reset channels are exposed to patients.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP01-01` | Register new account via email | Functional | Account is created only after successful email verification |
| `TC-USHP01-02` | Audit registration & login forms | UI / Compliance | No phone number / national ID fields; no SMS options available |
| `TC-USHP01-03` | Password reset execution | Functional / Security | Completed exclusively via OTP/link delivered to registered email |
