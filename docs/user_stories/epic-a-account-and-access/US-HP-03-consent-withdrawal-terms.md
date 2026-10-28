# User Story US-HP-03: Customer Withdraws Consent / Requests Data Handling per Nghị định 13/2023

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-03`
- **Story Title:** Customer Withdraws Consent / Requests Data Handling per Nghị định 13/2023
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Customer (Patient / Family Member account owner)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-PRIV-01 · RISK-03 · SRS §7 `patient_profiles.deleted_at`, `audit_logs` (`DELETE_PATIENT_DATA`)

---

## 💡 Real-World Context & Problem Statement

1. **Consent for health data must be reversible:** Nghị định 13/2023/NĐ-CP gives data subjects the right to withdraw consent and to request deletion/anonymization of their personal data. A marketplace holding medical histories and doctor's-order images must make those rights executable in-product, not by email request.
2. **Withdrawal has operational consequences that must be explicit:** Medical records exist so assigned nurses can work safely. If consent is withdrawn, nurse access to the records must close and future bookings relying on that data can no longer be served — the customer must see these consequences before confirming, and the platform must retain only what the SRS permits (medical records stored for a maximum of 24 months for lookup/legal purposes).

---

## 📖 User Story Statement

> As a **Customer**,  
> I want to withdraw my health-data consent and request deletion or anonymization of personal data under Nghị định 13/2023, with the consequences explained before I confirm,  
> So that my data rights are genuinely enforceable and I understand exactly what stops working when consent is withdrawn.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Consent Withdrawal with Consequence Warning
- **Given** an active care-recipient profile with recorded consent,
- **When** the account owner withdraws consent after confirming the displayed consequences,
- **Then** the withdrawal is recorded with a timestamp, and the consent flag no longer authorizes any new data processing or record sharing for that profile.

### AC-02: Immediate Effect on Nurse Record Access
- **Given** consent withdrawn for a care-recipient profile,
- **When** any nurse (including one previously assigned) calls the API to view that recipient's medical record or doctor's-order image,
- **Then** access is denied; independently of withdrawal, nurse access also closes automatically 12 hours after check-out of the last shift (FR-PRIV-01).

### AC-03: Deletion / Anonymization Request
- **Given** a customer request to delete or anonymize personal data,
- **When** the request is processed,
- **Then** the profile is soft-deleted/anonymized (`patient_profiles.deleted_at` set) and the operation is written to the audit log (`DELETE_PATIENT_DATA` with actor, target and IP); medical records are in any case retained no longer than the 24-month maximum in FR-PRIV-01.

### AC-04: Effect on Account & Future Bookings
- **Given** consent withdrawn for all care-recipient profiles on an account,
- **When** the customer attempts to create a new booking,
- **Then** the booking cannot proceed until consent is granted again for the selected care-recipient profile, because the booking flow checks consent at creation (FR-PRIV-01; SRS §8 `POST /api/v1/bookings`).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-PRIV-01` (SRS §10) | Record-access behaviour around consent and settlement | Security / Compliance | After the access window closes, the previously assigned nurse's record-view API returns HTTP 403 |
| `TC-USHP03-01` | Withdraw consent on a profile | Functional | Withdrawal timestamped; profile no longer shareable with any nurse |
| `TC-USHP03-02` | Request data deletion/anonymization | Functional / Compliance | Profile soft-deleted (`deleted_at` set) and `DELETE_PATIENT_DATA` audit entry created |
| `TC-USHP03-03` | Create a booking after consent withdrawal | Functional | Booking blocked until consent is re-granted for the selected profile |

> **Open items:** the processing deadline for deletion/anonymization requests and the handling of already-CONFIRMED future bookings at the moment consent is withdrawn are [Not specified in SRS v2.0 — open item].
