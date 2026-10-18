# Test Strategy Specification

> **Document Scope:** Full testing strategy for the Hospital Home-Care Nursing Platform — pilot milestone (Decision Q-23) and subsequent release phases.  
> **Authoritative Specification Hierarchy (in order of precedence in case of conflict):**  
> 1. `use_case_diagram.drawio` — 140 UCs, BR-01–BR-23, Financial Decision Table BR-18 (F1a–F9)  
> 2. `workflow_diagram.drawio` — 17 Activity Flows, Traceability Matrix 00c, Decision Register Q-01–Q-51  
> 3. `docs/user_stories/` — 27 **Must** User Stories (US-HP-01–36, with embedded test case matrices) + 10 **Should** User Stories (US-HP-08, 16, 17, 21, 30, 31, 32, 33, 35, 37)  
> 4. `docs/requirement/` — Functional (FR-01–FR-11) and Non-Functional (NFR-01–NFR-09) Specifications  
> 5. `docs/business_rule/` — Consolidated Business Rules across 7 Domain Groups A–G + `open-decisions-register.md`  
> 6. `docs/security/` — Security Policies SEC-00–SEC-10  
> 7. `erd_diagram.drawio` page 14 (Enum Dictionary) + page 15 (Constraints & Indexes); `docs/database/schema.sql` (verified on PostgreSQL 16: 75 tables, 63 enums, 192 foreign keys)  
>  
> **Status:** Strategic Proposal — numerical thresholds labeled "Proposed" await final sign-off from the Product Owner (PO) and engineering team alongside open decisions in Section 11. In any conflict, the authoritative baseline specifications prevail.  
> **Original Vietnamese Baseline:** Preserved in [`archive/test-strategy.vi.md`](archive/test-strategy.vi.md)

---

## 1. Objectives

1. **End-to-End Traceability by Code Identifier:** Every business rule (BR), Must User Story, and FR/NFR requirement must have tests that are strictly traceable via authoritative identifiers (`UC`, `BR`, `US`, `FR`, `NFR`, `SEC`). No "orphan" tests; no unvalidated business rules.
2. **Defect Interception at the Lowest-Cost Tier:** Prevent defects at the earliest and cheapest layer possible: database constraints are verified at the DB schema tier, algorithmic rules at the unit tier, and end-to-end user workflows at the E2E/UAT tier.
3. **Rigorous Defense of the Three High-Risk Domains:** Automated tests must block pull request merges unless green across the system's three highest-risk surfaces:
   - **Financial Precision & Ledgers:** (BR-04 deposit/refunds, BR-18 decision tables, BR-05 platform billing)
   - **Clinical Patient Safety:** (BR-10 symptom screening, BR-23 emergency SOS, BR-22 mandatory care reports)
   - **Identity, Access Control & Privacy:** (BR-09 4-factor authorization, BR-17 consent management, BR-20 email auth, BR-21 staff credentials)
4. **Transparent Handling of Open Decisions:** Every unfinalized business decision (from Decision Register Q) must maintain an explicit testing status—never hardcoding arbitrary expectations for unapproved values.

---

## 2. Testing Scope

### 2.1 In Pilot Scope (Decision Q-23)

A single hospital tenant, advance booking only, online gateway payments only (cashless, no instant booking), rule engine symptom screening with on-duty clinical review, and 5-minute SOS escalation (no automated 115 dialing). Comprehensive test coverage includes:
- 27 Must User Stories (US-HP-01–36)
- 62 Must Functional Requirements (FR)
- All 23 Business Rules (BR-01–BR-23, excluding branches blocked by open decisions in Section 11)
- Non-Functional Requirements (NFR-01–NFR-09) calibrated to pilot volume baselines
- Security Policies (SEC-00–SEC-10)

### 2.2 Out of Scope / Deferred Items

| Item | Source | Testing Status | Rationale |
|---|---|---|---|
| **Full Instant Booking / Fast Matching** | FR-04.10, BR-08 | **Won't** — No test creation; maintain negative tests asserting absence from pilot. | Excluded from Pilot Q-23 scope. |
| **In-Home Cash Handling Pipeline** | FR-06.11, BR-05 cash branch | **Won't** — No tests written. | Excluded from Pilot Q-23 scope. |
| **Cash Dispute Resolution (F5)** | BR-18 F5, Decision Q-12 | **Untested** — Deliberately unassigned; inventing defaults in code/tests is prohibited. | Awaits cash scope activation. |
| **Assisted Hotline Booking (UC135)** | FR-04.11, R-UC135 | **Deferred** — Pending PO decision; if approved, requires STRIDE threat modeling (SEC-10.4) prior to test creation. | Decision pending. |
| **Automated Nurse Indemnity Offsetting** | Decision Q-10 | Outside MVP — Managed via administrative processes; tested via procedural audit checks. | Excluded from pilot. |
| **Merged / Deprecated UCs** | UC29, UC70–UC76, UC130–UC132 | No functional requirements or test cases generated. | Retired during baseline refinement. |

### 2.3 Guiding Principles for Open Decisions

- **Mechanisms Defined, Thresholds Pending (e.g., Q-03 Minimum Visit Fee, Q-09 Add-on Cap, Q-22 Shift Limits):** Tests are written against **configuration parameters**. Mock values are injected through effective-dated configuration stores, verifying that the calculation engine correctly reads the active parameter at runtime and that retrospective configuration updates never mutate historic ledgers.
- **Pending Decision Tree Branches (e.g., Post-Admin Action in F1b — Q-44):** Test up to the escalation point and SLA breach; the post-decision branch is recorded as `it.todo` referencing the Decision Q code.
- **Unratified Proposed Ratios/Thresholds (e.g., Q-08 50% Abort Split, Q-29 Minor Violation Threshold, Q-35, Q-37, Q-42, Q-17, Q-19, Q-21):** Tests execute against proposed values but are tagged `PENDING-Q` in test suites for systematic review upon formal sign-off.

