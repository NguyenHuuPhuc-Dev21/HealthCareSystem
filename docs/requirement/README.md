# System Requirements Specifications (SRS)

> **Specification Baseline:** SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** — the on-demand nursing marketplace connecting Patients/Families with retired doctors/nurses and newly graduated nursing students. There are **no hospital tenants** in this model.  
> **Scope:** MVP (Phase 1) — task-based and short-term shift bookings, Nurse Web Portal & Nurse Mobile App, Radar Dispatch + Job Board matching, bank-transfer escrow and cash payment with nurse self-paid 15% commission, upfront 300,000 VND nurse deposit, GPHN-based two-tier staffing. Phase 2 — long-term contracts, partial settlement, Elder-Friendly Patient App.  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Original Vietnamese Baseline:** The file in [`archive/`](archive/) is the superseded hospital-baseline document, kept for history only; it is **not** a governing source.

---

## 1. Document Index

The system requirements are organized into two dedicated specifications:

| Specification Document | Description | Scope / Modules |
|---|---|---|
| [**`functional-requirements.md`**](functional-requirements.md) | **Functional Requirements Specification (FRS)** | The SRS v2.0 FR set: FR-AUTH & FR-PRIV (authentication, eKYC, GPHN tiers, health-data consent), service catalog & FR-SCHED / FR-SEARCH, FR-BOOK (booking, medical-order control, Radar Dispatch & Job Board matching), FR-SHIFT (check-in anti-fraud, shift logs, extension, check-out, SOS protocol), FR-PAY (two payment methods, 24h settlement, upfront deposit, withdrawals), FR-DISP / FR-RATE / FR-NOTIF / FR-CHAT (disputes, TrustScore ratings, notifications, masked in-app chat), FR-ADMIN — plus Annex A (`system_configs` parameters) and Annex B (cancellation/timeout/compensation SLA matrix). |
| [**`non-functional-requirements.md`**](non-functional-requirements.md) | **Non-Functional Requirements Specification (NFRS)** | SRS §6 quality attributes: NFR-UI (Elder-Friendly UI), NFR-COMP (low-end device & browser compatibility), NFR-AVAIL (99.5% availability, backup, RPO/RTO), NFR-SEC (private media storage, race-condition safety, webhook HMAC + idempotency, audit logging), the performance targets quantified in SRS §9–§10, and privacy/compliance under Decree 13/2023/ND-CP. Attributes the SRS does not quantify are listed there as open items. |

Supporting specifications derived from the same baseline:

| Document | Description |
|---|---|
| [`docs/api/README.md`](../api/README.md) | REST API endpoint catalogue (SRS §8), grouped by domain with access roles. |
| [`docs/business_rule/open-decisions-register.md`](../business_rule/open-decisions-register.md) | Points SRS v2.0 leaves open; no invented defaults may be implemented for them. |

---

## 2. Directory Structure

```
docs/requirement/
├── README.md                           # Master Catalog & Overview (this file)
├── functional-requirements.md          # Complete Functional Requirements Specification (EN)
├── non-functional-requirements.md      # Complete Non-Functional Requirements Specification (EN)
└── archive/
    └── functional-and-non-functional.vi.md  # Superseded hospital-baseline document (history only)
```

---

## 3. Precedence & Governance

The **SRS HealthCareSystem On-Demand Nursing v2.0 (Updated, 28/10/2026)** is the single governing requirements baseline for this project. Where code or other documentation disagrees with it, the SRS v2.0 prevails and the conflicting document must be revised. Anything the SRS does not specify is recorded as an open item in the Open Decisions Register — it must not be filled in from the superseded hospital baseline (use-case catalog, BR-01–BR-23, activity flows) or with invented values.
