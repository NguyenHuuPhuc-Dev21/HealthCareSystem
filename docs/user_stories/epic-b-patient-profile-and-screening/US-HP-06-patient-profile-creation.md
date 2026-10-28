# User Story US-HP-06: Customer Creates Care-Recipient Profiles

> **Epic:** EPIC B — Patient Profile & Condition Declaration  
> **Bounded Context:** `Patient Profile`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-06`
- **Story Title:** Customer Creates Care-Recipient Profiles (Condition Declaration, Address, Notes)
- **Bounded Context:** `Patient Profile`
- **Primary Persona:** Customer (Patient / Family Member)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-AUTH-03 · FR-PRIV-01 · SRS §7 `patient_profiles`

---

## 💡 Real-World Context & Problem Statement

1. **One account books for several people:** A single customer account manages care-recipient profiles for themselves and family members, created once and reused across bookings instead of re-entering medical details every time.
2. **Home-care booking requires the account holder's eKYC:** Unlike the superseded baseline, identity documents are now central: when the care location is a private home, the customer account must have completed eKYC (CCCD both sides + live selfie) before a booking can be created, so both sides of a home visit are identity-verified (CT-14). For care at a hospital location, phone verification alone is sufficient.
3. **Profile data drives safety and price:** Weight and mobility status are not decoration — a recipient weighing ≥ 80 kg or bedridden (BEDRIDDEN) triggers the +15% heavy-patient surcharge, and the declared condition is what the assigned nurse relies on until the on-site check (US-HP-07).

---

## 📖 User Story Statement

> As a **Customer**,  
> I want to complete eKYC on my account and create reusable care-recipient profiles with condition declaration, care address and notes,  
> So that I can book home care for myself or my relatives with the nurse receiving accurate information from the start.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Customer eKYC Gate for Home-Care Booking
- **Given** a customer whose account has not completed eKYC (CCCD both sides + live selfie),
- **When** they attempt to create a booking with care location "private home (HOME)",
- **Then** the system requires completed eKYC on the customer account before the booking can be created; for location "hospital (HOSPITAL)", phone verification alone suffices (FR-AUTH-03).

### AC-02: Care-Recipient Profile Fields & Reuse
- **Given** a signed-in customer,
- **When** they create a care-recipient profile,
- **Then** the profile captures full name, date of birth, weight (kg), mobility status (NORMAL / PARTIAL / BEDRIDDEN), medical history, infectious-disease status and the care address (geocoded to lat/lng), is stored under the customer's account, and is selectable for every later booking without re-entry.

### AC-03: Consent Recorded with the Profile
- **Given** a care-recipient profile being saved,
- **When** the customer ticks the health-data consent (patient or legal guardian) required by Nghị định 13/2023,
- **Then** `data_consent_accepted` and `consent_timestamp` are recorded on the profile; without consent the profile cannot be saved (FR-PRIV-01 — see also US-HP-02).

### AC-04: Profile Data Feeds Pricing & Nurse Briefing
- **Given** a profile with `weight_kg >= 80` or `mobility_status = BEDRIDDEN`,
- **When** a booking is priced for that profile,
- **Then** the +15% heavy-patient surcharge (SURCHARGE_HEAVY_PATIENT) is applied in the price calculation (FR-BOOK-01).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-KYC-01` (SRS §10) | Unverified customer books private-home care | Functional / Compliance | System requires completed CCCD eKYC before allowing the booking |
| `TC-USHP06-01` | Create profile and book against it | Functional | Booking succeeds using the saved profile; no data re-entry required |
| `TC-USHP06-02` | Profile with weight ≥ 80 kg priced at booking | Functional | +15% heavy-patient surcharge appears in the booking price breakdown |
| `TC-USHP06-03` | Multiple care-recipient profiles under one account | Functional | Each profile is independently selectable per booking |
