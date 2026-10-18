# User Story US-HP-13: Patient-Initiated Cancellation with Transparent Refund Rule

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`, `Payment & Deposit`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-13`
- **Story Title:** Patient-Initiated Cancellation with Transparent Refund Rule
- **Bounded Context:** `Booking & Matching`, `Payment & Deposit`
- **Primary Persona:** Patient
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC14 · BR-07, BR-18 F2 · Activity Flow 06

---

## 💡 Real-World Context & Problem Statement

1. **Late cancellations inflict travel waste and unrecoverable shift locks on nurses:** Clear cancellation cutoffs protect medical staff from wasted travel and uncompensated downtime.
2. **Transparent refund rules prevent billing disputes:** Patients must see exactly what portion of their deposit is refundable or forfeited before confirming cancellation.

---

## 📖 User Story Statement

> As a **Patient**,  
> I want to cancel my booked visit through the app and see the exact refund/forfeiture calculation before confirming,  
> So that I can cancel when necessary with transparent financial expectations.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Time-Tiered Refund Policy Evaluation (BR-07 / BR-18 F2)
- **Given** a confirmed booking,
- **When** the patient initiates cancellation,
- **Then** the system evaluates the remaining time before the scheduled slot and clearly displays the exact refund percentage (e.g., full refund before cutoff, forfeiture after cutoff).

### AC-02: Immediate Nurse Shift Release
- **Given** a confirmed cancellation submission,
- **When** processed,
- **Then** the assigned nurse's calendar slot is immediately unlocked to available status, and notifications are sent to all stakeholders.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP13-01` | Timely cancellation prior to cutoff | Functional | Eligible deposit refund processed per BR-18 F2 |
| `TC-USHP13-02` | Late cancellation past cutoff | Functional | Deposit forfeited; clear financial breakdown presented |
| `TC-USHP13-03` | Calendar release for nurse | Functional | Nurse shift unlocked and available for rematching immediately |