---

## 3. Core Testing Principles

1. **Traceability by Code Identifier:** Test files and test cases must incorporate authoritative codes (e.g., `br04-refund-policy.test.ts`, `TC-USHP14-02`). Every pull request must enumerate the covered UC/BR/US codes matching repository PR templates.
2. **Authoritative Specifications Prevail:** If a test fails due to a specification change, the test is updated to align with the approved specification—never modify a test to validate incorrect code behavior.
3. **Strict Synthetic Test Data:** Production patient data is strictly forbidden across all development, testing, and staging environments (NFR-04.4, NFR-09.4). The canonical reference fixture is Visit Encounter **#MH-8824** in `db/seeds/`; fixtures are dynamically generated via code in `db/tests/src/fixtures.ts`.
4. **Isolation & Repeatability:** Every test constructs its own minimal prerequisite data; no order-of-execution dependencies. Database tests execute sequentially against a dedicated test database, with tables truncated between test runs.
5. **Time as an Explicit Test Variable:** All temporal business logic (deposit expiration, notification reminders, escalation SLAs) is verified using deterministic fake timers with boundary thresholds of ±1 second/minute—never relying on real-time sleep delays.
6. **Negative & Adversarial Testing:** Every Must Story requires negative and security test cases mirroring the negative Acceptance Criteria in story files (e.g., `TC-USHP02-02` expired consent token, `TC-USHP05-01` blocking sessions lacking 2FA, `TC-USHP18-02` cross-tenant unauthorized access).
7. **Shift-Left Security:** Tests are committed alongside feature implementation in the same PR. Pull requests modifying authentication, authorization, payments, or clinical data schemas must pass formal security review gates (SEC-10.1).

---

## 4. Test Tiers & Execution Layers

```
                      ▲
                     / \
                    /   \     Tier 9: UAT & Operational Readiness
                   /-----\
                  /       \    Tier 8: Non-Functional & Performance (k6, Chaos)
                 /---------\
                /           \   Tier 7: Security Testing (IDOR, Pen-test, CI Gates)
               /-------------\
              /               \  Tier 6: End-to-End User Journeys (Playwright / Maestro)
             /-----------------\
            /                   \ Tier 5: Background Jobs & Timers (Queues, Schedulers)
           /---------------------\
          /                       \ Tier 4: External Integrations & Contracts (Gateways, Maps)
         /-------------------------\
        /                           \ Tier 3: API Integration & 4-Factor Auth Matrix
       /-----------------------------\
      /                               \ Tier 2: Business Logic Unit Tests (Rules, Calculations)
     /---------------------------------\
    /                                   \ Tier 1: Database Constraint Verification (PostgreSQL 16)
   /=====================================\
```

### Tier 1 — Database Constraint Verification (`db/tests/`)

- **Objective:** Prove that non-negotiable operational invariants are enforced at the PostgreSQL 16 schema layer—the lowest-cost, most robust defense tier.
- **Scope:** All constraints documented on page 15 of ERD-2; each constraint requires both positive valid tests and negative violation assertion tests:

| Constraint Category | Representative Constraint | Authoritative Baseline |
|---|---|---|
| **Partial Unique 3.1a** | Single cancellation per booking originating from emergency screening (`triage_assessment.resulting_cancellation_id`) + `CHECK` constraint ensuring cancellation links only when outcome is `EMERGENCY`. | ERD 3.1a Feedback; ERD 8.11 |
| **Partial Unique 3.1b** | Idempotent gateway transactions: no duplicates for `(gateway, transaction_code)` / `(gateway, event_id)`. | 3.1b; BR-05, NFR-01.4, NFR-05.2 |
| **Partial Unique 3.1c** | Exactly one `PENDING` timer per `(timer_type, target_entity_id)`. | 3.1c; FR-11.2 |
| **Config Unique 3.1d** | `(key, effective_from)` uniqueness for system parameters and hospital facility configurations. | 3.1d; NFR-09.2 |
| **Partial Unique 3.1e** | A booking may only be evaluated once per violation counter category. | 3.1e; BR-01, BR-02 |
| **Exclusion Constraints** | `EXCLUDE USING gist`: Nurse availability overlaps; doctor on-duty shifts; patient booking schedule conflicts (with sub-booking exceptions per BR-16). | ERD page 15; BR-03, BR-14 |
| **Business CHECKs** | Active staff must have 2FA enabled; cancelled bookings must possess `cancel_reason_code`; `final_fee <= provisional_fee`; `reschedule_count <= 2`; refund vouchers require cryptographic hash; ratings bounded 1–5; monetary amounts > 0. | BR-20/21, BR-16, BR-13, UC90 |
| **Active Uniqueness** | Exactly one active consent record per patient profile; one active abuse flag per account; staff license number and email unique among active clinical records. | BR-17, BR-19, BR-21 |

- **Current Status:** **17 automated tests passing** on live PostgreSQL 16 (across 4 suites: triage, payment, overlap, staff-consent).
- **Next Steps:** Complete test coverage for remaining constraints on page 15 (3.1c, 3.1d, 3.1e, cancelled booking CHECKs, refund voucher hashes).
- **Execution:** Automated CI job `db` provisions PostgreSQL 16 → executes database migrations → runs test suite (configured in `.github/workflows/ci.yml`).

