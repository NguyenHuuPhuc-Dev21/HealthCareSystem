# On-Demand Nursing Marketplace — Business Rules Specification

> **Specification Baseline:** SRS HealthCareSystem On-Demand Nursing — **Version 2.0 (Updated, 28/10/2026)**, integrating the 27 review items CT-01–CT-27 and the round-2 review decisions of 28/10/2026  
> **Scope:** Full 23 Business Rules (`BR-01`–`BR-23`), the SLA / Cancellation / Compensation Matrix (SRS §5.2), and Supplementary Activity Flow Rules (`R-L03`, `R-UC135`)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Original Vietnamese Baseline (superseded):** Preserved in [`archive/business-rules-theo-baseline-v8.1-8.14.vi.md`](archive/business-rules-theo-baseline-v8.1-8.14.vi.md)

---

## 1. Overarching Architectural Principles

All 23 business rules adhere strictly to the following principles of the SRS v2.0 marketplace model:

1. **Marketplace, Not Hospital SaaS:** The platform connects Customers (patients / families) with independent care staff — retired doctors/nurses and fresh medical/nursing graduates. There are **no hospital tenants**, no tenant isolation, and no hospital-held merchant accounts.
2. **Two Payment Methods, One Ledger:** Bank-transfer bookings are prepaid 100% into a **Simulated Escrow** (internal ledger + sandbox gateway, FR-PAY-01); cash bookings are paid to the nurse on site, and the nurse **self-remits the 15% platform commission** within 24 hours (FR-PAY-02). All money movements are recorded as **new entries in the immutable wallet ledger** (`wallet_transactions`, with `idempotency_key`) — never by editing balances in place.
3. **Deposit Is for SLA Penalties Only:** The nurse's upfront deposit of **300,000 VNĐ** (`MIN_NURSE_DEPOSIT`) exists solely to deduct SLA penalties. It is **never** used to collect cash-job commission, carries no progressive retention, and imposes no job-value cap (FR-PAY-03).
4. **Hard Tier Gating by GPHN:** Invasive services are open only to `TIER_2_SPECIALIST` nurses with a valid, in-scope **GPHN** (Giấy phép hành nghề, Luật Khám bệnh, chữa bệnh 2023), enforced at the backend (HTTP 403). A retirement decision is an experience badge only. Prohibited services can never be booked (SRS §4.2).
5. **Configuration over Hard-Coding:** Every business number (commission 15%, deposit 300,000 VNĐ, night surcharge +20%, holiday surcharges +300% / +200%, 24h settlement window, 200 m check-in radius, ICU travel support 50,000 VNĐ, no-show penalty 50,000 VNĐ) lives in `system_configs` and can be changed by Admin without code changes (SRS §5.1).
6. **Single Source of Truth for Eligibility:** `nurse_profiles.profile_status` alone decides whether a nurse may accept jobs; booking state is tracked on **three independent axes** (`execution_status`, `payment_status`, `dispute_status`, SRS §2.2).
7. **Privacy by Design (Nghị định 13/2023/NĐ-CP):** Health-data consent precedes every patient profile; nurse record access is windowed (CONFIRMED → check-out +12h); sensitive images are private and served by 10-minute presigned URLs; all sensitive actions are written to the immutable `audit_logs`.

---

## 2. Directory Layout & Group Decomposition

The business rules are partitioned into seven modular domain groups:

```
docs/business_rule/
├── README.md                                                 # Master Catalog, Principles & Traceability (this file)
├── open-decisions-register.md                               # Open items not specified by SRS v2.0
├── archive/
│   └── business-rules-theo-baseline-v8.1-8.14.vi.md          # Archived superseded hospital baseline (Vietnamese)
├── group-a-identity-access-and-data/                         # Identity, Auth, Privacy & Consent
│   ├── README.md
│   ├── BR-20-email-only-identity-and-communication.md        # Phone + OTP Identity (title updated)
│   ├── BR-21-two-step-staff-credentialing.md                 # Nurse Credentialing & GPHN Lifecycle (title updated)
│   ├── BR-09-backend-data-authorization.md
│   ├── BR-17-consent-lifecycle-and-withdrawal.md
│   └── BR-12-data-retention-and-erasure.md
├── group-b-booking-and-dispatch/                             # Scheduling, Radius, Gates & Matching
│   ├── README.md
│   ├── BR-03-operating-hours-and-slot-windows.md             # Booking Windows & Night Hours (title updated)
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
├── group-d-payments-and-reconciliation/                      # Escrow, Cash Commission, Deposit & SLA Matrix
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
├── group-f-symptom-screening-and-ai/                         # Service Safety Screening
│   ├── README.md
│   └── BR-10-symptom-screening-and-ai-guardrails.md
└── group-g-supplementary-flow-rules/                         # Supplementary Rules
    ├── README.md
    ├── R-L03-account-lockout-policy.md
    └── R-UC135-call-center-proxy-booking.md
```

