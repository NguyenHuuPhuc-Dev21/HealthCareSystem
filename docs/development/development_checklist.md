# Development & Engineering Checklist

> **Purpose:** When developing any capability, module, or line of code across the platform, follow this checklist to guarantee three non-negotiable standards: **business compliance** (BR-01–BR-23), **workflow integrity** (17 Activity Flows + ratified state machines), and **rigorous security** (BR-09, SEC-00–SEC-10).  
> **Authoritative Specification Hierarchy (in order of precedence in case of conflict):**  
> `use_case_diagram.drawio` → `workflow_diagram.drawio` → `docs/user_stories/` → `docs/requirement/` → `docs/business_rule/` → `docs/security/` → ERD / `docs/database/schema.sql`. Documentation governs code: in case of discrepancy, pause and request PO clarification—never invent unilateral interpretations in code.  
> **Related Architecture & Planning Documents:** Test Strategy [`docs/testing/test-strategy.md`](../testing/test-strategy.md), Local Development Setup `docs/dev-setup.md`, Architectural Decision Records in `docs/adr/`.  
> **Status:** Proposal awaiting sign-off on: (1) internal API module file structure upon backend framework selection; (2) two proposed documentation directories: `docs/api/` and `docs/runbooks/`. Phase breakdown maps directly to Epics A–I and FR-01–FR-11.  
> **Original Vietnamese Baseline:** Preserved in [`archive/development-checklist.vi.md`](archive/development-checklist.vi.md)

---

## 1. Golden Rules (Universal across all modules and commits)

### 1.1 Business Logic & Financial Precision (Non-Negotiable)

- [ ] **Traceability:** Every functional behavior must be traceable to at least one authoritative identifier (`UC`, `BR`, `US`, `FR`)—cite these codes in the module `README.md` and in pull request descriptions.
- [ ] **Zero Hardcoded Business Values:** Fees, split percentages, thresholds, SLAs, operational windows, and service radii must be loaded from effective-dated configuration stores (`system_parameter` table and hospital facility configurations per FR-10.1 / FR-10.2). Updating configuration values must never distort historic transaction records.
- [ ] **No Invented Defaults for Open Decisions (Decision Register Q):** For unratified parameters (Q-03 minimum visit fee, Q-11 deposit invoice timing, Q-44 post-admin outcome in F1b), code strictly at the mechanism/parameter level; Q-12/F5 cash dispute logic remains strictly blank with cash branches omitted.
- [ ] **Money Strictly via Append-Only Ledgers:** Every monetary movement must be recorded as an immutable journal entry in the `financial_entry` table (append-only); modifying (`UPDATE`) or deleting (`DELETE`) past transaction lines is strictly prohibited. Directly mutating cached account balances without compensating journal entries is forbidden.
- [ ] **Zero Platform Fund Escrow:** The SaaS platform **never holds or escrows funds**: patient deposits and balances flow directly into the hospital tenant's payment gateway merchant account (BR-05). Never create intermediate platform wallet or balance holding accounts.
- [ ] **Auditability of Automated Decisions:** Every automated timeout decision must emit an audit log capturing its F-code (BR-18), target deadline timestamp, actual decision timestamp, and business rationale.
- [ ] **Integer Monetary Precision:** All monetary amounts must be stored as exact non-negative integers in Vietnam Dong (VND); percentages and ratios must use precise integers or fixed-point decimals backed by boundary rounding test cases.

### 1.2 Workflows & State Machine Integrity

- [ ] **Flow Traceability:** Before implementing a feature, open its corresponding activity flow in `workflow_diagram.drawio` and trace each sequential step, decision diamond, timeout branch, and error handler.
- [ ] **Server-Enforced State Transitions:** Lifecycle transitions across Bookings, Care Visits, and Invoices must strictly adhere to the approved finite state machine (`packages/shared` enums + ERD page 14); illegal or out-of-order transitions must be rejected at the API layer (NFR-05.4), never trusting client-supplied status values.
- [ ] **Centralized Background Job Timers:** All business deadlines (15-minute deposit reservation window, T−24h/T−3h/T−2h reminders, 24h/72h/5-day SLAs, 5-minute SOS escalation) must be implemented via **shared background job queues** (FR-11.2). Ad-hoc in-process `setTimeout` calls or uncoordinated crons are prohibited; clients never calculate expiration timestamps.
- [ ] **Idempotent Operations:** All retriable endpoints (payment webhooks, scheduled background jobs, payment confirmations) must be **strictly idempotent**, enforced via business idempotency keys and database unique constraints.
- [ ] **Timezone Standards:** Store all timestamps in UTC; render all user-facing times in `Asia/Ho_Chi_Minh` (NFR-05.3).

### 1.3 Security & Access Control (SEC-00–SEC-10, BR-09)