---

### Tier 2 — Business Logic Unit Testing (`services/api/test/unit/`)

- **Objective:** Verify business rules implemented as deterministic calculation and decision functions using rule-coded, data-driven boundary tests.
- **Rule Coverage Matrix:**

| Rule ID | Core Testing Focus | Mandatory Boundary Values |
|---|---|---|
| **BR-01** | 30-day rolling evaluation window, minor violation thresholds (Q-29: 2/3 occurrences — `PENDING-Q`), 15-minute rematch window upon cancellation during deposit hold (Q-45). | Day 30 vs. Day 31; 2nd vs. 3rd occurrence. |
| **BR-02** | Three penalty tiers based on cancellation lead time (≥12h; 1–12h: −15 percentage points payout split for next 3 visits; <1h or abandonment: temporary suspension), 24h auto-unlock (Q-43), single-point review, >30 min delay (Q-37 — `PENDING-Q`). | 12h / 1h boundary ±1 min; 3rd vs. 4th visit post-penalty. |
| **BR-03** | Operating window 17:00–21:30, maximum daily visit limits (Q-22 — configuration parameter). | 16:59 / 17:00 / 21:30 / 21:31 timestamps. |
| **BR-04** | Deposit formula `max(30%, 50,000 VND)`; refund schedule (100% / 50% / 0%); deposit allocation to disputed lines (Q-30); 2-tier billing sign-off (Q-33); 4-bucket reconciliation. | 12h / 2h boundaries (8 tests passing); rounding and fractional VND handling. |
| **BR-05** | Platform commission calculated from effective-dated configuration; SaaS platform never escrows patient funds. | Mid-period configuration rate modifications. |
| **BR-06** | Facility service geofences; relationship between facility boundaries and nurse service zones (pending decision on `nurse_service_area` retention). | Coordinates inside vs. outside service boundary. |
| **BR-07** | Departure deadlines, maximum 2 delay requests × 15 min, abandonment detection, geofence check-in + photo fallback. | GPS coordinate drift boundaries (NFR-08.3). |
| **BR-08** | Verify absence of instant booking functionality from pilot builds. | Assert non-existence of instant-booking endpoints. |
| **BR-09** | 4-factor authorization engine (`Role × Tenant × Relationship × Visit/Profile Context × Object State`). | Comprehensive Role × Tenant permission matrix. |
| **BR-10** | 4-tier symptom triage; prohibition of patient self-downgrading risk; versioned rule schemas (`rule_version`); AI failure/timeout failover to on-duty doctor (Q-21 — `PENDING-Q`); prohibition of definitive medical diagnosis/prescriptions (FR-03.6). | Boundary symptom sets for each risk tier. |
| **BR-11** | Dispute filing deadlines (24h for line-items; 30 days — Q-17 `PENDING-Q`); 3-business-day resolution SLA; severe complaints trigger 4h temporary suspension confirmation. | 24h / 30-day boundaries; business days vs. calendar days. |
| **BR-12** | 72-hour right to erasure/anonymization; erasure blocking conditions (active visits, open disputes, unpaid debt); statutory retention rules (Q-14). | Exactly at 72h mark; individual blocking conditions. |
| **BR-13** | Advance booking window T+2h to T+14 days; maximum 3 active concurrent bookings; maximum 2 reschedules with deposit retention; T−3h reconfirmation (deadline T−2h); default behavior upon patient non-response (Q-19 — `PENDING-Q`). | T+2h / T+14d ±1 min; 3rd reschedule attempt. |
| **BR-14** | Booking prerequisites: outstanding balance = "Pending Payment" > 24h triggers booking block; schedule overlap prevention (30-minute buffer). | Exactly at 24h mark. |
| **BR-15** | Add-on item classification (Class A/B/C); Class B clinical approval ≤ 10 min; Class C visit termination + SOS; prescription verification for restricted procedures (catalog Q-13). | Each add-on class; expired or invalid prescriptions. |
| **BR-16** | Mid-session visit termination: prorated compensation for completed scope (Q-08 50% split — `PENDING-Q`), retained fees ≤ provisional fee, post-audit of "unsafe environment" claims (Q-46), zero-deposit child booking; default action upon hospital review timeout (Q-35 — `PENDING-Q`). | Fee boundaries at 0% / 100%. |
| **BR-17** | Granular profile consent & terms versioning; adult relative consent via email link (24h non-response aborts profile); consent revocation governed by booking lifecycle state (unassigned → cancel + 100% refund; en route/in-session → graceful complete or safe termination). | 24h link expiration; each booking lifecycle state. |
| **BR-18** | Data-driven verification of Table F1a–F9 (timeout event → decision rule → expected financial ledger entry); F5 untested (Q-12); post-admin action in F1b marked `todo` (Q-44). | Each F-code × on-time vs. overdue branches (9 `it.todo` suites initialized). |
| **BR-19** | Patient abuse flag: 90-day rolling window, 7-day notification and rebuttal window, inclusion of automated fee waivers (Q-42 — `PENDING-Q`). | 2nd event inside vs. outside 90-day window. |
| **BR-20** | Email as sole account identifier; email OTP valid 5 min (reset 15 min); shared 5-attempt brute-force counter → 15 min lock (R-L03); separation of in-session codes (check-in/billing/add-on/stop) from account OTPs. | 5 min / 15 min boundaries; 5th vs. 6th failed attempt. |
| **BR-21** | 10-state staff profile state machine; 2-step onboarding approval; platform never certifies licenses; automated daily license expiration scanner. | All valid vs. invalid lifecycle state transitions. |
| **BR-22** | Mandatory care reports (required even if patient reported no symptoms); service-specific clinical schemas (framework Q-49); 2h reminder, 24h dispatch suspension. | Exactly at 2h / 24h marks. |
| **BR-23** | Emergency SOS: alert dispatch ≤ 10 seconds (NFR-01.2); 5-minute escalation to backup contacts (Q-48, staged `sos_escalation_event`); no automated 115 calling; in-session SOS halts visit and prohibits on-site billing. | Exactly at 5:00 mark; acknowledgment before vs. after SLA. |
| **R-L03** | Brute-force account lockout (consolidated into BR-20). | — |
| **R-UC135**| Deferred in full (Section 2.2). | — |

