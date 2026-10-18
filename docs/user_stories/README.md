# Home-Care Nursing Platform — User Stories Specification (Must Group)

> **Specification Baseline:** `use_case_v8.1.drawio` (140 UCs, BR-01–BR-23) + `luong_hoat_dong_v8.14.drawio` (17 Activity Flows)  
> **Pilot Scope (Decision Q-23):** Single hospital, advance booking only, online gateway payments only, rule-based symptom screening with clinical review, SOS escalation within 5 minutes (no auto-115 dialing).  
> **Status:** Baseline Frozen (Release 1 — Pilot Q-23)  
> **Original Vietnamese Baseline:** Preserved in [`archive/user-stories-day-du-nhom-must-theo-baseline-v8.1-8.14.vi.md`](archive/user-stories-day-du-nhom-must-theo-baseline-v8.1-8.14.vi.md)

---

## 1. Directory Structure

All 27 "Must" User Stories have been modularized into domain-specific Epic folders with standardized identifiers, problem context, user story statements, acceptance criteria (Given/When/Then), and test case traceability matrices:

```
docs/User_Stories/
├── README.md                                                 # Master Catalog & Traceability Matrix (this file)
├── archive/
│   └── user-stories-day-du-nhom-must-theo-baseline-v8.1-8.14.vi.md   # Archived original Vietnamese specification
├── epic-a-account-and-access/
│   ├── US-HP-01-patient-email-registration-signin.md
│   ├── US-HP-02-relative-email-consent.md
│   ├── US-HP-03-consent-withdrawal-terms.md
│   ├── US-HP-04-staff-activation-professional-confirmation.md
│   └── US-HP-05-staff-mandatory-2fa-signin.md
├── epic-b-patient-profile-and-screening/
│   ├── US-HP-06-patient-profile-creation.md
│   └── US-HP-07-symptom-screening-classification.md
├── epic-c-booking-and-nurse-matching/
│   ├── US-HP-09-advance-booking.md
│   ├── US-HP-10-automated-nurse-matching.md
│   ├── US-HP-11-rematching-on-nurse-cancellation.md
│   ├── US-HP-12-pre-session-reminder-symptom-update.md
│   └── US-HP-13-patient-initiated-cancellation.md
├── epic-d-deposit-payment-and-refund/
│   ├── US-HP-14-deposit-payment-gateway.md
│   └── US-HP-15-outstanding-balance-pending-payment.md
├── epic-e-home-care-visit-execution/
│   ├── US-HP-18-nurse-pre-session-briefing.md
│   ├── US-HP-19-in-app-code-check-in.md
│   ├── US-HP-20-initial-patient-assessment.md
│   ├── US-HP-22-mandatory-care-report.md
│   ├── US-HP-23-in-session-add-on-items.md
│   ├── US-HP-24-unsafe-environment-session-stop.md
│   └── US-HP-25-minimum-visit-fee-patient-impediment.md
├── epic-f-emergency-sos-and-safety/
│   ├── US-HP-26-patient-sos-signal.md
│   └── US-HP-27-hospital-sos-reception-and-closure.md
├── epic-g-hospital-administration/
│   ├── US-HP-28-fee-dispute-handling-f1a-f1b.md
│   └── US-HP-29-violation-recording-staff-suspension.md
├── epic-h-saas-platform-administration/
│   └── US-HP-34-platform-admin-dispute-escalation.md
└── epic-i-notifications-and-lookup/
    └── US-HP-36-event-driven-notifications.md
```

---

## 2. Master Traceability Matrix (27 Must Stories)