- [ ] **Universal 4-Factor Server Authorization:** Every route accessing patient health records or financial data must independently enforce a four-factor validation on the backend: `Actor Role × Hospital Tenant × Relationship to Record × Entity Lifecycle State` (**BR-09**). Frontend UI hiding is merely visual ergonomics, never a security barrier.
- [ ] **Universal Tenant Boundary Injection:** Every database query must automatically enforce `WHERE hospital_id = :authenticated_hospital_id` at the repository layer—global "all-system" queries outside Platform Admin modules are prohibited.
- [ ] **Strict Input Whitelisting:** Validate all incoming parameters against strict whitelists at the API boundary; raw SQL string concatenation is strictly banned—enforce 100% parameterized queries.
- [ ] **Immutable Audit Logging:** Sensitive operations (patient record access, financial updates, account suspensions, dispute adjudications) must emit an immutable `audit_log` record: Actor ID, Timestamp, Target Entity ID, Action Type (FR-01.7). Application logs must never capture plain-text passwords, tokens, OTPs, or unnecessary Protected Health Information (PHI) (NFR-03.5).
- [ ] **Protected Clinical Media:** Store medical photos and prescription attachments in private storage buckets; download access is granted strictly via time-bounded **pre-signed URLs (validity ≤ 15 minutes)** generated only after server-side four-factor authorization validation (NFR-03.3); persist cryptographic content hashes.
- [ ] **Centralized Secrets Governance:** Third-party API keys, webhook signing secrets, and database credentials must be injected via runtime environment variables or cloud secret managers (NFR-03.6); never commit `.env` files or credentials to git repositories.
- [ ] **Prohibition of SMS & Phone Identifiers:** Do not use SMS, National ID (CCCD), or telephone numbers as identity authenticators anywhere in the system (BR-20). In-session codes (on-site check-in, add-on approvals) must be generated dynamically within client apps and segregated from account email OTPs—never transmit in-session verification codes via email.
- [ ] **Mandatory Security PR Gates:** Pull requests modifying authentication, authorization, payments, or clinical schemas mandate formal approval from a designated security reviewer accompanied by negative test cases (SEC-10.1).

### 1.4 Test Verification & Traceability (Test Strategy Alignment)

- [ ] **Test Tier Alignment:** Every newly developed module must implement automated tests at its corresponding tier defined in [`docs/testing/test-strategy.md`](../testing/test-strategy.md); financial, violation, and authorization modules must achieve **≥ 80% decision branch coverage** (NFR-09.1).
- [ ] **Traceable Test Naming:** Test files and test cases must incorporate authoritative codes (`UC`, `BR`, `US`, `FR`); decision branches awaiting formal sign-off must be marked `it.todo` referencing their Decision Q identifier rather than asserting fictitious expectations.

---

## 2. Directory Architecture & Naming Conventions

### 2.1 Repository Root Structure (Established Baseline)

```
apps/admin-web/        # Hospital Administration & SaaS Platform Web Portal (React)
apps/patient-web/      # Patient & Relative Web/PWA Application (React)
apps/nurse-app/        # Nurse Field Application (React Native)
services/api/          # Backend RESTful API (Node.js + TypeScript)
packages/shared/       # Shared enums, constants, DTO types (Single source of truth for status enums)
db/migrations/         # Sequential SQL schema migrations
db/seeds/              # Reference datasets & canonical sample scenarios (#MH-8824)
db/tests/              # PostgreSQL schema constraint test suites
docs/                  # Project specifications and architecture catalog
```

### 2.2 Standard Backend Module Architecture (`services/api/src/modules/<module-name>/`)

Module Directory Naming: **English, kebab-case, singular**, representing a discrete business capability (never named after raw database tables). Every module adheres to the standard file layout below:

| File Name | Architectural Responsibility |
|---|---|
| `README.md` | Module mission, authoritative UC/BR/US/Flow references, linked Decision Q codes, test instructions. |
| `<module-name>.routes.ts` | Route declarations, authentication and authorization middleware bindings; zero business logic. |
| `<module-name>.service.ts` | Pure business logic implementing authoritative Business Rules; the sole location for business decisions. |
| `<module-name>.repo.ts` | Data access layer (parameterized SQL, mandatory tenant filtering); the sole database interaction point. |
| `<module-name>.policy.ts` | Module-specific implementation of the BR-09 four-factor authorization policy. |
| `<module-name>.jobs.ts` | Background schedulers and timers registered with the shared job queue (only for modules with temporal logic). |
| `<module-name>.types.ts` | Data Transfer Objects (DTOs) and internal types; status enums imported strictly from `packages/shared`. |
| `<module-name>.schema.ts` | Strict whitelist request validation schemas for each route. |

*Cross-Cutting Core Components:* Generic utilities not bound to specific business domains belong in `services/api/src/core/` (e.g., database connection pool, audit logger, job queue engine, notification dispatchers, storage abstraction, error handlers). Never place business logic inside `core/`. Direct cross-module repository imports are prohibited—inter-module communication must proceed through domain services or asynchronous domain events.

*Module Test Locations:* Unit tests reside in `services/api/test/unit/<module-name>/`, integration tests in `services/api/test/integration/<module-name>/`, formatted as `<target>.test.ts` (e.g., `test/unit/br04-refund-policy.test.ts`).

### 2.3 Standard Frontend Feature Architecture (`apps/<app>/src/features/<feature-name>/`)

- Feature directory names must use kebab-case representing user journeys (e.g., `advance-booking`, `sos`, `care-report`).
- UI Components use PascalCase (e.g., `BookingSummary.tsx`); custom React hooks use `use-<name>.ts`.
- Network calls are centralized in a single `<feature-name>.api.ts` file within the feature—individual components must never execute arbitrary HTTP fetch calls.
- Frontend features never execute business calculations: pricing, deadlines, and action button permissions are authoritative responses from backend APIs; the frontend handles rendering and client-side ergonomic validation only.

