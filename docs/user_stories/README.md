# HealthCareSystem — User Stories Specification

> **Governing Baseline:** SRS HealthCareSystem On-Demand Nursing — **Version 2.0 (Updated, 28/10/2026)**  
> **Model:** A marketplace connecting Patients/Families with retired doctors & nurses and fresh medical/nursing graduates. There are no hospital tenants; nurses are independent participants, and the platform is the connector and escrow/settlement operator.  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version (use_case_v8.1 / luong_hoat_dong_v8.14, BR-01–BR-23), which is retained for history in `archive/` only and must not be used for development.  
> **Key model anchors:** Phone + OTP sign-in for all users (Admin Portal adds mandatory 2FA) · Customer eKYC (CCCD) required for private-home care · Nurse tiers TIER_1_BASIC / TIER_2_SPECIALIST gated by a valid GPHN · Two matching mechanisms (Radar dispatch / Job Board) + direct nurse selection · Payment per booking: 100% prepaid bank transfer into escrow, or cash at shift end with the nurse self-paying the 15% commission within 24h · Nurse deposit wallet 300,000 VND upfront, used only for SLA penalties · Cancellation/refunds per the SRS §5.2 SLA matrix · 3-axis booking state machine (execution / payment / dispute).

---

## 1. Directory Structure

User Stories are modularized into domain-specific Epic folders with standardized identifiers, problem context, user story statements, acceptance criteria (Given/When/Then), and test case traceability to the SRS §10 RTM:

```
docs/user_stories/
├── README.md                                  # Master Catalog & Traceability Matrix (this file)
├── archive/                                   # Superseded hospital-baseline specifications (historical only)
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

> File names and US-HP codes are kept unchanged from the previous baseline for repository continuity; story **titles and content** follow SRS v2.0.

---

## 2. Master Traceability Matrix

Traceability references SRS v2.0 functional requirements (FR) and, where applicable, the SRS §10 RTM test-case IDs — replacing the previous UC/BR traceability.

| Story ID | Story Title & Link | Bounded Context | Primary Persona | Traceability (SRS v2.0) | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **US-HP-01** | [Customer Registration & Sign-In with Phone Number + OTP](epic-a-account-and-access/US-HP-01-patient-email-registration-signin.md) | `Identity & Consent` | Customer | FR-AUTH-03 · APIs request-otp / verify-otp | Phone + OTP for all users; no email channel |
| **US-HP-02** | [A Relative Books Care for a Patient](epic-a-account-and-access/US-HP-02-relative-email-consent.md) | `Identity & Consent` | Family Member | FR-AUTH-03 · FR-PRIV-01 · TC-PRIV-01 | Care-recipient profile + recorded consent to share records with the assigned nurse |
| **US-HP-03** | [Customer Withdraws Consent / Requests Data Handling per Nghị định 13/2023](epic-a-account-and-access/US-HP-03-consent-withdrawal-terms.md) | `Identity & Consent` | Customer | FR-PRIV-01 · RISK-03 | Record access closes 12h after check-out; deletion/anonymization supported |
| **US-HP-04** | [Nurse Account Activation After eKYC + Tier Assignment by Admin](epic-a-account-and-access/US-HP-04-staff-activation-professional-confirmation.md) | `Identity & Consent` | Nurse; Medical Admin | FR-AUTH-01 · FR-AUTH-02 · TC-AUTH-01/02/03 | Retirement decision = badge only; GPHN expiry auto-demotes tier |
| **US-HP-05** | [Admin Portal Sign-In with Mandatory 2FA](epic-a-account-and-access/US-HP-05-staff-mandatory-2fa-signin.md) | `Identity & Consent` | Medical Admin / Operator | SRS §2.1 · FR-ADMIN-01 | 2FA mandatory for Admin only — not for nurses/customers |
| **US-HP-06** | [Customer Creates Care-Recipient Profiles](epic-b-patient-profile-and-screening/US-HP-06-patient-profile-creation.md) | `Patient Profile` | Customer | FR-AUTH-03 · FR-PRIV-01 · TC-KYC-01 | Customer eKYC mandatory for private-home care |
| **US-HP-07** | [Customer Declares the Care Recipient's Condition at Booking](epic-b-patient-profile-and-screening/US-HP-07-symptom-screening-classification.md) | `Patient Profile` | Customer; Nurse | FR-AUTH-03 · FR-SHIFT-02 | **No AI/rule-based classification exists in SRS v2.0**; mismatches are reported by the nurse on site |
| **US-HP-09** | [Customer Books a Shift/Task in Advance](epic-c-booking-and-nurse-matching/US-HP-09-advance-booking.md) | `Booking & Matching` | Customer | FR-BOOK-01 · FR-BOOK-02 · TC-PRICE-01 · TC-BOOK-01 | Invasive services: doctor's-order image + Admin review (PENDING_ADMIN_REVIEW) |
| **US-HP-10** | [Matching via Radar Push Waves + Job Board](epic-c-booking-and-nurse-matching/US-HP-10-automated-nurse-matching.md) | `Booking & Matching` | Customer; Nurse | FR-BOOK-03 · FR-SCHED-01 · FR-SEARCH-01 · TC-MATCH-01/02 | Radar ≤ 6h (5 km → 10 km waves); Job Board > 6h; direct selection with 15-min response window |
| **US-HP-11** | [Re-Matching / Refund When the Nurse Cancels](epic-c-booking-and-nurse-matching/US-HP-11-rematching-on-nurse-cancellation.md) | `Booking & Matching` | Customer; Nurse | SRS §5.2 rows 6–8 · TC-CANCEL-01 | Late-cancel penalty funds the Urgent Bonus; no-show ⇒ BANNED + 50,000 VND voucher |
| **US-HP-12** | [Pre-Shift Reminders & Customer Condition-Note Update](epic-c-booking-and-nurse-matching/US-HP-12-pre-session-reminder-symptom-update.md) | `Booking & Matching`, `Patient Profile` | Customer; Nurse | FR-NOTIF-01 · TC-NFR-01 | Push + in-app; SMS fallback for urgent events / 60s no-ACK |
| **US-HP-13** | [Customer Cancels Under the §5.2 Refund Matrix](epic-c-booking-and-nurse-matching/US-HP-13-patient-initiated-cancellation.md) | `Booking & Matching`, `Payment` | Customer | SRS §5.2 rows 1–5 | Includes stop-after-check-in (pay actual work, no penalty) and ICU force majeure |
| **US-HP-14** | [Customer Pays 100% in Advance by Bank Transfer (Escrow) or Chooses Cash](epic-d-deposit-payment-and-refund/US-HP-14-deposit-payment-gateway.md) | `Payment` | Customer | FR-PAY-01 · TC-PAY-01/02 · TC-SETTLE-01 | `payment_method` chosen at booking; webhook HMAC + idempotency |
| **US-HP-15** | [Nurse Pays the 15% Cash-Job Commission via Payment Link Within 24h](epic-d-deposit-payment-and-refund/US-HP-15-outstanding-balance-pending-payment.md) | `Payment` | Nurse | FR-PAY-02 · FR-PAY-03 · TC-SETTLE-02 · TC-WALLET-01 | Overdue commission or deposit below 300,000 VND ⇒ SUSPENDED / locked from new jobs; commission never deducted from the deposit wallet |
| **US-HP-18** | [Nurse Reviews Booking & Medical Information Inside the Access Window Before the Shift](epic-e-home-care-visit-execution/US-HP-18-nurse-pre-session-briefing.md) | `Care Session` | Nurse | — | FR-PRIV-01 |
| **US-HP-19** | [Nurse Checks In with GPS Verification & Live Selfie at the Care Address](epic-e-home-care-visit-execution/US-HP-19-in-app-code-check-in.md) | `Care Session` | Nurse; Customer | — | FR-SHIFT-01 |
| **US-HP-20** | [Nurse Records Initial Vital Signs & Confirms Patient Condition at Shift Start](epic-e-home-care-visit-execution/US-HP-20-initial-patient-assessment.md) | `Care Session` | Nurse | — | FR-SHIFT-02 |
| **US-HP-22** | [Nurse Checks Out & Submits the Mandatory Care Report](epic-e-home-care-visit-execution/US-HP-22-mandatory-care-report.md) | `Care Session` | Nurse | — | FR-SHIFT-04 |
| **US-HP-23** | [Shift Extension — Request, Repricing, Customer Approval & Payment](epic-e-home-care-visit-execution/US-HP-23-in-session-add-on-items.md) | `Care Session`, `Payment` | Nurse; Customer | — | FR-SHIFT-03 |
| **US-HP-24** | [Nurse Stops a Shift for an Unsafe Environment or Condition Mismatch & Reports It](epic-e-home-care-visit-execution/US-HP-24-unsafe-environment-session-stop.md) | `Care Session` | Nurse | — | FR-SHIFT-02 · FR-BOOK-02 · §5.2 |
| **US-HP-25** | [Customer No-Show / On-Site Impediment — Nurse Waits, Reports & Leaves](epic-e-home-care-visit-execution/US-HP-25-minimum-visit-fee-patient-impediment.md) | `Care Session`, `Payment` | Nurse | — | §5.2 (gap flagged in story) |
| **US-HP-26** | [Customer or Nurse Triggers SOS During a Shift](epic-f-emergency-sos-and-safety/US-HP-26-patient-sos-signal.md) | `Safety & SOS` | Customer | — | FR-SHIFT-05 |
| **US-HP-27** | [Admin Receives the SOS Alert With Live Location, Responds & Closes It](epic-f-emergency-sos-and-safety/US-HP-27-hospital-sos-reception-and-closure.md) | `Safety & SOS` | Medical Admin | — | FR-SHIFT-05 |
| **US-HP-28** | [Admin Handles Booking Disputes (FR-DISP-01 Workflow)](epic-g-hospital-administration/US-HP-28-fee-dispute-handling-f1a-f1b.md) | `Administration`, `Payment` | Medical Admin | — | FR-DISP-01 |
| **US-HP-29** | [Admin Records Violations & Applies SLA Sanctions](epic-g-hospital-administration/US-HP-29-violation-recording-staff-suspension.md) | `Administration` | Medical Admin | — | §5.2 · FR-RATE-01 |
| **US-HP-34** | [Admin Adjudicates Escalated Disputes & Audits Decisions](epic-h-saas-platform-administration/US-HP-34-platform-admin-dispute-escalation.md) | `Platform Administration` | Platform Admin | — | FR-DISP-01 · audit_logs |
| **US-HP-36** | [Event-Driven Notifications Across the Booking Lifecycle](epic-i-notifications-and-lookup/US-HP-36-event-driven-notifications.md) | `Notification` | All roles | — | FR-NOTIF-01 |

---

## 3. Persona Mapping & Responsibility Matrix

| Persona | Applicable User Stories | Core Responsibilities |
| :--- | :--- | :--- |
| **Customer (Patient / Family Member)** | US-HP-01, 02, 03, 06, 07, 09, 10, 11, 12, 13, 14 | Phone + OTP sign-in, eKYC, care-recipient profiles & consent, booking, payment (prepaid transfer or cash), cancellation |
| **Nurse Tier 1 (TIER_1_BASIC)** | US-HP-04, 10, 15 | Onboarding with degree (no valid GPHN), non-invasive jobs only, deposit top-up, cash-job commission payment |
| **Nurse Tier 2 (TIER_2_SPECIALIST)** | US-HP-04, 10, 15 | GPHN-verified practice incl. invasive services against a doctor's order, GPHN renewal to restore tier |
| **Medical Admin / Operator** | US-HP-04, 05 | 2FA-protected Admin Portal sign-in, credential verification & tier assignment, platform operations (FR-ADMIN-01) |

---

## 4. Scope Note (MVP vs Phase 2)

Per SRS v2.0 §1.2 and §4.0, the MVP covers task-based and short shift-based booking (4h/8h/12h/24h), both matching mechanisms, both payment methods, the upfront deposit wallet, dual-verification check-in, shift logs, disputes, two-way reviews and Admin operations. Long-term contract booking and lifecycle (FR-BOOK-04, FR-BOOK-05), partial settlement adjudication (FR-DISP-02) and the Elder-Friendly UI for the Patient App are **Phase 2** and are not specified as stories in this catalogue.

---

## 5. Specification Precedence Rule

**SRS HealthCareSystem On-Demand Nursing v2.0 (Updated, 28/10/2026) is the single governing baseline.** Where any story, design document or code disagrees with the SRS, the SRS wins until it is officially amended and re-versioned. The archived hospital-baseline documents (`archive/`, use_case_v8.1, luong_hoat_dong_v8.14, BR-01–BR-23) are historical references only.
