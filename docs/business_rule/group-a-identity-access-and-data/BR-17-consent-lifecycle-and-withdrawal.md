# BR-17: Consent Lifecycle & Withdrawal

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §0.3 (REF-LAW-03), §3 (RISK-03), §4.1 (FR-AUTH-03, FR-PRIV-01), §7, §8  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **Consent of the Data Subject:** Health data is sensitive personal data under **Nghị định 13/2023/NĐ-CP**. Processing it — including creating a patient profile and sharing it with an assigned nurse — requires the consent of the patient or their legal guardian (FR-PRIV-01).
2. **Consent is a Booking Precondition:** The booking API verifies the Nghị định 13/2023 consent before a booking can be created (`POST /api/v1/bookings`, SRS §8). A patient profile cannot be saved without the consent checkbox (RTM TC-PRIV-01).

---

## 2. Rule Specifications

### 2.1 Consent Acquisition (FR-PRIV-01)
- Consent is captured per **patient profile** (care recipient), not merely per account: the Customer creating the profile confirms the consent checkbox together with the sensitive personal data protection terms.
- The consenting party is the **patient or their legal guardian** (FR-PRIV-01).
- The system records, for each consent: the acceptance flag (`patient_profiles.data_consent_accepted`), the **consent timestamp** (`consent_timestamp`), and the **IP / Device ID** of the consenting session (FR-PRIV-01).
- **Effect of withholding consent:** without the consent checkbox, the patient profile cannot be stored and no booking can be created for that recipient (RTM TC-PRIV-01).

### 2.2 Consent to Share Medical Records with the Assigned Nurse
- Consent covers sharing the care recipient's medical record and doctor's order (y lệnh) image with the **one nurse assigned to a specific booking**.
- Sharing is bounded by the record-access window of BR-09 §2.4: access opens when the booking reaches `CONFIRMED`, and is automatically revoked **12 hours after check-out**. No nurse retains record access outside this window.
- During dispute handling, evidence is produced from system logs; an Admin may re-grant the nurse time-limited access, recorded in the audit log (BR-09 §2.3).

### 2.3 Consent for Customer eKYC (FR-AUTH-03)
- Booking **home care** additionally requires the Customer to complete CCCD eKYC (BR-14). Submitting CCCD images and a selfie for eKYC is part of the account's identity processing; care at a hospital location requires phone verification only.

### 2.4 Withdrawal of Consent
- The data subject may request **deletion / anonymization of personal data** under Nghị định 13/2023/NĐ-CP (FR-PRIV-01; mechanics in BR-12).
- [Not specified in SRS v2.0 — open item] SRS v2.0 does not define a standalone consent-withdrawal workflow (channel, identity re-verification, or its precise effect on already-CONFIRMED bookings). The old hospital-baseline mechanics (email-link consent, email-OTP revocation, per-scenario refund handling) are **not** carried over.
- [Not specified in SRS v2.0 — open item] Re-consent handling when the data-processing terms materially change (the old baseline's mandatory re-consent / view-only mode) is not specified in SRS v2.0.

---

## 3. Traceability & Dependencies

- **SRS References:** §0.3 REF-LAW-03, §3 RISK-03, §4.1 FR-AUTH-03 / FR-PRIV-01, §7 (`patient_profiles.data_consent_accepted`, `consent_timestamp`, `deleted_at`), §8 (`POST /api/v1/bookings` — consent check), §10 RTM TC-PRIV-01
- **Related Rules:** BR-09 (record-access window), BR-12 (retention & erasure), BR-14 (booking prerequisites), BR-20 (identity channels used for consent capture)