### 2.4 Database & Documentation Standards

| Asset Type | File Naming Convention | Target Directory |
|---|---|---|
| **SQL Migrations** | `NNNN_<scope>_<short_description>.sql` (Incrementing integer prefix; never edit merged migrations—author a new forward migration) | `db/migrations/` |
| **Database Seeds** | `NNN_<name>.sql` | `db/seeds/` |
| **Schema Constraint Tests**| `constraints.<group>.test.ts` | `db/tests/tests/` |
| **Architecture Records** | `NNNN-<decision_title>.md` | `docs/adr/` |
| **Module API Contracts** | `<module-name>.api.md` | `docs/api/` *(Proposed new directory)* |
| **Standard Incident Runbooks**| `<incident_code>.md` (4 standard runbooks per NFR-09.5) | `docs/runbooks/` *(Proposed new directory)* |
| **Quality & Test Specs** | `<title>.md` | `docs/testing/` |
| **System Specifications** | Preserved in established directories (`business_rule/`, `requirement/`, `security/`, `user_stories/`) | `docs/` |

*Shared Business Enums & Constants:* Shared enums must be edited exclusively in `packages/shared/src/` (e.g., `enums.ts`)—this is the centralized audit point when the Product Owner formally ratifies the ERD state machine enums.

### 2.5 New Module Kick-Off Checklist

- [ ] Read all prerequisite specifications: associated Business Rules in `docs/business_rule/`, corresponding Activity Flow in `workflow_diagram.drawio`, User Story Acceptance Criteria, and linked FR and SEC policies.
- [ ] Enumerate open Decision Q codes touching the module and document the handling strategy (configuration parameter / `it.todo` / out of scope) in the module `README.md`.
- [ ] Scaffold the backend module per Section 2.2 and frontend feature per Section 2.3.
- [ ] Author test scaffolds (including traceable `it.todo` test cases) **prior to or alongside** feature code, aligned with the Test Strategy tiers.
- [ ] If the module introduces novel technical patterns (libraries, integration architecture), author an ADR in `docs/adr/` prior to broad adoption.

---

## 3. Development Phases & Milestones

Phase execution strictly follows business domain dependencies: Identity → Profiles & Config → Screening → Booking/Dispatch → Deposits → Visit Execution → SOS → Violations/Disputes → Admin & Analytics → Hardening & Pilot. Modules marked *(Should)* may be deferred to post-pilot releases without breaking core dependencies; unmarked modules are **Must** requirements for Pilot Q-23.

---

### Phase 0 — Shared Infrastructure Foundation

**Objective:** Establish the foundational core services upon which all business modules depend: database connection pooling, background job queue workers, audit logging, notification dispatchers, secure object storage, and environment configuration.

| Module / Component | Authoritative Source | Repository Location |
|---|---|---|
| `core/database` | ADR-0002 (SQL-First Architecture) | `services/api/src/core/database/` |
| `core/audit` | FR-01.7, BR-09 | `services/api/src/core/audit/` |
| `core/jobs` | FR-11.2, NFR-06.3 | `services/api/src/core/jobs/` |
| `core/notifications` | FR-11.1, BR-20 (Email + In-app Push only, strictly no SMS) | `services/api/src/core/notifications/` |
| `core/storage` | NFR-03.3 (Private buckets, pre-signed URLs) | `services/api/src/core/storage/` |
| `shared` (Enums, Currencies, Config Keys) | ERD page 14, NFR-05.1 | `packages/shared/src/` |
| Repo Infrastructure / CI / Docker | `docs/dev-setup.md`, SEC-10.2 | Repo root, `.github/workflows/` |

**Phase-Specific Quality Gates:**
- [ ] `audit_log` is append-only across both database permission tiers (in production) and application logic; direct SQL writes to audit tables outside the core audit writer are prohibited.
- [ ] Background job engine incorporates idempotency locks, dead-letter queues, and backlog alerting (NFR-09.3) from Day 1.
- [ ] Notification layer defines provider interfaces (Email / Push) to enable deterministic mocking; notification templates omit granular Protected Health Information (PHI) (NFR-04.4).
- [ ] CI pipeline executes all mandatory quality gates (Unit tests + PostgreSQL DB migration tests + Secret scanning).

**Phase Exit Criteria:** Docker Compose provisions PostgreSQL 16 + Redis; migrations and seeds apply cleanly; CI pipeline is green on empty PRs with sample test suites; `packages/shared` exports the complete set of ERD page 14 enums.

---

### Phase 1 — Accounts, Authentication & Consent (Epic A · FR-01, FR-02 · Flows 01–03)