- **Coverage Gate:** Financial logic (BR-04, BR-18), violation tracking (BR-01, BR-02), and authorization enforcement (BR-09) must achieve **≥ 80% decision branch coverage** in CI (NFR-09.1).

---

### Tier 3 — API Integration & Authorization Matrix Testing

- **API Contract Verification:** Every endpoint validates HTTP status codes, structured response schemas, and ensures error messages do not leak sensitive information. State machine transitions across Bookings and Visits must strictly conform to the approved state transition matrix (NFR-05.4)—illegal transitions are blocked at the API layer.
- **Automated BR-09 Authorization Matrix:** For every route accessing patient or financial records, automated test suites execute matrix permutations: `Role × Hospital Tenant × Relationship to Record × Entity Lifecycle State`, asserting HTTP `403 Forbidden` or `404 Not Found` when any factor fails (matching SEC-10.2 IDOR / cross-tenant rules).
- **Pre-Signed URL Security:** Pre-signed URLs for medical media must be issued only after server-side four-factor authorization validation, enforcing expiration limits **≤ 15 minutes** (NFR-03.3) against private storage buckets.
- **Cross-Layer Workflow Integration:** Every primary workflow (Flows 01–15, 17) includes at least one end-to-end API integration test covering the happy path and highest-cost exception branches (cancellation during deposit hold, mid-session consent revocation, visit termination, F1a/F1b disputes).
- **Financial & Audit Consistency:** Following workflow completion, tests assert: balanced double-entry `financial_entry` records (append-only), complete `order_status_history` transitions, and emitted `audit_log` events for sensitive operations (FR-01.7).

---

### Tier 4 — External Integrations & Contract Testing

| Partner Service | Testing Methodology | Mandatory Test Scenarios |
|---|---|---|
| **Payment Gateway** | Gateway sandbox + mock webhook server | Valid / invalid HMAC signatures; duplicate/replayed webhooks (idempotency: exactly one transaction, one refund order); out-of-order event delivery (refund before confirmation); direct settlement into hospital account, platform holds zero funds (BR-05); webhook processing latency ≤ 3 seconds (NFR-01.4). |
| **Transactional Email** | Test mailbox / mock email provider | Email templates omit granular clinical health details (NFR-04.4); OTP delivery within validity window; relative consent emails contain scoped, expiring cryptographic tokens (BR-17). |
| **Push Notifications (FCM/APNs)** | Physical test device / emulator + mock APNs/FCM service | Emergency SOS utilizes direct in-app push channels independent of email queues (US-HP-36 AC-03); lock-screen notifications suppress protected health information (PHI). |
| **Maps & Geolocation** | Mock map provider + deterministic coordinate fixtures | ETA calculation and departure deadline determination (BR-07); geofence boundary validation with configurable radius tolerance. |
| **Electronic Invoicing** | Electronic invoice sandbox | Remaining balance invoice generation; credit notes / adjusted invoices issued upon partial or full refunds (FR-06.7 — timing governed by Decision Q-11). |

---

### Tier 5 — Background Jobs & Business Schedulers (FR-11.2)

All time-sensitive business logic executes through background job queues. Tested using deterministic mock timers, asserting actions trigger on schedule with clock skew **≤ 60 seconds** (NFR-05.3) and log transmission/acknowledgment timestamps for SLA audits (FR-11.3):

- 15-minute deposit payment window
- T−24h booking reminder
- Nurse T−3h reconfirmation (deadline T−2h)
- Patient T−2h symptom update invitation (UC119)
- 24-hour itemized fee dispute window
- 24-hour "Pending Payment" grace period converting to outstanding debt
- 5-day hospital response window for F1a
- F1b hospital resolution deadline escalating to Platform Admin (3-business-day SLA)
- 72-hour nurse violation review (F6) and 24-hour abandonment cooldown (Q-43) executing independently
- 5-minute SOS escalation timer
- 2-hour care report reminder / 24-hour dispatch suspension lock
- 72-hour statutory data erasure pipeline (BR-12)
- Automated daily practicing license (CCHN) expiration scanner
- End-of-period financial reconciliation worker (F7)

*Resilience Testing:* Tests simulate worker process crashes, queue deadlocks, and network failures. The system must raise operational alerts on queue backlog spikes and guarantee that job re-runs are idempotent, preventing duplicate financial mutations (enforced via idempotency keys and Constraint 3.1c).

---

### Tier 6 — End-to-End User Journey Testing (E2E)