| Story ID | Story Title & Link | Bounded Context | Primary Persona | Traceability (UC / BR / Flow) | Decision / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **US-HP-01** | [Email-Only Registration & Sign-In for Patients](epic-a-account-and-access/US-HP-01-patient-email-registration-signin.md) | `Identity & Consent` | Patient, Family Member | UC1, UC14, UC61, UC82, UC83 · BR-20 · Flow 01 | Q-51 (Email only, no phone/CCCD) |
| **US-HP-02** | [Relative Consent via Email Link](epic-a-account-and-access/US-HP-02-relative-email-consent.md) | `Identity & Consent` | Family Member / Legal Rep | UC2, UC4 · BR-17 · Flows 02, 04 | No proxy consent by dispatcher |
| **US-HP-03** | [Consent Withdrawal & New-Terms Consent](epic-a-account-and-access/US-HP-03-consent-withdrawal-terms.md) | `Identity & Consent` | Account Owner | UC106, UC138 · Q-47 · Flows 02, 03 | Mandatory re-consent on terms update |
| **US-HP-04** | [Two-Step Staff Activation & Professional Confirmation](epic-a-account-and-access/US-HP-04-staff-activation-professional-confirmation.md) | `Identity & Consent`, `Hospital Operations` | Nurse, Doctor | UC139 · BR-21 · Q-50 · Flow 01 | Unconfirmed staff excluded from dispatch |
| **US-HP-05** | [Mandatory Two-Factor Sign-In for Staff](epic-a-account-and-access/US-HP-05-staff-mandatory-2fa-signin.md) | `Identity & Consent` | Staff (Nurse, Doctor, Admin) | BR-20, BR-21 · Flow 01 | 2FA mandatory for staff; patients exempt |
| **US-HP-06** | [Patient Profile Creation](epic-b-patient-profile-and-screening/US-HP-06-patient-profile-creation.md) | `Patient Profile & Screening` | Patient, Account Owner | UC6, UC11 · BR-17 · Flow 02 | No CCCD; reusable across bookings |
| **US-HP-07** | [Symptom Entry & Four-Group Classification](epic-b-patient-profile-and-screening/US-HP-07-symptom-screening-classification.md) | `Patient Profile & Screening` | Patient | UC21, UC22 · BR-15 · Flow 04 | Emergency group blocks routine booking |
| **US-HP-09** | [Advance Booking](epic-c-booking-and-nurse-matching/US-HP-09-advance-booking.md) | `Booking & Matching` | Patient | BR-03, BR-04 · Flow 04 | 17:00–21:30 operating hours only |
| **US-HP-10** | [Automatic Nurse Matching](epic-c-booking-and-nurse-matching/US-HP-10-automated-nurse-matching.md) | `Booking & Matching` | Patient, Nurse | BR-05, BR-21 · Flow 05 | Filters by qualification & availability |
| **US-HP-11** | [New Matching Round After Nurse Cancellation During Deposit Wait](epic-c-booking-and-nurse-matching/US-HP-11-rematching-on-nurse-cancellation.md) | `Booking & Matching` | Patient, Dispatcher | BR-06 · Flow 05 | Automatic secondary round & timer reset |
| **US-HP-12** | [Pre-Session Reminder & Optional Symptom Update](epic-c-booking-and-nurse-matching/US-HP-12-pre-session-reminder-symptom-update.md) | `Booking & Matching`, `Patient Profile & Screening` | Patient | UC119 · BR-15 · Flow 06 | Optional; never blocks care session |
| **US-HP-13** | [Patient-Initiated Cancellation with Transparent Refund Rule](epic-c-booking-and-nurse-matching/US-HP-13-patient-initiated-cancellation.md) | `Booking & Matching`, `Payment & Deposit` | Patient | UC14 · BR-07, BR-18 F2 · Flow 06 | Time-tiered refund calculation |
| **US-HP-14** | [30% Deposit via Hospital Payment Gateway](epic-d-deposit-payment-and-refund/US-HP-14-deposit-payment-gateway.md) | `Payment & Deposit` | Patient | UC15, UC16 · BR-04 · Flow 04 | Min 50,000 VND floor; no cash |
| **US-HP-15** | [Outstanding Balance & 24h "Chờ thanh toán" State](epic-d-deposit-payment-and-refund/US-HP-15-outstanding-balance-pending-payment.md) | `Payment & Deposit` | Patient, Hospital Admin | UC17 · BR-10, BR-18 · Flow 10 | 24h settlement window before debt follow-up |
| **US-HP-18** | [Nurse Pre-Session Briefing](epic-e-home-care-visit-execution/US-HP-18-nurse-pre-session-briefing.md) | `Care Session` | Nurse | UC31, UC32 · BR-08 · Flow 07 | Accessible only to assigned nurse |
| **US-HP-19** | [In-App Code Check-In at Patient's Home](epic-e-home-care-visit-execution/US-HP-19-in-app-code-check-in.md) | `Care Session` | Nurse, Patient | UC33 · BR-09, BR-20 · Flow 07A | Dynamic in-app code (not email OTP) |
| **US-HP-20** | [Mandatory Initial Assessment by Service-Type Form](epic-e-home-care-visit-execution/US-HP-20-initial-patient-assessment.md) | `Care Session` | Nurse | UC34 · BR-09 · Flow 07A | Prerequisite before clinical execution |
| **US-HP-22** | [Mandatory Post-Session Care Report](epic-e-home-care-visit-execution/US-HP-22-mandatory-care-report.md) | `Care Session` | Nurse | UC36 · BR-22 · Flow 07A | Mandatory even if no initial symptoms |
| **US-HP-23** | [In-Session Add-On Lines with Patient Confirmation](epic-e-home-care-visit-execution/US-HP-23-in-session-add-on-items.md) | `Care Session`, `Payment & Deposit` | Nurse, Patient | UC35 · BR-10 · Flow 07A | Items require patient confirmation |
| **US-HP-24** | [Unsafe-Environment Session Stop Declaration](epic-e-home-care-visit-execution/US-HP-24-unsafe-environment-session-stop.md) | `Care Session`, `Hospital Operations` | Nurse | UC37 · BR-11 · Flow 07A | Immediate stop & fee freeze |
| **US-HP-25** | [Minimum Home-Visit Fee When Service Cannot Be Performed Due to Patient](epic-e-home-care-visit-execution/US-HP-25-minimum-visit-fee-patient-impediment.md) | `Care Session`, `Payment & Deposit` | Nurse, Hospital Admin | UC38 · BR-12, BR-18 F3 · Flow 07A | Pending Decision Q-03 (rate/structure) |
| **US-HP-26** | [Patient/Relative SOS Signal](epic-f-emergency-sos-and-safety/US-HP-26-patient-sos-signal.md) | `Safety & SOS` | Patient, Family Member | UC140 · BR-23 · Q-48 · Flow 17 | 5-min escalation; no auto-115 in MVP |
| **US-HP-27** | [On-Duty Hospital Contact Acknowledges & Closes SOS Incident](epic-f-emergency-sos-and-safety/US-HP-27-hospital-sos-reception-and-closure.md) | `Safety & SOS`, `Hospital Operations` | On-Duty Physician, Admin | UC140 · BR-23, Q-48 · Flow 17 | Acknowledge in 5 min; resolution mandatory |
| **US-HP-28** | [Fee-Line Complaint Handling — F1a/F1b Branches](epic-g-hospital-administration/US-HP-28-fee-dispute-handling-f1a-f1b.md) | `Hospital Operations`, `Payment & Deposit` | Hospital Admin | BR-18 F1a/F1b · Q-44 · Flows 08, 12 | F1a 5-day auto-waiver; F1b UC90 voucher |
| **US-HP-29** | [Violation Recording, Adjudication & Staff Lock/Unlock](epic-g-hospital-administration/US-HP-29-violation-recording-staff-suspension.md) | `Hospital Operations` | Hospital Admin | BR-01, BR-02 · Q-43 · BR-18 F6 · Flow 12 | 24h auto-unlock if unconfirmed; sliding window |
| **US-HP-34** | [Platform Admin Decision on Escalated F1b Complaints](epic-h-saas-platform-administration/US-HP-34-platform-admin-dispute-escalation.md) | `Platform Administration`, `Payment & Deposit` | SaaS Platform Admin | BR-18 F1b · Q-44 | 3-business-day arbitration SLA |
| **US-HP-36** | [Event-Driven Notifications via Email & In-App](epic-i-notifications-and-lookup/US-HP-36-event-driven-notifications.md) | `Notification` | All System Roles | UC119 · BR-20 · Flows 04–15, 17 | Zero SMS policy; real-time in-app for SOS |

---

## 3. Persona Mapping & Responsibility Matrix

| Persona | Applicable User Stories | Core Responsibilities |
| :--- | :--- | :--- |
| **Patient** | US-HP-01, 06, 07, 09, 10, 11, 12, 13, 14, 15, 19, 23, 26, 36 | Registration, profile management, booking, screening, deposit, check-in, confirmation, payment, SOS |
| **Family Member / Legal Representative** | US-HP-01, 02, 03, 06, 26, 36 | Proxy consent, legal representation attestation, visit booking assistance, emergency SOS |
| **Nurse** | US-HP-04, 05, 10, 18, 19, 20, 22, 23, 24, 25, 36 | Two-step activation, 2FA sign-in, shift acceptance, check-in, clinical assessment, care report, safety abort |
| **On-Duty Physician** | US-HP-04, 05, 27, 36 | Shift credentialing, high-risk screening review, emergency SOS triage & incident closure |
| **Hospital Administrator / Dispatcher** | US-HP-04, 05, 11, 15, 25, 27, 28, 29, 36 | Staff credential confirmation, manual dispatch intervention, dispute adjudication, violation management |
| **SaaS Platform Admin** | US-HP-34, 36 | Tenant management, cross-tenant financial arbitration, escalated F1b dispute ruling |

---

## 4. Note on "Should" Group User Stories

Ten additional secondary stories designated as **Should** in the original baseline proposals (`US-HP-08`, `16`, `17`, `21`, `30`, `31`, `32`, `33`, `35`, `37`) remain in outline status. When prioritized for upcoming releases, they will be specified using this exact full format without altering any existing story identifiers.

---

## 5. Specification Precedence Rule

When code and design documentation disagree, **the design documents and business rules win** until officially amended and versioned:
1. `use_case_v8.1.drawio` (140 UCs, BR-01–BR-23)
2. `luong_hoat_dong_v8.14.drawio` (Activity flows & decision registers)
3. User Stories Specification (this documentation suite)