| Module | Authoritative Source | Repository Location |
|---|---|---|
| `tenants` | FR-01.8 (Hospital facility creation + root administrator provisioning) | `services/api/src/modules/tenants/` |
| `accounts` | FR-01.1, BR-20 (Email registration, 5 min OTP, 15 min password reset) | `services/api/src/modules/accounts/` |
| `auth` | FR-01.2, R-L03 (Shared 5-failure / 15 min lockout), session token management | `services/api/src/modules/auth/` |
| `staff-2fa` | FR-01.3, BR-20/21 (Mandatory 2FA for staff roles) | `services/api/src/modules/staff-2fa/` |
| `staff-credentialing` | FR-01.4/01.5, BR-21, UC139, Q-50 (2-step approval, profile state machine, license expiration scan) | `services/api/src/modules/staff-credentialing/` |
| `consent` | FR-02.2/02.3/02.4, BR-17, Q-47 (Profile-specific consent, relative email link, revocation, re-consent on terms update) | `services/api/src/modules/consent/` |
| `privacy-erasure` | FR-02.5, BR-12 (72h erasure / anonymization pipeline + deadline scheduler) | `services/api/src/modules/privacy-erasure/` |

*Client Interfaces:* `apps/patient-web/src/features/auth/`, `features/consent/`; `apps/admin-web/src/features/staff-onboarding/`, `features/tenant-onboarding/`.

**Phase-Specific Quality Gates:**
- [ ] Staff profiles not yet validated under UC139 clinical confirmation must **never** appear in nurse dispatch candidate pools (asserted via test, US-HP-04).
- [ ] Self-service account recovery via support call centers is prohibited for staff accounts (US-HP-05 AC-03).
- [ ] Relative consent email links: strictly scoped to a single patient profile/booking, time-limited, single-use; dispatch coordinators have zero permission to click on behalf of relatives (US-HP-02).
- [ ] Consent revocation handled gracefully per booking lifecycle state (unassigned → cancel + 100% refund; en route/in-session → safe termination) (FR-02.3).
- [ ] Verification Tiers: Tier 1 (CHECK 2FA, unique consent constraints), Tier 2 (BR-20/21, R-L03), Tier 3 (Permission matrix), Tier 7 (CI security test suite).

**Phase Exit Criteria:** All Test Cases for US-HP-01–05 pass at the API integration layer; a sample staff profile completes the full BR-21 onboarding lifecycle on the staging environment.

---

### Phase 2 — Patient Profiles, Catalog & Hospital Configuration (Epic B partial · FR-02, FR-04.2, FR-10 · Flow 02)

| Module | Authoritative Source | Repository Location |
|---|---|---|
| `patient-profiles` | FR-02.1, BR-17 (Multiple profiles per account, self-declared relationship, no national ID/CCCD) | `services/api/src/modules/patient-profiles/` |
| `facilities` | BR-06 (Facility records, service geofence boundaries) | `services/api/src/modules/facilities/` |
| `service-catalog` | FR-04.2, FR-10.1 (Service offerings, tiered pricing, prescription-required flag — catalog Q-13) | `services/api/src/modules/service-catalog/` |
| `hospital-config` | FR-10.1/10.2 (Effective-dated configurations: pricing, geofences, revenue split, BR-03 operating hours, SLAs, SOS endpoints Q-48) | `services/api/src/modules/hospital-config/` |
| `merchant-accounts` | FR-10.3, BR-05 (Hospital payment gateway merchant integrations) | `services/api/src/modules/merchant-accounts/` |
| `clinical-form-templates` | FR-10.6, BR-22, Q-49 (Service-specific clinical form schemas, mandatory fields) | `services/api/src/modules/clinical-form-templates/` |
| `doctor-assignment` *(Should)* | FR-02.6, BR-09 (Attending doctor assignment, time-limited clinical history access) | `services/api/src/modules/doctor-assignment/` |

**Phase-Specific Quality Gates:**
- [ ] All configuration entities must enforce `effective_from` / `effective_to` fields; configuration lookups must always query by target business event timestamp, never blindly fetching the "latest" row.
- [ ] Nurse-specific operating zones (`nurse_service_area`): enabled only if formally ratified by PO; otherwise, dispatch boundaries default strictly to facility geofences (BR-06).
- [ ] Clinical care report schemas: technical validation frameworks implemented first, with medical fields ratified by hospital clinical leadership (Q-49)—never invent clinical fields in code.
- [ ] Verification Tiers: Tier 1 (Unique configuration constraint 3.1d), Tier 2 (BR-06, BR-17), Tier 3.

**Phase Exit Criteria:** The pilot hospital's complete master catalog and configuration dataset can be initialized via administrative APIs/web portals without manual database updates.

---

### Phase 3 — Symptom Screening & Clinical AI Assistance (FR-03 · BR-10, BR-15 · Flow 04)

| Module | Authoritative Source | Repository Location |
|---|---|---|
| `screening` | FR-03.1/03.2/03.3, BR-10 (4-tier triage rule engine with `rule_version`; 1-to-many event records per booking; Emergency blocks booking + 115/SOS guidance; updates permitted to T−1h, self-downgrading prohibited) | `services/api/src/modules/screening/` |
| `screening-review` | FR-03.4, BR-10, Q-21 (AI failure / timeout / low confidence → on-duty doctor triage; SLA breach guidance to contact hospital) | `services/api/src/modules/screening-review/` |

**Phase-Specific Quality Gates:**
- [ ] Screening outcomes are persisted as **immutable, reproducible event records**; re-screening generates a new event record linked via `supersedes` (ERD 8.11); ad-hoc boolean flags like "needs_re_screening" are prohibited.
- [ ] Clinical AI boundaries strictly enforced: no definitive medical diagnosis, no drug prescribing, no refund approvals; all outputs disclose uncertainty scores and human escalation paths (FR-03.6).
- [ ] Standardized symptom fixtures covering all 4 triage tiers are formally validated by clinical stakeholders (Tier 2 test fixtures).
- [ ] Verification Tiers: Tier 1 (Constraint 3.1a: multiple emergency updates generate exactly one booking cancellation and one 100% refund order), Tier 2 (BR-10), Tier 8 (AI outage graceful degradation, NFR-02.3).