- **Web Applications (Playwright):**
  - **Happy Path Pilot Journey:** User registers via email → creates patient profile with consent → completes symptom screening → books advance visit → pays deposit via gateway → nurse accepts assignment → checks in on-site using in-app code → performs initial clinical assessment → executes visit with confirmed add-ons → submits mandatory care report → 2-tier itemized bill approval → settles remaining balance → receives electronic invoice.
  - **Mandatory Exception Journeys:** Cancellation across the 3 refund tiers; supplemental emergency symptoms in Flow 07A triggering immediate cancellation and automated 100% refund; F1a dispute resolved via automated fee waiver; F1b dispute escalating to Platform Admin; emergency SOS triggered, triaged, and closed with recorded actions.
- **Nurse Mobile Application (React Native — Maestro / Detox):**
  - In-session visit execution journeys; background GPS location streaming; handling intermittent connectivity and offline local caching with post-reconnection sync (scope governed by Decision NFR-08.2).
- **Elderly Usability & Accessibility Testing:**
  - Base font size ≥ 16 px, touch target dimensions ≥ 48 × 48 px, WCAG 2.1 AA color contrast compliance, emergency SOS accessible within ≤ 2 taps from any primary view (NFR-07.1, NFR-07.2), two-step confirmation dialogs for payments and cancellations (NFR-07.4 — SOS accidental tap countdown mechanism pending PO sign-off).

---

### Tier 7 — Security Testing (SEC-00–SEC-10)

- **Continuous CI Automated Security Suite (SEC-10.2):** Automated test suite running on every pull request—IDOR and cross-tenant isolation matrix (Tier 3), state machine transition integrity, financial payment idempotency under concurrent load (simultaneous duplicate webhooks execute exactly once), git commit secret scanning (GitGuardian/TruffleHog), and automated dependency vulnerability scanning. Security test failures block merging.
- **Security Review PR Gate (SEC-10.1):** Pull requests touching authentication, authorization, sessions, financial ledgers, or clinical schemas mandate approval from a designated security reviewer verifying the BR-09 checklist and negative test coverage.
- **Independent Penetration Testing (SEC-10.3):** Mandatory third-party penetration test prior to pilot go-live and following major architectural changes: OWASP Top 10, OWASP API Security Top 10, cross-tenant boundary escapes, and financial concurrency manipulation. Target compliance: OWASP ASVS Level 2 (NFR-03.4).
- **Structured Threat Modeling (SEC-10.4):** Every major capability (such as assisted booking hotline UC135 if retained) mandates a structured STRIDE threat modeling session prior to implementation.
- **Specific Policy Verification:** Password hashing via Argon2id/bcrypt, rate-limited OTP attempts (NFR-03.2); append-only audit logs free of passwords, tokens, or unnecessary PHI (NFR-03.5); third-party API keys stored in cloud secret managers, never in code repositories (NFR-03.6).

---

### Tier 8 — Non-Functional & Quality Attribute Testing (NFR-01–NFR-09)

| NFR Category | Testing Methodology | Quality Target & Reference Basis |
|---|---|---|
| **NFR-01 Performance** | Load and stress testing via **k6** on production-like staging environment: peak-hour scenario (17:00–21:30), ~300 visits/day (pilot baseline load). | API P95 latency ≤ 300 ms read / ≤ 800 ms write; SOS trigger to push notification delivery ≤ 10 seconds (P95); GPS telemetry dispatched every 10–15s, battery consumption ≤ 5%/hour. |
| **NFR-02 Availability & DR** | Quarterly PostgreSQL Point-in-Time Recovery (PITR) drill on synthetic data replicas; chaos engineering tests (simulating AI failure, gateway outage, GPS loss). | RPO ≤ 1 hour, RTO ≤ 4 hours; AI failure falls back to on-duty doctor triage; gateway outage initiates manual refund workflow F8; GPS loss initiates photo backup check-in (BR-07, BR-10). |
| **NFR-03 Security** | Consolidated under Tier 7 + automated configuration audits for TLS cipher suites and volume encryption. | TLS 1.2+; AES-256 at rest; pre-signed URLs valid ≤ 15 minutes. |
| **NFR-04 Privacy & Compliance** | Data flow audits under Vietnam Decree 13/2023/ND-CP: profile-specific consent, consent withdrawal, 72h data erasure; verify email/push payloads omit granular PHI. | Governed by BR-12, BR-17; data residency compliance pending legal evaluation (Decision Q-14). |
| **NFR-05 Data & Financial Precision** | Invariant testing: 4-bucket deposit reconciliation mathematically matches gross deposit receipts (FR-06.8); append-only ledgers; UTC storage rendered in Asia/Ho_Chi_Minh. | Reconciliation discrepancy = 0 on canonical fixtures; scheduler temporal clock skew ≤ 60 seconds. |
| **NFR-06 Scalability & Multi-Tenancy** | Multi-tenant isolation verified from Day 1 (Tier 3); stress testing under 5× baseline pilot volume surge. | Zero cross-tenant data leakage; absorbs 5× load surge without architectural refactoring. |
| **NFR-07 Usability & Accessibility** | Automated axe-core / WCAG compliance testing + moderated usability testing with elderly participants during UAT. | Font size ≥ 16 px; touch target ≥ 48 px; booking completed within ≤ 5 screens; SOS within ≤ 2 taps. |
| **NFR-08 Compatibility & Field Resilience** | Device test matrix on Android 10+ and iOS 15+; hospital admin web tested across latest 2 major versions of modern browsers; degraded 3G and offline recovery testing. | Governed by NFR-08.1, NFR-08.2, NFR-08.3. |
| **NFR-09 Maintainability & Observability** | Verify structured JSON logging schemas; automated operational alert testing: job queue backlogs, failed webhooks, spikes in OTP failure rates, unacknowledged SOS events > 5 min; simulation of 4 standard incident runbooks. | Governed by NFR-09.3, NFR-09.5. |

