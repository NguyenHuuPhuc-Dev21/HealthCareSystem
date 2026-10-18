# User Story US-HP-11: New Matching Round After Nurse Cancellation During Deposit Wait

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-11`
- **Story Title:** New Matching Round After Nurse Cancellation During Deposit Wait
- **Bounded Context:** `Booking & Matching`
- **Primary Persona:** Patient, Hospital Dispatcher
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** Activity Flow 05 · BR-06

---

## 💡 Real-World Context & Problem Statement

1. **Nurse cancels before deposit completion:** If an assigned nurse cancels while the patient is completing their deposit payment, dropping the entire order frustrates the patient. Automated re-matching maintains booking continuity.
2. **Deposit countdown must adjust fairly:** The patient must not be penalized with an expired deposit timer because of a nurse-side withdrawal.

---

## 📖 User Story Statement

> As a **Patient**,  
> If the matched nurse declines or cancels while I am in the deposit payment window, I want the system to automatically trigger a new matching round,  
> So that my booking proceeds without having to start the entire process over.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Automatic Secondary Matching Round Trigger
- **Given** an order in deposit payment waiting status,
- **When** the assigned nurse cancels the assignment,
- **Then** the system automatically initiates a secondary matching round among eligible available nurses.

### AC-02: Deposit Payment Window Adjustment
- **Given** a rematching event,
- **When** a replacement nurse is assigned,
- **Then** the deposit payment countdown timer is reset or extended per configuration to allow the patient adequate time to pay.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP11-01` | Automatic rematch on nurse drop | Functional | Next qualified candidate nurse is matched automatically |
| `TC-USHP11-02` | Deposit timer extension | Functional | Payment window resets to configured duration upon rematch |