---

## 3. Master Business Rules Traceability Catalog

| Rule ID | Rule Title & Link | Group | Key Focus & Enforcement | SRS v2.0 Reference |
| :--- | :--- | :--- | :--- | :--- |
| **BR-01** | [Matching, Assignment & Minor Infractions](group-b-booking-and-dispatch/BR-01-auto-assignment-and-minor-infractions.md) | Group B | Voluntary first-come claim (Radar / Job Board / direct); TrustScore deductions −5 / −20 / −25, +2 recovery; < 60 → SUSPENDED. | §4.3 FR-BOOK-03 · §4.6 FR-RATE-01 · §5.2 |
| **BR-02** | [Shift Cancellation & Major Infractions](group-e-violations-disputes-and-safety/BR-02-shift-cancellation-and-major-infractions.md) | Group E | SLA cancellation matrix; no-show → BANNED on first offence + 50,000 VNĐ voucher penalty. | §5.2 rows 6–8 · §2.3 |
| **BR-03** | [Booking Windows, Shift Types & Night Hours](group-b-booking-and-dispatch/BR-03-operating-hours-and-slot-windows.md) | Group B | Task-based + 4h/8h/12h/24h shifts; night hours 22:00–06:00 at +20%; 15-min payment hold; 6h urgency split. | §1.2 · §4.3 FR-BOOK-01 / FR-BOOK-03 · §5.1 |
| **BR-04** | [Deposits, Settlement & Refund Schedule](group-d-payments-and-reconciliation/BR-04-deposits-settlement-and-refund-schedule.md) | Group D | 100% escrow prepayment (bank transfer); 24h settlement cooling; §5.2 refund tiers. | §4.5 FR-PAY-01 / FR-PAY-02 · §5.2 |
| **BR-05** | [Platform Commission & Cash Handling](group-d-payments-and-reconciliation/BR-05-platform-commission-and-cash-handling.md) | Group D | 15% commission; cash jobs — nurse self-remits within 24h, never deducted from deposit; anti-leakage (RISK-06). | §4.5 FR-PAY-01 / FR-PAY-02 · §3 RISK-06 |
| **BR-06** | [Geographic Service Radius](group-b-booking-and-dispatch/BR-06-geographic-service-radius.md) | Group B | Radar waves 5 km → 10 km from care location; GPS/PostGIS distance; care location over domicile. | §4.3 FR-BOOK-03 · §9.3 |
| **BR-07** | [Departure, Geofenced Check-In & Abandonment](group-c-care-visit-execution/BR-07-departure-geofenced-checkin-and-abandonment.md) | Group C | GPS + live selfie check-in within 200 m; mock-location blocking; no-show detection. | §4.4 FR-SHIFT-01 · §3 RISK-05 |
| **BR-08** | [Matching Engine — Radar Dispatch & Job Board](group-b-booking-and-dispatch/BR-08-fast-match-engine.md) | Group B | Two separated mechanisms; hard filters (status, tier, deposit, availability); first-come claim with Redis Lock; schedule-conflict exclusion. | §4.3 FR-BOOK-03 · §4.2 FR-SCHED-01 |
| **BR-09** | [Backend Data Authorization](group-a-identity-access-and-data/BR-09-backend-data-authorization.md) | Group A | Role × relationship × lifecycle × tier checks; invasive tier hard-gate (HTTP 403); record window CONFIRMED → check-out +12h; presigned URLs. | §4.1 FR-PRIV-01 / FR-AUTH-02 · §8 · NFR-SEC-01 |
| **BR-10** | [Symptom Screening & AI Guardrails](group-f-symptom-screening-and-ai/BR-10-symptom-screening-and-ai-guardrails.md) | Group F | Service-safety screening against the 3-group catalog; prohibited services blocked. | §4.2 (service catalog) · §3 RISK-02 |
| **BR-11** | [Complaints, Disputes & Incidents](group-e-violations-disputes-and-safety/BR-11-complaints-disputes-and-incidents.md) | Group E | 24h dispute window after check-out; escrow freeze; Admin adjudication outcomes. | §4.6 FR-DISP-01 · §2.2 (dispute axis) |
| **BR-12** | [Data Retention & Erasure](group-a-identity-access-and-data/BR-12-data-retention-and-erasure.md) | Group A | Medical records max 24 months; NĐ 13/2023 deletion/anonymization; deposit release only on closure after 7 dispute-free days. | §4.1 FR-PRIV-01 · §2.3 · §3 RISK-03 |
| **BR-13** | [Advance Booking, Direct Selection & Shift Extension](group-b-booking-and-dispatch/BR-13-advance-booking-and-rescheduling.md) | Group B | Job Board for > 6h bookings; direct request with 15-min response; extend shift in 1h multiples; cancellation matrix instead of rescheduling. | §4.3 FR-BOOK-03 · §4.4 FR-SHIFT-03 · §5.2 |
| **BR-14** | [Booking Prerequisites & Debt Blocks](group-b-booking-and-dispatch/BR-14-booking-prerequisites-and-debt-blocks.md) | Group B | Customer eKYC/consent/y lệnh gates; nurse 300,000 VNĐ deposit gate; SUSPENDED on unpaid commission > 24h or deposit shortfall. | §4.1 FR-AUTH-03 · §4.5 FR-PAY-02 / FR-PAY-03 · §2.3 |
| **BR-15** | [Medical Orders & In-Session Add-Ons](group-c-care-visit-execution/BR-15-medical-orders-and-in-session-addons.md) | Group C | Two-layer y lệnh verification; no-penalty refusal for invalid orders. | §4.3 FR-BOOK-02 · §3 RISK-01 |
| **BR-16** | [Mid-Session Abort & Partial Billing](group-c-care-visit-execution/BR-16-mid-session-abort-and-partial-billing.md) | Group C | Early stop after check-in billed by actual hours, no penalty; partial settlement only via Phase-2 dispute adjudication. | §5.2 row 4 · §4.6 FR-DISP-02 (Phase 2) |
| **BR-17** | [Consent Lifecycle & Withdrawal](group-a-identity-access-and-data/BR-17-consent-lifecycle-and-withdrawal.md) | Group A | Per-profile NĐ 13/2023 consent with timestamp + IP/Device ID; consent to share records inside the access window; booking precondition. | §4.1 FR-PRIV-01 · §7 · §8 |
| **BR-18** | [Overdue Financial Adjudication (SLA Matrix)](group-d-payments-and-reconciliation/BR-18-overdue-financial-adjudication-matrix.md) | Group D | The SRS §5.2 cancellation/timeout/compensation matrix as the single adjudication source. | §5.2 · §5.1 |
| **BR-19** | [Patient Abuse Flagging](group-e-violations-disputes-and-safety/BR-19-patient-abuse-flagging.md) | Group E | Two-way reviews and customer cancellation history as the conduct record. | §4.6 FR-RATE-01 · §5.2 note |
| **BR-20** | [Phone + OTP Identity and Communication Channels](group-a-identity-access-and-data/BR-20-email-only-identity-and-communication.md) | Group A | Phone + OTP identity; Admin mandatory 2FA; masked in-app chat/calls; push + SMS/ZNS fallback. *(Supersedes the email-only rule; file name retained.)* | §4.1 FR-AUTH-01 / FR-AUTH-03 · §4.6 FR-NOTIF-01 / FR-CHAT-01 · §8 |
| **BR-21** | [Nurse Credentialing, Tier Assignment & GPHN Lifecycle](group-a-identity-access-and-data/BR-21-two-step-staff-credentialing.md) | Group A | eKYC + Admin review (`reviewed_by`); tier assignment; GPHN expiry auto-demote / renewal auto re-upgrade. *(File name retained.)* | §4.1 FR-AUTH-01 / FR-AUTH-02 · §2.3 · §1.3 |
| **BR-22** | [Mandatory Clinical Care Report](group-c-care-visit-execution/BR-22-mandatory-clinical-care-report.md) | Group C | Mandatory shift log & check-out report; opens the 24h dispute window and 12h record-access countdown. | §4.4 FR-SHIFT-02 / FR-SHIFT-04 |
| **BR-23** | [Emergency SOS & Incident Response](group-e-violations-disputes-and-safety/BR-23-emergency-sos-and-incident-response.md) | Group E | On-site 115 call first; app alerts family/Admin with GPS + latest vitals. | §4.4 FR-SHIFT-05 · §3 RISK-03 |
| **R-L03** | [Account Lockout Policy](group-g-supplementary-flow-rules/R-L03-account-lockout-policy.md) | Group G | OTP / sign-in attempt protections for phone-based identity. | §8 (auth endpoints) |
| **R-UC135** | [Call Center Proxy Booking](group-g-supplementary-flow-rules/R-UC135-call-center-proxy-booking.md) | Group G | [No direct counterpart in SRS v2.0 — see rule file] | — |

---

## 4. Precedence of Documentation

When code implementation and business specifications diverge, **the SRS wins**:
1. **SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026)** — the governing baseline (FRs, state machines, SLA matrix, system configs, schema, API spec, RTM).
2. Business Rules Documentation (this suite) — derived from, and traceable to, the SRS.
3. Source Code Implementation.

The former governing sources — `use_case_v8.1.drawio` (140 UCs), `luong_hoat_dong_v8.14.drawio` (17 activity flows), and the Q-01–Q-51 decision register — are **superseded** and retained for reference only in `archive/`. Where a topic is not specified in SRS v2.0, the rule files mark it **[Not specified in SRS v2.0 — open item]** rather than carrying over hospital-baseline rules; such items are collected in `open-decisions-register.md`.
