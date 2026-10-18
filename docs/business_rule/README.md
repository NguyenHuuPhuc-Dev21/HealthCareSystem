# Home-Care Nursing Platform — Business Rules Specification

> **Specification Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio` (17 Activity Flows) — Synchronized Baseline Frozen  
> **Scope:** Full 23 Business Rules (`BR-01`–`BR-23`), Overdue Financial Adjudication Table (`BR-18 F1a–F9`), and Supplementary Activity Flow Rules (`R-L03`, `R-UC135`).  
> **Status:** Baseline Frozen (Release 1 — Pilot Q-23)  
> **Original Vietnamese Baseline:** Preserved in [`archive/business-rules-theo-baseline-v8.1-8.14.vi.md`](archive/business-rules-theo-baseline-v8.1-8.14.vi.md)

---

## 1. Overarching Architectural Principles

All 23 business rules adhere strictly to five non-negotiable architectural axioms:

1. **The SaaS Platform Never Holds Funds:** Hospitals contract directly with licensed payment gateway providers and hold the merchant accounts. Funds flow directly into hospital accounts (`BR-05`).
2. **Expired Financial Decisions Consult BR-18 Exclusively:** Any automated financial decision triggered by an administrative SLA timeout must lookup Table `BR-18` (Rules `F1a` through `F9`). No workflow or codebase may invent arbitrary financial fallbacks.
3. **Immutable Audit Trails for Financial Decisions:** Every automated resolution must record the applied Rule Code (`Fx`), timestamp, and justification. Financial modifications must be recorded as **new accounting ledger entries**, never by modifying existing numbers in place.
4. **Effective-Dated Configurations:** Every business parameter (fees, percentages, cancellation windows, alert thresholds) is configurable per hospital tenant with an effective date. Configuration updates preserve complete historical audit trails.
5. **Separation of Technical Constraints vs. Labor Discipline:** The platform applies technical access locks and statistics only. Monetary deductions and employment sanctions remain strictly within hospital administrative authority. The platform **never levies monetary fines directly on nurses** (`BR-01`, `BR-02`).

---

## 2. Directory Layout & Group Decomposition

The business rules are partitioned into seven modular domain groups:

```
docs/business_rule/
├── README.md                                                 # Master Catalog, Principles & Traceability (this file)
├── open-decisions-register.md                               # Open Decisions Register (Q-01 — Q-51)
├── archive/
│   └── business-rules-theo-baseline-v8.1-8.14.vi.md          # Archived original Vietnamese baseline
├── group-a-identity-access-and-data/                         # Identity, Auth, Privacy & Consent
│   ├── README.md
│   ├── BR-20-email-only-identity-and-communication.md
│   ├── BR-21-two-step-staff-credentialing.md
│   ├── BR-09-backend-data-authorization.md
│   ├── BR-17-consent-lifecycle-and-withdrawal.md
│   └── BR-12-data-retention-and-erasure.md
├── group-b-booking-and-dispatch/                             # Scheduling, Radius, Quotas & Matching
│   ├── README.md
│   ├── BR-03-operating-hours-and-slot-windows.md
│   ├── BR-06-geographic-service-radius.md
│   ├── BR-14-booking-prerequisites-and-debt-blocks.md
│   ├── BR-13-advance-booking-and-rescheduling.md
│   ├── BR-08-fast-match-engine.md
│   └── BR-01-auto-assignment-and-minor-infractions.md
├── group-c-care-visit-execution/                             # Field Check-in, Orders, Reporting & Abort
│   ├── README.md
│   ├── BR-07-departure-geofenced-checkin-and-abandonment.md
│   ├── BR-15-medical-orders-and-in-session-addons.md
│   ├── BR-22-mandatory-clinical-care-report.md
│   └── BR-16-mid-session-abort-and-partial-billing.md
├── group-d-payments-and-reconciliation/                      # Deposits, Gateway, Commission & Table F
│   ├── README.md
│   ├── BR-04-deposits-settlement-and-refund-schedule.md
│   ├── BR-05-platform-commission-and-cash-handling.md
│   └── BR-18-overdue-financial-adjudication-matrix.md
├── group-e-violations-disputes-and-safety/                   # Sanctions, Complaints, Abuse & SOS
│   ├── README.md
│   ├── BR-02-shift-cancellation-and-major-infractions.md
│   ├── BR-11-complaints-disputes-and-incidents.md
│   ├── BR-19-patient-abuse-flagging.md
│   └── BR-23-emergency-sos-and-incident-response.md
├── group-f-symptom-screening-and-ai/                         # Triage Rules & AI Guardrails
│   ├── README.md
│   └── BR-10-symptom-screening-and-ai-guardrails.md
└── group-g-supplementary-flow-rules/                         # Active Rules from Activity Flows
    ├── README.md
    ├── R-L03-account-lockout-policy.md
    └── R-UC135-call-center-proxy-booking.md
