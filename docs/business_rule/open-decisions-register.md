# Open Decisions Register (Q-01 — Q-51)

> **Source Baseline:** `use_case_v8.1.drawio` (Page 00b) + `luong_hoat_dong_v8.14.drawio`  
> **Status:** Baseline Tracked  
> **Rule:** Features whose governing decisions have unconfirmed values must not have arbitrary default values hard-coded.

---

## 1. Active Open Decisions Affecting Business Rules

| Decision ID | Description & Context | Affected Business Rules | Current Status & Impact |
| :--- | :--- | :--- | :--- |
| **Q-03** | Minimum home-visit fee (exact amount and fee structure) | BR-04, BR-16 | **Unspecified Value** — Technical framework implemented; rates retrieved dynamically from hospital configuration once PO & Hospital Accounting sign off. Blocks "service infeasible after departure" branch. |
| **Q-05** | Hospital confirmation that auto-assignment model complies with labor law | BR-01 | **Pending Hospital HR/Legal** — Required before enabling automated dispatch for employed nurses. |
| **Q-08** | Partial billing ratio for interrupted service items upon mid-session abort | BR-16 | **Proposed (50%)** — Pending clinical operations validation. |
| **Q-09** | Ceiling amount for in-session add-on items | BR-04 | **Unspecified Value** — Add-ons require explicit patient consent per item until ceiling is set. |
| **Q-10** | Automated offset deduction for nurse indemnity when preparing billing statement | BR-18 (F3) | **Excluded from MVP** — Deductions handled manually with a maximum 30% cap per pay period. |
| **Q-11** | Statutory invoice timing for advance deposits | BR-04 | **Pending Hospital Accounting** — System supports pre-invoicing or post-visit consolidated tax invoicing. |
| **Q-12** | Default ruling on unresolved cash discrepancy disputes | BR-18 (F5) | **Intentionally Empty** — Cash transactions are excluded from Pilot Q-23 scope. |
| **Q-13** | Approved home-care clinical procedure catalog | BR-15 | **Pending Hospital Medical & Legal Boards** — Defines `Duoc_phep_lam_tai_nha` flag. |
| **Q-14** | Statutory clinical care and financial voucher retention schedules | BR-12 | **Pending Legal Counsel** — Default anonymized locking applied pending schedule sign-off. |
| **Q-17** | Complaint submission deadline (30 days from session completion) | BR-11 | **Proposed (30 days)** — 24-hour limit on fee-line billing complaints is frozen. |
| **Q-19** | Default presumption on nurse reassignment ("Silence = Acceptance") | BR-13 | **Under Review** — Currently defaults to acceptance if patient does not respond within SLA. |
| **Q-21** | On-duty physician triage SLA during automated screening failure | BR-10 | **Unspecified Value (Proposed: 10 min)** — Fallback routes to hospital phone contact if physician times out. |
| **Q-22** | Operating hours (17:00–21:30) and daily shift volume caps (2 weekday / 4 weekend) | BR-03, BR-13 | **Awaiting Field Demand Validation** — Fully configurable per hospital facility. |
| **Q-24** | Legal liability and insurance coverage for in-home patient/staff accidents | BR-11 | **Pending Hospital Legal & Insurer Counsel** — Decoupled from software platform operations. |
| **Q-26** | Clinical accuracy validation criteria and benchmarks for AI symptom triage | BR-10 | **Unspecified Benchmark** — AI operates strictly in decision-support mode with physician oversight. |
| **Q-29** | Minor violation threshold (2/3 unconfirmed assignments in 30 days) | BR-01 | **Proposed (2 / 3 times)** — 24h on-demand lock on 2nd strike; admin referral on 3rd. |
| **Q-35** | Default fee retention when mid-session abort review times out | BR-16, BR-18 (F9) | **Proposed** — Provisional nurse-selected fee maintained if hospital admin fails to review in 24h. |
| **Q-37** | Excessive tardiness (>30 min past ETA) treated as 1–12h cancellation | BR-02 | **Proposed** — Increments 3-strike major violation counter. |
| **Q-42** | Counting administrative auto-waivers/approvals toward patient abuse score | BR-19 | **Proposed** — Unverified write-offs count toward the 2-strike abuse threshold. |
| **Q-44** | Default resolution when Platform Admin exceeds 3-day SLA on Branch F1b | BR-18 (F1b) | **Proposal Pending PO Sign-off** — Baseline mandates escalating F1b to Admin; default if Admin times out is proposal. |
| **Q-48** | Secondary emergency escalation focal points when SOS is unacknowledged | BR-23 | **Configurable per Hospital** — Auto-escalates at the 5-minute milestone. |
| **Q-49** | Service-specific reporting form schemas and mandatory fields | BR-22 | **Architectural Framework Ready** — Field schemas defined by hospital clinical department. |

---

## 2. Formally Closed Decisions (Frozen into Baseline Architecture)

- **Q-20:** Cross-hospital patient record sharing is **strictly disabled**, even with explicit patient consent (BR-09).
- **Q-23:** Pilot scope frozen: Single hospital, advance booking only, online gateway only, no cash, rule-based triage with doctor review, 5-minute SOS escalation (no auto-115 dialing).
- **Q-30:** Collected deposits are allocated first to disputed fee lines up to their value (BR-04).
- **Q-33:** Two-stage final billing confirmation with 24-hour dispute window (BR-04).
- **Q-38:** On-demand cancellation refund schedule based on departure status (BR-04).
- **Q-41 / Q-45:** Nurse cancellation during deposit window records 1 minor violation immediately and reopens a 15-minute matching window (BR-01).
- **Q-43:** Shift abandonment ("Bom ca") 24-hour automated unlock if unconfirmed by hospital admin (BR-02, BR-07).
- **Q-46:** False "Unsafe Environment" declarations penalize the nurse with 1 major violation (BR-16).
- **Q-50:** Two-step staff profile credentialing lifecycle state machine (BR-21).
- **Q-51:** Email-only account identifier; zero SMS and no national ID card (CCCD) collection (BR-20).