*Note: Numerical metrics at this tier represent engineering proposals pending formal sign-off (refer to Section 11); tests execute against proposed thresholds tagged `PENDING-NFR`.*

---

### Tier 9 — User Acceptance Testing (UAT) & Pilot Operational Readiness

- Partner hospital personnel execute end-to-end UAT scenarios constructed directly from the Acceptance Criteria of the 27 Must User Stories on a production-like staging environment populated with realistic synthetic fixtures (using the hospital's actual catalog pricing and shift parameters).
- **Operational Simulation Drills:** Conduct live simulations for: receiving and closing a live emergency SOS alert, resolving sample F1a and F1b fee disputes, executing end-of-period deposit reconciliation, and performing disaster data recovery drills (NFR-02.2) following the 4 standard playbooks in NFR-09.5.
- Formal go/no-go sign-off governed by criteria in Section 8.

---

## 5. User Story Traceability Matrix (27 Must Stories)

Each Must Story embeds an authoritative test case matrix (totaling **69 Test Cases** across 27 stories). The table below assigns primary/secondary test execution tiers and initialization status:

| Epic | User Story | Embedded TCs | Primary Test Tiers | Initialization Status |
|---|---|---|---|---|
| **A — Account & Access** | **US-HP-01** Email Registration & Login | 3 | Tier 2, Tier 3 | Ready for scaffolding |
| | **US-HP-02** Relative Consent via Email Link | 3 | Tier 2, Tier 3, Tier 4 | Ready for scaffolding |
| | **US-HP-03** Consent Withdrawal & Re-consent | 3 | Tier 2, Tier 3, Tier 5 | Ready for scaffolding |
| | **US-HP-04** Two-Step Staff Onboarding | 2 | Tier 1 (CHECK 2FA), Tier 2, Tier 3 | Partially Initialized (Tier 1 passing) |
| | **US-HP-05** Mandatory Staff 2FA Authentication | 3 | Tier 2, Tier 3, Tier 7 | Partially Initialized (Tier 1 passing) |
| **B — Profile & Screening** | **US-HP-06** Patient Profile Creation | 3 | Tier 3, Tier 6 | Ready for scaffolding |
| | **US-HP-07** 4-Tier Symptom Screening | 3 | Tier 1 (Constraint 3.1a), Tier 2 | Partially Initialized (Tier 1 passing) |
| **C — Booking & Matching** | **US-HP-09** Advance Booking Creation | 2 | Tier 2, Tier 3, Tier 6 | Ready for scaffolding |
| | **US-HP-10** Automated Nurse Matching | 2 | Tier 2, Tier 3 | Ready for scaffolding |
| | **US-HP-11** Rematching on Cancellation during Hold | 2 | Tier 2, Tier 5 | Ready for scaffolding |
| | **US-HP-12** Pre-Visit Reminders & Symptoms (Flow 07A) | 3 | Tier 1, Tier 2, Tier 5 | Partially Initialized (Tier 1 passing) |
| | **US-HP-13** Patient Cancellation & Refund Schedule | 3 | Tier 2 (BR-04 — **8 tests passing**) | Partially Initialized |
| **D — Payments & Balances** | **US-HP-14** 30% Deposit via Hospital Gateway | 3 | Tier 1 (Constraint 3.1b), Tier 4, Tier 5 | Partially Initialized (Tier 1 passing) |
| | **US-HP-15** Remaining Balance & 24h Grace Period | 3 | Tier 2, Tier 5 | Ready for scaffolding |
| **E — Visit Execution** | **US-HP-18** Nurse Pre-Visit Briefing Review | 2 | Tier 3 | Ready for scaffolding |
| | **US-HP-19** In-Home Check-In via In-App Code | 3 | Tier 2, Tier 3, Tier 6 | Ready for scaffolding |
| | **US-HP-20** Mandatory Initial Clinical Assessment | 2 | Tier 3, Tier 6 | Ready for scaffolding |
| | **US-HP-22** Mandatory Clinical Care Report | 3 | Tier 2, Tier 3 | Ready for scaffolding |
| | **US-HP-23** In-Session Add-On Procedures | 3 | Tier 2, Tier 3 | Ready for scaffolding |
| | **US-HP-24** Visit Termination for Unsafe Conditions | 3 | Tier 2, Tier 3 | Ready for scaffolding |
| | **US-HP-25** Minimum Fee on Patient Impediment (Q-03) | 3 | Tier 2 (Configuration parameter) | Awaits Q-03 value for monetary assertion |
| **F — Emergency SOS** | **US-HP-26** Patient / Relative SOS Trigger | 3 | Tier 2, Tier 5, Tier 8 (Latency) | Ready for scaffolding |
| | **US-HP-27** Hospital On-Duty SOS Acknowledgment | 2 | Tier 3, Tier 5 | Ready for scaffolding |
| **G — Hospital Admin** | **US-HP-28** Line-Item Fee Disputes (F1a/F1b) | 3 | Tier 2 (BR-18 suite), Tier 5 | Test scaffolding initialized (`todo`) |
| | **US-HP-29** Violation Logging & Staff Suspension | 3 | Tier 2, Tier 5 | Ready for scaffolding |
| **H — Platform Admin** | **US-HP-34** Platform Admin Escalation (Q-44) | 2 | Tier 2, Tier 5 | Validated up to escalation; post-decision `todo` |
| **I — Notifications** | **US-HP-36** Event-Driven Alerts (No SMS) | 3 | Tier 4, Tier 5 | Ready for scaffolding |

*Handling of **Should** User Stories:* US-HP-08 (screening review), US-HP-16 (manual refunds), US-HP-17 (itemized statements), US-HP-21 (in-app masked communication), US-HP-30 (4-bucket reconciliation), US-HP-31 (exception dispatch), US-HP-32 (hospital configuration), US-HP-33 (tenant management), US-HP-35 (audit lookup), US-HP-37 (historical lookup). When scheduled into sprint scope, each story must define complete acceptance criteria and test matrices before coding. Crucially, **US-HP-30** and **US-HP-17** manage financial ledgers and must enforce the ≥ 80% decision branch coverage standard from Day 1.

---

## 6. Functional Requirements (FR) Coverage Matrix

| FR Group | Primary Test Tiers | Critical Testing Focus |
|---|---|---|
| **FR-01 Identity & Access** | Tier 1, Tier 2, Tier 3, Tier 7 | 5-attempt shared lockout counter (FR-01.2 / R-L03); append-only audit trail (FR-01.7). |
| **FR-02 Profiles, Consent & Privacy** | Tier 1, Tier 2, Tier 3, Tier 5 | 72h data erasure SLA (FR-02.5); consent revocation handling per lifecycle state (FR-02.3). |
| **FR-03 Screening & Clinical AI** | Tier 1, Tier 2, Tier 8 | Fallback to on-duty doctor on AI timeout (FR-03.4); clinical AI boundary constraints (FR-03.6). |
| **FR-04 Booking & Nurse Matching** | Tier 2, Tier 3, Tier 5, Tier 6 | Cap of 3 concurrent bookings, debt validation, service geofence enforcement (FR-04.1). |
| **FR-05 Visit Execution** | Tier 2, Tier 3, Tier 6 | Visit abandonment detection (FR-05.2); patient absent after 15 min protocol (FR-05.9). |
| **FR-06 Payments & Reconciliation** | Tier 1, Tier 2, Tier 4, Tier 5 | Cryptographically signed idempotent webhooks (FR-06.2); 4-bucket reconciliation (FR-06.8). |
| **FR-07 Violations & Complaints** | Tier 2, Tier 3, Tier 5 | Severe complaint 4h temporary suspension (FR-07.4); clinical incidents segregated (FR-07.9). |
| **FR-08 Follow-Up Care** | Tier 3 | Tenant-restricted clinical history access (FR-08.2) — Should group. |
| **FR-09 Emergency SOS** | Tier 2, Tier 5, Tier 8 | Alert dispatch latency ≤ 10s; in-session SOS halts visit and bars on-site fees (FR-09.4). |
| **FR-10 Admin & Configuration** | Tier 2, Tier 3 | Effective-dated system configurations (FR-10.1, FR-10.2); clinical report schemas (FR-10.6, Q-49). |
| **FR-11 Schedulers & Notifications** | Tier 4, Tier 5 | Prohibition of SMS, zero PHI leakage (FR-11.1); timestamped escalation audit logging (FR-11.3). |

---

## 7. Test Data Architecture

- **Per-Test Dynamic Fixtures (`db/tests/src/fixtures.ts`):** Lightweight, isolated data factories generating prerequisite entities: hospital facility, service catalog with active pricing, test accounts with specific roles, patient profiles, and bookings in targeted lifecycle states.
- **Canonical Seed Dataset (`db/seeds/001_reference_and_demo.sql`):** Encounter **#MH-8824**—a single shared, standardized reference scenario utilized across development, E2E, and UAT (Da Nang General Hospital, base price 400,000 VND, 30% deposit 120,000 VND, scheduled slot 17:30–18:15). Maintaining disparate, inconsistent reference cases is strictly prohibited.
- **Mandatory Boundary Test Fixtures:**
  - Monetary values near the 50,000 VND floor and 30% fractional rounding points.
  - Timestamps bordering critical intervals: 2h, 12h, 24h, 72h, and 5 days.
  - Standardized symptom sets mapping to all 4 triage tiers with explicit `rule_version`.
  - GPS coordinates positioned directly on, inside, and outside service geofences.
  - Staff credentials with active, expiring, and lapsed practicing licenses.
- **Performance Load Data:** Synthetically generated data modeling ~300 visits/day concentrated during peak evening hours (17:00–21:30); cloning production patient databases is strictly banned (NFR-09.4).

---

## 8. Environments, CI Pipelines & Quality Gates

### Deployment Environment Stages
`Local Workstation` (Docker Compose: PostgreSQL 16 + Redis) → `CI Runner` (GitHub Actions) → `Staging Environment` (production-parity configuration, synthetic test data, actual pilot hospital pricing/shift configuration) → `Production Environment`.

### Mandatory CI Quality Gates (Every PR — `.github/workflows/ci.yml`)
1. **Compilation & Unit Suite:** Type checking and unit test suites must be 100% green.
2. **Database Verification Job:** Applies all database migrations against a clean PostgreSQL 16 instance and executes `db/tests`—must be 100% green.
3. **Automated Security Scanners:** Automated commit secret scanning and dependency vulnerability scanning (SEC-10.2)—any critical/high finding immediately blocks the build.
4. **Branch Coverage Threshold:** Enforce **≥ 80% decision branch coverage** across financial modules (BR-04, BR-18), violations (BR-01, BR-02), and authorization rules (BR-09) (NFR-09.1).
5. **Security Gate:** Pull requests touching sensitive domains (authentication, authorization, financial logic, clinical schemas) mandate explicit review and approval from a designated security reviewer (SEC-10.1).

### Test Entry Criteria
- User Story contains finalized Acceptance Criteria with unambiguous code traceability.
- Referenced specifications contain no unresolved contradictions.
- Target test environment and prerequisite synthetic fixtures are fully provisioned.

### Test Exit Criteria (Pilot Go-Live Sign-Off)
- All 69 Test Cases across the 27 Must User Stories pass successfully.
- Zero open defects of Blocker or Critical severity.
- CI security test suites are green; independent third-party penetration testing is complete with all Critical and High vulnerabilities remediated (SEC-10.3).
- PostgreSQL Point-in-Time Recovery (PITR) drill successfully validates RPO/RTO targets.
- Official UAT sign-off executed by partner hospital clinical and administrative leadership.
- Operational simulations executed successfully across all 4 standard incident playbooks (NFR-09.5).

### Defect Triage & Management
Defect severity is triaged based on business impact: financial precision, patient clinical safety, and data privacy constitute the highest severity. Every filed defect must cite its associated UC/BR baseline identifier. Any defect escaping to staging or pilot production must be converted into a mandatory regression test at the lowest viable test tier capable of catching it.

---

## 9. Roles & Responsibilities

| Project Role | Core Testing Responsibilities |
|---|---|
| **Software Engineers** | Author unit, database constraint, and API integration tests in tandem with feature code in the same PR; maintain green builds; update tests when specifications are formally revised. |
| **QA / Test Engineers** | Own E2E test suites, UAT scenario definitions, and traceability matrices; audit test coverage across Stories and Business Rules for every release milestone. |
| **Product Owner (PO)** | Finalize open decisions in Section 11; sign off on pilot go/no-go quality gates. |
| **Security Reviewer** | Review and sign off on PRs touching high-risk domains; manage penetration testing schedules and threat modeling sessions. |
| **Partner Hospital Team** | Conduct user acceptance testing (UAT), ratify clinical care report schemas (Q-49), participate in operational incident and emergency SOS response drills. |

---

## 10. Test Implementation Roadmap

1. **Phase 1 — Schema & Database Foundation (Completed):** Migrations and canonical seeds running cleanly on PostgreSQL 16; 17 database constraint tests passing; CI database pipeline operational. → Implement remaining page 15 constraints (3.1c/d/e, cancelled order CHECKs, refund voucher hashes).
2. **Phase 2 — Core API & Business Rules:** Implement unit tests per the Tier 2 rule coverage matrix (prioritizing BR-04, BR-18, BR-20/21, BR-09, BR-10); establish automated Tier 3 authorization matrix; build payment gateway contract tests.
3. **Phase 3 — Schedulers & Notification Pipelines:** Build Tier 5 background timer test suites for all business deadlines; verify transactional email and push notification channels per Tier 4.
4. **Phase 4 — Frontend & Client Applications:** Build Tier 6 Playwright E2E suites for happy path and exception journeys; execute elderly accessibility compliance audits.
5. **Phase 5 — Pre-Pilot Operational Hardening:** Execute third-party penetration testing (SEC-10.3), conduct PITR disaster recovery and incident runbook drills, and achieve formal hospital UAT sign-off (Tier 9).

---

## 11. Open Decisions Impacting Test Implementations

| Decision Code | Testing Impact | Current Interim Testing Handling | Resolution Dependency |
|---|---|---|---|
| **Q-03 Minimum In-Home Visit Fee** | `US-HP-25` cannot assert exact currency values. | Validate calculation mechanism using configuration parameters. | PO and hospital finance sign-off on amount. |
| **Q-44 Post-Admin Outcome in F1b** | Final resolution step in F1b / `US-HP-34` cannot be asserted. | Marked as `it.todo` referencing Q-44. | PO confirms proposed cell in `use_case_v8.1`. |
| **Q-12 / F5 In-Home Cash Handling** | Cash handling workflows outside pilot scope. | Untested; negative test asserts absence of cash options. | Cash scope activation. |
| **Q-11 Deposit Invoice Issuance Timing** | FR-06.7 lacks definitive timestamp trigger. | Verify invoice generation/credit adjustment mechanisms; omit strict timing assertions. | Hospital accounting sign-off. |
| **Q-49 Service-Specific Clinical Report Fields** | Clinical report validation tested only at schema framework level. | Validate schema framework and minimum required fields. | Hospital clinical departments ratify individual templates. |
| **Enum Dictionary & Two-Tier State Model Sign-Off** | Status transition tests currently evaluate proposed enums from ERD-2. | Test against current enums; upon ratification, execute centralized review via `packages/shared`. | PO sign-off (ADR-0003). |
| **5 Non-Functional Decisions** (Uptime SLA, RPO/RTO & budget, data residency & cross-border assessments under Decree 13, nurse app offline boundaries, SOS accidental click prevention) | Tier 8 quality metrics remain engineering proposals. | Tagged as `PENDING-NFR` in test suites. | PO and legal counsel sign-off per item. |
| **UC135 Retention vs. Decommissioning** | FR-04.11 currently untested. | Deferred in full; if approved, mandates threat modeling (SEC-10.4) prior to test creation. | Project leadership decision. |

---

*Core Guiding Principle: Testing strictly adheres to ratified baseline specifications. Unfinalized areas are tested at the mechanism level or tracked with explicit pending flags—never allow an unratified proposal to masquerade as verified truth simply because its automated test is green.*
