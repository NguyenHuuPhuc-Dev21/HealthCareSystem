# User Story US-HP-19: In-App Code Check-In at Patient's Home

> **Epic:** EPIC E — Home Care Visit Execution  
> **Bounded Context:** `Care Session`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-19`
- **Story Title:** In-App Code Check-In at Patient's Home
- **Bounded Context:** `Care Session`
- **Primary Persona:** Nurse, Patient
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC33 · BR-09, BR-20 · Activity Flow 07A

---

## 💡 Real-World Context & Problem Statement

1. **Fraud prevention and verified on-site presence:** Proving that the visiting nurse has physically arrived at the patient's home at the designated time prevents phantom visits and attendance falsification.
2. **Distinct in-app code vs. email OTP (BR-20):** The check-in verification code is generated dynamically inside the patient's active mobile app—**NEVER** sent via email OTP. This prevents remote dispatchers or proxies from checking in on behalf of absent nurses.

---

## 📖 User Story Statement

> As an **On-Duty Nurse**,  
> I want to enter the dynamic verification code displayed in the patient's mobile app upon arrival to check in,  
> So that my physical presence and the visit start timestamp are verified indisputably.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: In-App Dynamic Verification Code Generation
- **Given** a patient with a nurse arriving on-site,
- **When** opening the active visit screen in their mobile application,
- **Then** a dynamic, time-sensitive check-in verification code is rendered on screen (strictly within the app, not via email OTP).

### AC-02: Check-In Validation & Session Initialization
- **Given** the nurse entering the patient's verification code,
- **When** validated by the backend,
- **Then** the visit transitions to "In Progress" (`DANG_THUC_HIEN`), and `check_in_at` is stamped immutably.

### AC-03: Invalid Code Handling & Throttling
- **Given** an incorrect or expired verification code,
- **When** submitted by the nurse,
- **Then** the check-in is rejected with an error message, and consecutive failed attempts are logged and throttled.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP19-01` | Successful check-in via in-app code | Functional | Visit moves to `DANG_THUC_HIEN` with logged `check_in_at` |
| `TC-USHP19-02` | Verify code source compliance (BR-20) | Compliance | Code generated strictly in-app; email OTP rejected |
| `TC-USHP19-03` | Incorrect verification code attempt | Security | Check-in rejected; failure logged; retry limit enforced |
