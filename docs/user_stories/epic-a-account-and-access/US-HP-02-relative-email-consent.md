# User Story US-HP-02: A Relative Books Care for a Patient

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-02`
- **Story Title:** A Relative Books Care for a Patient (Care-Recipient Profile + Consent to Share Medical Records)
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Family Member (booking on behalf of a care recipient)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-AUTH-03 · FR-PRIV-01 · SRS §7 `patient_profiles` (`data_consent_accepted`, `consent_timestamp`)

---

## 💡 Real-World Context & Problem Statement

1. **The person booking is often not the person receiving care:** SRS v2.0 models the customer account holder and the care recipient as different entities. A family member signs in with their own phone number, completes eKYC on their own account, and creates care-recipient profiles (`patient_profiles`) for the people they book care for.
2. **Sharing a recipient's health data requires recorded consent:** Under Nghị định 13/2023/NĐ-CP, processing someone's sensitive health data — and showing it to an assigned nurse — requires the consent of the patient or their legal guardian, recorded with a timestamp. Without that consent on record, the nurse assigned to the shift must not be able to view the recipient's medical records or doctor's-order images.

---

## 📖 User Story Statement

> As a **Family Member**,  
> I want to create a care-recipient profile for my relative and record consent to process their health data and share it with the nurse assigned to their shift,  
> So that I can book and manage home care on their behalf with a lawful, auditable basis for the data sharing.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Care-Recipient Profile Under the Booker's Account
- **Given** a signed-in customer,
- **When** they create a care-recipient profile for a relative (full name, year of birth, weight, mobility status, medical history, infectious-disease status, care address),
- **Then** the profile is stored under their account (`patient_profiles.customer_id`) and can be selected when creating a booking.

### AC-02: Recorded Consent Before Any Record Sharing
- **Given** a care-recipient profile being created or first used for a booking,
- **When** the booker confirms the health-data processing consent checkbox (as the patient or their legal guardian),
- **Then** the system records `data_consent_accepted` with `consent_timestamp` and the consenting IP/Device ID; without this consent, the profile cannot be saved for booking (FR-PRIV-01).

### AC-03: Scoped, Time-Boxed Nurse Access to the Recipient's Records
- **Given** a booking for the care recipient in status CONFIRMED or IN_PROGRESS,
- **When** the assigned nurse opens the booking,
- **Then** only that nurse can view the recipient's medical record and doctor's-order image for that booking, and the access is automatically revoked 12 hours after check-out (FR-PRIV-01).

### AC-04: No Third-Party Consent by Platform Staff
- **Given** any booking or profile requiring consent,
- **When** consent is recorded,
- **Then** it is recorded only from the customer's own authenticated action; Admin/operator accounts have no function to consent on a customer's behalf (Admin may only re-grant a nurse time-limited record access during dispute handling, with an audit log — FR-PRIV-01).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-PRIV-01` (SRS §10) | Save a patient profile without ticking the Nghị định 13/2023 consent | Functional / Compliance | Profile is not saved; booking cannot proceed |
| `TC-USHP02-01` | Create a care-recipient profile for a relative and book against it | Functional | Profile stored under the booker's account; booking references the correct `patient_profile_id` |
| `TC-USHP02-02` | Nurse record access outside the assigned booking window | Security / AuthZ | Access denied (HTTP 403) before CONFIRMED and after 12 hours post check-out |
| `TC-USHP02-03` | Attempt consent action from an Admin account | Security / AuthZ | No consent-on-behalf function exists for Admin/operator roles |