```

---

## 3. Master Business Rules Traceability Catalog

| Rule ID | Rule Title & Link | Group | Key Focus & Enforcement | Governing UCs & Flows | Governing Decisions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BR-01** | [Auto-Assignment & Minor Infractions](group-b-booking-and-dispatch/BR-01-auto-assignment-and-minor-infractions.md) | Group B | No-reject rule for idle nurses; 5-min SLA; 3-strike minor violation counter; zero fines. | UC31–UC33, UC115 · Flows 05, 06 | Q-05, Q-29, Q-41, Q-45 |
| **BR-02** | [Shift Cancellation & Major Infractions](group-e-violations-disputes-and-safety/BR-02-shift-cancellation-and-major-infractions.md) | Group E | Lead-time penalties; 24h auto-unlock for unconfirmed abandonment; 3-strike escalation. | UC72, UC77–UC79, UC88, UC116 · Flow 06 | Q-37, Q-43 |
| **BR-03** | [Operating Hours & Service Windows](group-b-booking-and-dispatch/BR-03-operating-hours-and-slot-windows.md) | Group B | Weekdays 17:00–21:30, Weekends 07:00–21:30; latest start = 21:30 − duration. | UC9, UC19, UC24, UC109 · Flows 04, 05 | Q-22 |
| **BR-04** | [Deposits, Settlement & Refund Schedule](group-d-payments-and-reconciliation/BR-04-deposits-settlement-and-refund-schedule.md) | Group D | 30% online deposit (min 50k); 24h pending payment; time-tiered cancellation refunds. | UC34, UC36, UC45, UC90, UC91, UC121–UC126 · Flows 07B, 08, 09 | Q-03, Q-09, Q-11, Q-30, Q-31, Q-33, Q-38 |
| **BR-05** | [Platform Commission & Cash Handling](group-d-payments-and-reconciliation/BR-05-platform-commission-and-cash-handling.md) | Group D | Non-custodial fund flow; 48h field cash remittance; monthly commission reconciliation. | UC46–UC48, UC95, UC110, UC111, UC124, UC125 · Flows 10, 11 | Non-custodial |
| **BR-06** | [Geographic Service Radius](group-b-booking-and-dispatch/BR-06-geographic-service-radius.md) | Group B | 15 km / 45 min travel radius; location over domicile; no provincial boundaries. | UC27, UC108 · Flows 04, 05 | Geographic |
| **BR-07** | [Departure, Geofenced Check-In & Abandonment](group-c-care-visit-execution/BR-07-departure-geofenced-checkin-and-abandonment.md) | Group C | Departure deadlines; geofence + in-app dynamic code; 24h auto-unlock on "Bom ca". | UC38, UC40, UC77, UC89 · Flows 06, 07A, 07B | Q-43 |
| **BR-08** | [Fast Match Engine](group-b-booking-and-dispatch/BR-08-fast-match-engine.md) | Group B | Hard filters + priority ranking; 15-minute matching window (Non-pilot feature). | UC24, UC25, UC30–UC33, UC37, UC85, UC87 · Flow 05 | Fast matching |
| **BR-09** | [Backend Data Authorization](group-a-identity-access-and-data/BR-09-backend-data-authorization.md) | Group A | 4-pillar backend RBAC/ABAC query checks; no cross-hospital sharing; zero default PHI for Admin. | UC16, UC17, UC58, UC59, UC102 · All Flows | Q-20 |
| **BR-10** | [Symptom Screening & AI Guardrails](group-f-symptom-screening-and-ai/BR-10-symptom-screening-and-ai-guardrails.md) | Group F | Deterministic 4-tier triage; physician review fallback; strict AI medical prohibitions. | UC20–UC23, UC54, UC68, UC119 · Flows 04, 07A, 13 | Q-21, Q-26 |
| **BR-11** | [Complaints, Disputes & Incidents](group-e-violations-disputes-and-safety/BR-11-complaints-disputes-and-incidents.md) | Group E | 30-day filing SLA; 3-day hospital review; independent rotational appeals; emergency incidents. | UC51–UC53, UC98–UC101, UC134 · Flow 12 | Q-17, Q-24, Q-32 |
| **BR-12** | [Data Retention & Erasure](group-a-identity-access-and-data/BR-12-data-retention-and-erasure.md) | Group A | 72h erasure SLA; statutory clinical/financial retention locks; relative email links. | UC61–UC65, UC104–UC106 · Flow 14 | Q-14, Q-34 |
| **BR-13** | [Advance Booking & Rescheduling](group-b-booking-and-dispatch/BR-13-advance-booking-and-rescheduling.md) | Group B | 2h–14d horizon; daily shift caps; T-24h/T-3h/T-2h reminders; nurse reassignment flow. | UC37, UC45, UC78, UC88, UC112–UC120, UC133 · Flows 04, 06, 09 | Q-19, Q-22 |
| **BR-14** | [Booking Prerequisites & Debt Blocks](group-b-booking-and-dispatch/BR-14-booking-prerequisites-and-debt-blocks.md) | Group B | Unpaid invoice > 24h (`Cong_no`) blocks all bookings; max 3 active visits per profile. | UC18, UC19, UC120 · Flows 04, 05, 09 | Debt block |
| **BR-15** | [Medical Orders & In-Session Add-Ons](group-c-care-visit-execution/BR-15-medical-orders-and-in-session-addons.md) | Group C | Prescription upload & 30-min doctor verification; Tier A/B/C in-session add-ons. | UC18, UC91, UC136, UC137, UC140 · Flows 04, 07C | Q-13 |
| **BR-16** | [Mid-Session Abort & Partial Billing](group-c-care-visit-execution/BR-16-mid-session-abort-and-partial-billing.md) | Group C | Clinical/safety abort conditions; partial billing breakdown; linked child orders. | UC41, UC43, UC92, UC127, UC128 · Flows 15, 06, 08 | Q-08, Q-35, Q-36, Q-40, Q-46 |
| **BR-17** | [Consent Lifecycle & Withdrawal](group-a-identity-access-and-data/BR-17-consent-lifecycle-and-withdrawal.md) | Group A | Independent consent per profile; relative email consent; revocation & re-consent rules. | UC2, UC4, UC106, UC129, UC138 · Flows 02, 03, 14 | Q-15, Q-47 |
| **BR-18** | [Overdue Financial Adjudication (Table F)](group-d-payments-and-reconciliation/BR-18-overdue-financial-adjudication-matrix.md) | Group D | Master fallback table F1a through F9 for expired administrative actions; cost bearer mapping. | UC36, UC53, UC90, UC100 · Flows 06, 08, 09, 11, 12, 15 | Q-10, Q-12, Q-44 |
| **BR-19** | [Patient Abuse Flagging](group-e-violations-disputes-and-safety/BR-19-patient-abuse-flagging.md) | Group E | 90-day rolling window score; modifies timeout fallbacks under BR-18; never blocks care. | UC36, UC51, UC93 · Flows 08, 09, 12 | Q-42 |
| **BR-20** | [Email-Only Identity & Communication](group-a-identity-access-and-data/BR-20-email-only-identity-and-communication.md) | Group A | Email-only auth; mandatory 2FA for staff; zero SMS/CCCD; in-app dynamic check-in codes. | UC1, UC14, UC40, UC61, UC82, UC83, UC106, UC133 · Flows 02, 03 | Q-51 |
| **BR-21** | [Two-Step Staff Credentialing](group-a-identity-access-and-data/BR-21-two-step-staff-credentialing.md) | Group A | Hospital clinical verification + platform admin review; CCHN daily expiry scanning. | UC5–UC8, UC10–UC12, UC69, UC81, UC139 · Flow 01 | Q-50 |
| **BR-22** | [Mandatory Clinical Care Report](group-c-care-visit-execution/BR-22-mandatory-clinical-care-report.md) | Group C | Universal mandatory post-visit report; 2h/24h timeout suspension; service-specific schemas. | UC41–UC44, UC127 · Flows 07B, 15 | Q-49 |
| **BR-23** | [Emergency SOS & Incident Response](group-e-violations-disputes-and-safety/BR-23-emergency-sos-and-incident-response.md) | Group E | Unilateral patient/nurse SOS triggers; 5-min hospital response SLA; zero auto-115 calls. | UC20, UC92, UC134, UC140 · Flows 15, 17 | Q-48 |
| **R-L03** | [Account Lockout Policy](group-g-supplementary-flow-rules/R-L03-account-lockout-policy.md) | Group G | Shared counter for password + 2FA (5 failed attempts $ightarrow$ 15-minute lockout). | UC15 · Flow 03 | Security |
| **R-UC135**| [Call Center Proxy Booking](group-g-supplementary-flow-rules/R-UC135-call-center-proxy-booking.md) | Group G | Dispatcher proxy booking with mandatory direct patient email consent & gateway deposit. | UC135 · Flow Page 00c | Inclusivity |

---

## 4. Precedence of Documentation

When code implementation and business specifications diverge, **the design documents and business rules win**:
1. `use_case_v8.1.drawio` (140 UCs, BR-01–BR-23)
2. `luong_hoat_dong_v8.14.drawio` (17 Activity Flows, Decision Register Q-01–Q-51)
3. Business Rules Documentation (this suite)
4. Source Code Implementation
