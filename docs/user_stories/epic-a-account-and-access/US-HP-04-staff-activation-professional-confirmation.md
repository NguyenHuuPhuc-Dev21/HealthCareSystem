# User Story US-HP-04: Nurse Account Activation After eKYC + Tier Assignment by Admin

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-04`
- **Story Title:** Nurse Account Activation After eKYC + Tier Assignment by Admin
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Nurse / Retired Doctor or Nurse, Fresh Graduate; Medical Admin (verifier)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-AUTH-01 · FR-AUTH-02 · SRS §2.3 (Nurse Profile State Machine) · SRS §8 APIs `POST /api/v1/auth/nurse-onboarding`, `PATCH /api/v1/admin/nurses/:id/verify`

---

## 💡 Real-World Context & Problem Statement

1. **Registration does not equal permission to practise on the platform:** Nurses are independent marketplace participants, not hospital employees, and nobody issues their accounts for them. A self-registered nurse uploads eKYC and credentials, but the profile stays in `PENDING_VERIFICATION` until an Admin has reviewed the documents and assigned a tier.
2. **The tier decides which services may be unlocked:** Under Luật Khám bệnh, chữa bệnh 2023, invasive services may only be opened to TIER_2_SPECIALIST nurses holding a valid GPHN (practice licence) within its scope. A degree alone qualifies a nurse for TIER_1_BASIC (non-invasive care only); a retirement decision is supporting evidence of seniority — a badge on the profile — and never substitutes for a GPHN.

---

## 📖 User Story Statement

> As a **Nurse (retired medical staff or fresh graduate)**,  
> I want to register on the Nurse Web Portal or Mobile App with my phone + OTP, submit eKYC and professional credentials, and have my account activated with the correct tier after Admin verification,  
> So that I can start accepting exactly the jobs my verified qualifications allow — no more, no less.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Self-Service Onboarding with eKYC & Credentials
- **Given** a nurse registering on the Nurse Web Portal or Mobile App,
- **When** they submit phone number (OTP), CCCD (both sides), a live portrait photo, their nursing/medical degree, GPHN details if any (number, issue date, expiry date, issuing authority, scope of practice) and an optional retirement decision,
- **Then** the profile is stored in `PENDING_VERIFICATION` and job-acceptance features remain locked until Admin review (FR-AUTH-01).

### AC-02: Admin Verification & Tier Assignment
- **Given** a profile in `PENDING_VERIFICATION`,
- **When** an Admin reviews the credentials on the Admin Portal,
- **Then** the verdict is recorded with `reviewed_by` pointing to the reviewing Admin, and the profile transitions to ACTIVE with tier TIER_1_BASIC (valid degree, no valid GPHN) or TIER_2_SPECIALIST (valid GPHN within scope) per FR-AUTH-02.

### AC-03: Retirement Decision Is a Badge, Never a Licence
- **Given** an applicant who uploads only a retirement decision and no valid GPHN,
- **When** Admin verification completes,
- **Then** the nurse is assigned TIER_1_BASIC only, with the "experienced retired medical staff" badge shown on the profile; no invasive service is unlocked (SRS §10 TC-AUTH-01).

### AC-04: Unverified or Wrong-Tier Nurses Are Excluded from Matching
- **Given** a nurse profile that is not ACTIVE, or a TIER_1_BASIC nurse,
- **When** the matching engine or Job Board evaluates candidates for a booking,
- **Then** the nurse is excluded from all jobs while not ACTIVE, and excluded from any service with `is_invasive = true` while TIER_1_BASIC (API returns HTTP 403 on a direct claim attempt); `nurse_profiles.profile_status` is the single source of truth for job-acceptance rights.

### AC-05: Automatic Tier Demotion & Restoration on GPHN Expiry
- **Given** an ACTIVE TIER_2_SPECIALIST nurse whose GPHN expires before renewal,
- **When** the daily GPHN-expiry check runs,
- **Then** the nurse is automatically demoted to TIER_1_BASIC (profile stays ACTIVE for basic jobs; invasive bookings already CONFIRMED with a service date after the expiry date are auto-cancelled without penalty and re-dispatched); after the nurse uploads a new GPHN (`PUT /api/v1/nurse/credentials/gphn`) and an Admin approves it, the tier is automatically restored to TIER_2_SPECIALIST (FR-AUTH-02, SRS §2.3).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-AUTH-01` (SRS §10) | Retirement decision only, no valid GPHN | Functional / Compliance | Nurse assigned TIER_1_BASIC only; no invasive services unlocked |
| `TC-AUTH-02` (SRS §10) | GPHN expiry, then renewal via Nurse Web/App + Admin approval | Functional | Automatic demotion to TIER_1_BASIC on expiry; automatic restoration to TIER_2_SPECIALIST after approved renewal |
| `TC-AUTH-03` (SRS §10) | TIER_1_BASIC nurse calls the claim API for an invasive job | Security / AuthZ | HTTP 403 Forbidden |
| `TC-DB-01` (SRS §10) | Credential review audit | Data / Compliance | `nurse_credentials.reviewed_by` references the Admin's `users.id`; `profile_status` is the only field used to decide job-acceptance rights |
| `TC-USHP04-01` | Job search while `PENDING_VERIFICATION` | Functional | Nurse cannot claim or be matched to any job until ACTIVE |