**Phase Exit Criteria:** Test bookings flagged as Emergency are reliably blocked and trigger a single refund order; taking the AI service offline successfully fails over to on-duty doctor triage.

---

### Phase 4 — Booking, Nurse Matching & Dispatch (Epic C · FR-04 · BR-01, BR-03, BR-13, BR-14 · Flows 04–06)

| Module | Authoritative Source | Repository Location |
|---|---|---|
| `bookings` | FR-04.1 (Advance booking T+2h to T+14 days, cap of 3 active bookings, BR-14 debt check, service geofence) | `services/api/src/modules/bookings/` |
| `prescription-verification` | FR-04.12, BR-15 (Prescription attachment upload, 30-minute doctor verification SLA) | `services/api/src/modules/prescription-verification/` |
| `nurse-availability` | FR-04.4, BR-03 (14-day rolling availability schedule, online dispatch toggle) | `services/api/src/modules/nurse-availability/` |
| `matching` | FR-04.3, BR-01 (Hard filtering on skills/shifts/zones + 30-minute nurse acceptance window, conditional slot hold) | `services/api/src/modules/matching/` |
| `rematching` | FR-04.6, BR-13, Q-19 (Nurse cancellation triggers new match cycle based on remaining lead time; patient options; SLA breach defaults) | `services/api/src/modules/rematching/` |
| `manual-dispatch` | FR-04.7 (Coordinator manual dispatch fallback upon automated matching failure) | `services/api/src/modules/manual-dispatch/` |
| `booking-cancellation` | FR-04.8, BR-04 (Patient-initiated cancellation, tiered refund schedule; Admin exceptional 100% refund approval) | `services/api/src/modules/booking-cancellation/` |
| `booking-reminders` | FR-04.5, BR-13 (Schedulers: T−24h booking reminder, T−3h nurse reconfirmation with T−2h deadline, T−2h symptom update prompt; non-confirmation triggers rematch) | `services/api/src/modules/booking-reminders/` |
| `rescheduling` *(Should)* | FR-04.9, BR-13 (Maximum 2 reschedules per booking preserving deposit, eligible > 2h lead time) | `services/api/src/modules/rescheduling/` |

*Explicitly Excluded:* Instant booking / fast matching (FR-04.10, BR-08) and assisted hotline booking (FR-04.11, R-UC135) are **not implemented** in the pilot; if approved later, UC135 mandates structured threat modeling (SEC-10.4) in a dedicated milestone.

**Phase-Specific Quality Gates:**
- [ ] Nurse matching candidate filters strictly exclude: unapproved staff (lacking UC139 approval), staff with active violation suspensions, schedule overlaps (enforced via database `EXCLUDE` constraints), and addresses outside service geofences.
- [ ] Nurse cancellation during patient deposit hold triggers a new 15-minute matching cycle and immediately logs 1 minor violation (Q-41/Q-45, BR-01).
- [ ] Verification Tiers: Tier 1 (EXCLUDE constraints preventing overlapping shifts and duplicate bookings on same profile, BR-16 child booking exceptions), Tier 2 (BR-01/03/13/14), Tier 5 (All reminder and confirmation schedulers), Tier 6 (Advance booking user journey).

**Phase Exit Criteria:** End-to-end advance booking workflow progresses reliably to "Deposit Pending" state on staging using pilot hospital fixtures.

---

### Phase 5 — Deposits, Payments, Ledgers & Reconciliation (Epic D · FR-06 · BR-04, BR-05, BR-18 partial · Flows 04, 10, 11)

| Module | Authoritative Source | Repository Location |
|---|---|---|
| `deposits` | FR-06.1, BR-04 (30% deposit, min 50,000 VND, 15-minute hold window, auto-cancellation scheduler) | `services/api/src/modules/deposits/` |
| `gateway-webhooks` | FR-06.2, BR-05 (HMAC-SHA256 signature verification, idempotent transaction matching) | `services/api/src/modules/gateway-webhooks/` |
| `ledger` | FR-06, BR-04/05 (Append-only journal entries; priority deposit allocation to disputed lines — Q-30) | `services/api/src/modules/ledger/` |
| `settlements` | FR-06.3, FR-05.11, BR-04, Q-33 (2-tier itemized bill approval; remaining balance settlement; 24h grace period converting to outstanding debt) | `services/api/src/modules/settlements/` |
| `refunds-auto` | FR-06.4, BR-04 (Automated tiered refund processing: 100/50/0%; hospital fault or emergency screening = 100%) | `services/api/src/modules/refunds-auto/` |
| `refunds-manual` | FR-06.5, UC90 (Manual post-settlement refund orders backed by cryptographic voucher hashes) | `services/api/src/modules/refunds-manual/` |
| `reconciliation` | FR-06.8, BR-04/05, F7 (End-of-period 4-bucket deposit reconciliation; discrepancy opens ticket; manual statement upload fallback) | `services/api/src/modules/reconciliation/` |
| `einvoice` | FR-06.7, BR-04, Q-11 (Electronic invoice issuance for remaining balance; adjusted credit notes upon refund) | `services/api/src/modules/einvoice/` |
| `patient-transactions`| FR-06.12 (Patient transaction portal for viewing payment receipts and invoices) | `services/api/src/modules/patient-transactions/` |
| `commission` *(Should)* | FR-06.9, BR-05 (Platform commission calculation per completed visit, monthly invoice generation) | `services/api/src/modules/commission/` |
| `nurse-payouts` *(Should)*| FR-06.10 (Nurse compensation ledgers, payout breakdown, trust scores) | `services/api/src/modules/nurse-payouts/` |

