# User Story US-HP-18: Nurse Reviews Booking & Medical Information Inside the Access Window Before the Shift

> **Epic:** EPIC E — Shift Execution  
> **Bounded Context:** `Shift Execution`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-18`
- **Story Title:** Nurse Reviews Booking & Medical Information Inside the Access Window Before the Shift
- **Bounded Context:** `Shift Execution`
- **Primary Persona:** Nurse (TIER_1_BASIC / TIER_2_SPECIALIST)
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-PRIV-01 · FR-BOOK-02 · FR-AUTH-03 · SRS §7 (`patient_profiles`, `bookings`) · SRS §10 TC-PRIV-01

---

## 💡 Real-World Context & Problem Statement

1. **Nurses travel independently to a patient's home or hospital bedside:** Before departing, the assigned nurse must review the patient's condition, the booked service, the care address, and — for invasive services — the doctor's prescription/medical order image, in order to prepare the right supplies and verify the order is valid.
2. **Health data is sensitive personal data (Decree 13/2023/NĐ-CP):** The patient's medical record and prescription image may be exposed only to the nurse assigned to that exact booking, and only inside a bounded access window — never to the wider nurse pool and never indefinitely (FR-PRIV-01).

---

## 📖 User Story Statement

> As an **Assigned Nurse**,  
> I want to view the booking details and the patient's medical information (patient profile, medical history, care address, and prescription image for invasive services) inside the permitted access window before my shift,  
> So that I can prepare appropriate supplies, verify the medical order in advance, and arrive ready to provide care.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Access Window Opens at CONFIRMED for the Assigned Nurse Only
- **Given** a booking in `execution_status = CONFIRMED` with a nurse assigned,
- **When** that assigned nurse opens the booking detail in the Nurse Web Portal or Nurse Mobile App,
- **Then** the system displays the patient profile (condition, mobility status, medical history, infectious-disease flag), the booked service, the care address with coordinates, and the prescription/medical order image when the service is invasive (`is_invasive = true`); any other nurse or user requesting the same data is denied (HTTP 403).

### AC-02: Pre-Shift Review of the Prescription Image (Tier 2)
- **Given** an invasive-service booking with a prescription image attached at booking creation (FR-BOOK-02),
- **When** the assigned TIER_2_SPECIALIST nurse reviews the booking before accepting/travelling,
- **Then** the prescription image is viewable inside the app so the nurse can check the patient name, medication/dosage, issuing doctor's signature/stamp, and issue date (must be ≤ 7 days old) before the shift.

### AC-03: Access Automatically Closes 12 Hours After Check-Out
- **Given** a booking whose nurse has checked out,
- **When** 12 hours have elapsed from `checkout_time`,
- **Then** the nurse's access to that booking's medical record and prescription image is automatically revoked (subsequent API calls return HTTP 403); during the 24-hour dispute window, evidence is drawn from system logs, and an Admin may re-grant time-limited access for dispute handling with the grant recorded in `audit_logs` (action `VIEW_MEDICAL_RECORD`).

### AC-04: Access Ends Immediately on Cancellation or Reassignment
- **Given** a booking that is cancelled or reassigned to a different nurse before the shift,
- **When** the previously assigned nurse opens the booking,
- **Then** the medical information is no longer accessible to them, and access passes only to the newly assigned nurse once the booking returns to CONFIRMED.

### AC-05: Time-Limited Secure Viewing of Medical Attachments
- **Given** medical attachments (prescription image, patient documents) stored privately,
- **When** the nurse views them inside the access window,
- **Then** files are served only via presigned URLs valid for 10 minutes (NFR-SEC-01), and every medical-record view is written to `audit_logs`.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP18-01` | Assigned nurse views booking & medical info at CONFIRMED | Functional | Patient profile, service, address, and prescription image (if invasive) displayed |
| `TC-USHP18-02` | Unassigned nurse requests the same booking's medical record | Security / AuthZ | HTTP 403; no medical data returned |
| `TC-USHP18-03` | Access 12 hours after check-out (SRS TC-PRIV-01) | Security / Privacy | Nurse's API access to the record is blocked (HTTP 403) |
| `TC-USHP18-04` | Reassignment revokes the previous nurse's access | Security / AuthZ | Previous nurse denied; new nurse gains access at CONFIRMED |
| `TC-USHP18-05` | Medical-record view is audit-logged | Compliance | `audit_logs` entry with action `VIEW_MEDICAL_RECORD`, actor, timestamp, IP |