*Explicitly Excluded:* In-home cash collection flows (FR-06.11) are **omitted** from the pilot (Q-23, Q-12); all collections proceed via online gateways.

**Phase-Specific Quality Gates:**
- [ ] Webhooks: Invalid HMAC signatures are rejected with high-priority security logs; duplicate deliveries execute exactly once (verified via Tier 7 concurrent stress tests).
- [ ] Every refund order is traceable to: original fee item, formal decision authority (BR-04 automated or UC90 manual), voucher metadata, and append-only ledger entry.
- [ ] 4-Bucket Reconciliation: Deducted + Refunded + Retained + Disputed Escrow must mathematically equal Gross Deposit Receipts; any variance is a Blocker defect (FR-06.8).
- [ ] Verification Tiers: Tier 1 (Constraint 3.1b payment idempotency), Tier 2 (BR-04, BR-18 Table F), Tier 4 (Payment gateway contract), Tier 5 (15-min and 24-h schedulers).

**Phase Exit Criteria:** The complete financial lifecycle (deposit → visit execution → itemized billing → settlement → reconciliation) balances with zero discrepancy against reference encounter #MH-8824.

---

### Phase 6 — Home Care Visit Execution (Epic E · FR-05 · BR-07, BR-15, BR-16, BR-22 · Flows 07, 07A, 07B)

| Module | Authoritative Source | Repository Location |
|---|---|---|
| `session-briefing` | US-HP-18 (Nurse pre-visit clinical briefing; access revoked immediately upon visit reassignment/cancellation) | `services/api/src/modules/session-briefing/` |
| `departure-tracking` | FR-05.1/05.2, BR-07 (Departure deadline via ETA, 10–15s GPS streaming, abandonment detection, max 2 delay requests × 15 min) | `services/api/src/modules/departure-tracking/` |
| `checkin` | FR-05.3, BR-07/20 (Geofence + in-app dynamic code; fallback: geofenced photo + patient confirmation with 24h audit) | `services/api/src/modules/checkin/` |
| `initial-assessment` | FR-05.4, BR-22 (Mandatory initial clinical assessment form tailored to service type) | `services/api/src/modules/initial-assessment/` |
| `session-addons` | FR-05.5, BR-15 (In-session add-ons: Class A minor / Class B hospital approval ≤ 10 min / Class C session stop + SOS; billable items mandate patient confirmation) | `services/api/src/modules/session-addons/` |
| `care-reports` | FR-05.6/05.7, BR-22 (Mandatory care reports with two-stage "Ended" / "Completed" status; 2h reminder scheduler; 24h dispatch suspension; record saved to hospital medical file) | `services/api/src/modules/care-reports/` |
| `session-stop` | FR-05.8, BR-16, F9 (Mid-session termination: coded reason, prorated billing, mandatory termination report, immediate fee collection except emergency/safety; hospital 24h review; post-audit of unsafe claims Q-46; unperformed scope re-issued as zero-deposit child booking) | `services/api/src/modules/session-stop/` |
| `patient-absent` | FR-05.9, BR-07 (Patient absent protocol after 15 minutes of verified on-site presence; zero nurse penalty) + minimum fee mechanism F3 (Q-03) | `services/api/src/modules/patient-absent/` |
| `in-app-contact` *(Should)* | FR-05.10, UC133, BR-20 (Masked in-app chat and VoIP calling, zero phone number exposure) | `services/api/src/modules/in-app-contact/` |

*Client Interfaces:* `apps/nurse-app/src/features/` (briefing, departure, check-in, assessment, add-ons, care-report, session-stop); `apps/patient-web/src/features/visit-tracking/`, `features/addon-confirmation/`.

**Phase-Specific Quality Gates:**
- [ ] Nurse mobile application: Background GPS streaming and geofence verification must be tested on physical hardware (not solely emulators); battery drain must remain ≤ 5%/hour (NFR-01.3).
- [ ] Submitting a care report is a mandatory blocker for visit completion across **both** API services and frontend interfaces (BR-22).
- [ ] In-session verification codes are generated in-app with short validity windows and attempt limits, logging failed entries (US-HP-19).
- [ ] Verification Tiers: Tier 2 (BR-07/15/16/22), Tier 3 (Immediate briefing access revocation), Tier 5 (Care report reminder, termination review deadline), Tier 6 (Visit execution journey), Tier 8 (GPS accuracy and low-connectivity tests).

**Phase Exit Criteria:** A complete sample visit executes from nurse departure to care report and itemized billing sign-off on physical mobile devices, including visit termination and patient absent branches.

---

### Phase 7 — SOS & Emergency Response (Epic F · FR-09 · BR-23, Q-48 · Flow 17)

| Module | Authoritative Source | Repository Location |
|---|---|---|
| `sos` | FR-09.1/09.2/09.3/09.4, BR-23, UC140 (Always-accessible emergency trigger; guidance displaying 115 without automated dialing; immediate push alert to hospital on-duty team; mandatory incident resolution logging) | `services/api/src/modules/sos/` |
| `sos-escalation` | BR-23, Q-48 (5-minute escalation scheduler to backup emergency leads; sequential `sos_escalation_event` logging; in-session SOS halts visit and bars on-site fee collection) | `services/api/src/modules/sos-escalation/` |

**Phase-Specific Quality Gates:**
- [ ] Latency from SOS tap to on-duty push notification delivery must remain ≤ 10 seconds (P95)—measured in Tier 8; push uses direct channels independent of email queues (US-HP-36 AC-03).
- [ ] Accidental tap prevention (5-second cancel countdown per NFR-07.4) is enabled only upon formal PO sign-off; never introduce blocking confirmation dialogs that delay alert transmission.
- [ ] Every SOS incident records: activation timestamp, initiator identity, location coordinates (if authorized), triage acknowledgment timestamp, escalation events, and resolution closure notes.
- [ ] Verification Tiers: Tier 2 (BR-23), Tier 5 (5-minute escalation timer), Tier 8 (Alert delivery latency), Tier 9 (UAT operational simulation drill).

**Phase Exit Criteria:** End-to-end SOS simulation with hospital emergency teams: trigger → on-duty notification in ≤ 10s → acknowledgment within 5 min → incident closure; and unacknowledged simulation successfully escalating to backup contacts.

---

### Phase 8 — Violations, Complaints & Financial Disputes (Epic G + H · FR-07, FR-06.6 · BR-01, BR-02, BR-11, BR-18, BR-19 · Flows 08, 12)

| Module | Authoritative Source | Repository Location |
|---|---|---|
| `violations` | FR-07.1/07.2, BR-01/02, F6 (Violation tracking across rolling windows, automated dispatch locks; 24h abandonment auto-unlock Q-43 operates independently of 72h disciplinary review; platform provides technical locks only) | `services/api/src/modules/violations/` |
| `complaints` | FR-07.3/07.4, BR-11 (30-day complaint filing window; 24h line-item dispute window; severe complaint triggers nurse dispatch hold with 4h hospital confirmation SLA; verbatim forwarding to hospital) | `services/api/src/modules/complaints/` |
| `fee-disputes` | FR-06.6, BR-18 F1a/F1b (Unsettled fee lines → F1a: 5-day hospital timeout triggers automated fee waiver; settled fee lines disputed within 24h → F1b: manual refund order UC90, hospital timeout escalates to Platform Admin, **no** automated waiver) | `services/api/src/modules/fee-disputes/` |
| `platform-arbitration` | US-HP-34, BR-18 F1b, Q-44 (Platform Admin adjudicates within 3 business days; post-decision default awaits PO confirmation—code up to escalation and SLA tracking) | `services/api/src/modules/platform-arbitration/` |
| `complaint-appeals` *(Should)* | FR-07.5/07.6, BR-11, F4 (Single-tier appeal adjudicated by independent reviewer; platform-level complaint handling) | `services/api/src/modules/complaint-appeals/` |
| `abuse-flags` *(Should)* | FR-07.7, BR-19 (Account-level abuse flag tracking over 90-day rolling window, 7-day notification and rebuttal window) | `services/api/src/modules/abuse-flags/` |
| `nurse-safety-reports` *(Should)* | FR-07.8, BR-11 (Nurse reporting unsafe working conditions or patient harassment) | `services/api/src/modules/nurse-safety-reports/` |
| `adverse-incidents` | FR-07.9, BR-11, UC134 (In-home adverse clinical incidents segregated from customer service complaints, initiating immediate clinical response protocols) | `services/api/src/modules/adverse-incidents/` |

**Phase-Specific Quality Gates:**
- [ ] Table BR-18 implemented as a **data-driven decision table** covering F1a–F9 (excluding F5); each decision rule accompanied by dedicated tests per Tier 2 of the Test Strategy.
- [ ] Nurse account locks and unlocks must be timestamped event records citing the authoritative rule or human decision maker (US-HP-29).
- [ ] Verification Tiers: Tier 2 (BR-01/02/11/18/19), Tier 5 (All SLA timers: 4h, 24h, 72h, 5 days, 3 business days—correctly distinguishing business days from calendar days).

**Phase Exit Criteria:** Three dispute scenarios execute successfully on staging: F1a automated fee waiver upon timeout; F1b manual refund order; F1b timeout escalating to Platform Admin adjudication.

---

### Phase 9 — Administration, Analytics, Follow-Up & Notifications (Epic H, Epic I · FR-08, FR-10.4/10.5, FR-11 · Flows 13, 15)

| Module | Authoritative Source | Repository Location |
|---|---|---|
| `admin-dashboards` | FR-10.4 (Hospital tenant dashboard + Multi-tenant SaaS dashboard; real-time monitoring of overdue queues: BR-18, 72h data erasure, complaint SLAs) | `services/api/src/modules/admin-dashboards/` + `apps/admin-web/src/features/` |
| `analytics-reports` *(Should)* | FR-10.5 (Nurse clinical performance metrics, service category revenue reporting) | `services/api/src/modules/analytics-reports/` |
| `follow-up` *(Should)* | FR-08.1/08.2, FR-03.5, Flow 13 (Automated follow-up recommendation from post-visit risk evaluation; doctor care plan approval; clinical history access locked to doctor's hospital) | `services/api/src/modules/follow-up/` |
| `notification-events` | FR-11.1/11.3, US-HP-36 (Consolidated event-to-channel-to-template matrix across Flows 04–15, 17; timestamped audit logging of escalation transmissions and receipts) | `services/api/src/modules/notification-events/` |
| `history-lookup` *(Should)* | US-HP-35, US-HP-37 (Audit trail and financial decision tracing; patient historical booking and care report portal) | `services/api/src/modules/history-lookup/` |

**Phase-Specific Quality Gates:**
- [ ] Administrative dashboards strictly restrict visibility to the viewer's hospital tenant (except Platform Admin roles)—enforced via backend authorization tests.
- [ ] Final notification template audit: zero granular Protected Health Information (PHI), zero SMS delivery, plain Vietnamese medical terminology (NFR-07.3).
- [ ] Verification Tiers: Tier 3, Tier 6, and traceability verification across all Should stories incorporated into this milestone.

**Phase Exit Criteria:** A full operational day simulated exclusively through administrative web interfaces without manual database edits: resolving overdue queues, reviewing reconciliations, and querying audit logs.

---

### Phase 10 — Hardening, Non-Functional Testing & Pilot Readiness

This phase introduces zero new business scope; it hardens the system from "functionally complete" to "production-grade and resilient":

- [ ] **Security Hardening:** Complete CI security test suite (SEC-10.2), threat modeling for implemented capabilities, **independent third-party penetration testing** prior to go-live (SEC-10.3) with all Critical and High vulnerabilities remediated; configuration audits of TLS cipher suites, volume encryption, and secret rotation playbooks (NFR-03).
- [ ] **Performance & Stress Testing:** Load testing under peak-hour volumes and 5× surges using k6 scenarios defined in Tier 8 of the Test Strategy (NFR-01, NFR-06).
- [ ] **Disaster Recovery Drills:** Execute PostgreSQL Point-in-Time Recovery (PITR) drills satisfying RPO ≤ 1 hour and RTO ≤ 4 hours (NFR-02.2); test graceful degradation pathways (simulating AI engine downtime, payment gateway failure, GPS loss per NFR-02.3).
- [ ] **Observability & Playbooks:** Operational health dashboards and alerting configured (queue depth spikes, webhook failures, OTP delivery drops, unacknowledged SOS events > 5 min per NFR-09.3); author and rehearse the 4 standard incident runbooks in `docs/runbooks/` (NFR-09.5).
- [ ] **Tenant Isolation Verification:** Final penetration audit confirming zero cross-tenant data leakage; staging environment verified strictly against synthetic data fixtures (NFR-09.4).
- [ ] **UAT & Pilot Sign-Off:** Fulfill all Test Strategy exit criteria (Section 8): 69 Must Test Cases passing, zero open Blocker/Critical defects, formal UAT sign-off executed by hospital leadership.

**Phase Exit Criteria:** Official Pilot Go-Live Authorization signed by the Product Owner and hospital leadership; deferred scope items (Should group, UC135, F5) formally documented as out-of-scope for the pilot milestone.

---

## 4. Pre-Merge Pull Request Quality Gate (Mandatory across all phases)

Every pull request must fulfill this verification checklist prior to merging into main branches:

- [ ] **Authoritative Traceability:** The PR description clearly enumerates the touched `UC`, `BR`, `US`, and `FR` codes, the development phase/module, and referenced Decision Q codes.
- [ ] **Zero Hardcoded Business Values:** No hardcoded rates, fees, or thresholds; zero status enums defined outside `packages/shared`.
- [ ] **Enforced 4-Factor Authorization:** New and modified routes implement backend authorization checks (**BR-09**) accompanied by negative test cases (wrong role or wrong tenant asserts HTTP `403` or `404`).
- [ ] **Idempotent Operations:** Financial mutations and state transitions are idempotent and covered by automated test cases; double-entry ledger records and audit events are emitted.
- [ ] **Test Suite Passing:** All module tests are green; financial, violation, and authorization modules maintain **≥ 80% decision branch coverage**.
- [ ] **CI Pipeline Green:** All automated CI checks (unit tests, PostgreSQL DB constraint suites, secret scanners, dependency auditors) pass cleanly—security failures block merging (SEC-10.2).
- [ ] **Security Review Sign-Off:** Pull requests modifying authentication, authorization, financial logic, or clinical schemas have formal sign-off from a designated security reviewer (SEC-10.1).
- [ ] **Documentation Synchronization:** Accompanying documentation is updated: module `README.md`, `docs/api/<module>.api.md` (if API contracts changed), and ADRs (if new technical decisions were introduced).

---

*Core Guiding Principle: Follow the dependency chain in strict order; every completed module must be independently runnable and testable. When specifications and code diverge, the ratified specifications prevail—unratified proposals must remain explicitly flagged, never assumed.*