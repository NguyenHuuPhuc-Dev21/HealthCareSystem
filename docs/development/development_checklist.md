# Development & Engineering Checklist

> **Purpose:** When developing any capability, module, or line of code across the platform, follow this checklist to guarantee three non-negotiable standards: **business compliance** with the governing SRS (FR groups, §5 configuration & SLA matrix), **workflow integrity** (the three-axis booking state machine and the nurse/wallet lifecycles), and **rigorous security** (tier hard-gate, OTP + 2FA, record-access windows, private media).
> **Governing Baseline:** *SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)* — a marketplace connecting patients/families with retired medical staff and newly graduated nursing students; **no hospital tenants**.
> **Authoritative Specification Hierarchy (in order of precedence in case of conflict):**
> 1. **SRS v2.0 (Updated, 28/10/2026)** — FRs (§4), configs & SLA (§5), NFRs (§6), schema (§7), APIs (§8), integrations (§9), RTM (§10)
> 2. `docs/requirement/` — as revised per SRS v2.0
> 3. `docs/business_rule/` — as revised per SRS v2.0
> 4. `docs/user_stories/` — as revised per SRS v2.0
> 5. `docs/security/` — as revised per SRS v2.0
>
> Documentation governs code: in case of discrepancy, pause and request Product Owner clarification — never invent unilateral interpretations in code. Points the SRS leaves open are tracked in the Test Strategy (Section 11) and must be implemented at mechanism level, never with invented values.
> **Related Documents:** Test Strategy [`docs/testing/test-strategy.md`](../testing/test-strategy.md), Local Development Setup `docs/dev-setup.md`, Architectural Decision Records in `docs/adr/`.
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version.
> **Original Vietnamese Baseline:** Preserved in [`archive/development-checklist.vi.md`](archive/development-checklist.vi.md)

---

## 1. Golden Rules (Universal across all modules and commits)

### 1.1 Business Logic & Financial Precision (Non-Negotiable)

- [ ] **Traceability:** Every functional behavior must be traceable to at least one SRS identifier (`FR-…`, `CT-…`, a §5 config key, or an RTM `TC-…`) — cite these codes in the module `README.md` and in pull request descriptions.
- [ ] **Zero Hardcoded Business Values:** Every business number lives in the `system_configs` table (SRS §5.1) and is read at runtime: `PLATFORM_COMMISSION_RATE = 0.15`, `MIN_NURSE_DEPOSIT = 300000`, `SURCHARGE_NIGHT_SHIFT = 0.20`, `SURCHARGE_HOLIDAY_MAJOR = 3.00`, `SURCHARGE_HOLIDAY_MINOR = 2.00`, `SURCHARGE_HEAVY_PATIENT = 0.15`, `PAYMENT_TIMEOUT_MINUTES = 15`, `SETTLEMENT_COOLING_HOURS = 24`, `CHECKIN_MAX_RADIUS_METERS = 200`, `ICU_TRAVEL_SUPPORT = 50000`, `NO_SHOW_PENALTY = 50000`. Changing a config value must reprice new bookings with no restart/redeploy (TC-PRICE-01); amounts already stored on a booking never change retroactively.
- [ ] **Money Strictly via the Wallet Ledger:** Every monetary movement is an append-only entry in `wallet_transactions` carrying a unique `idempotency_key`, `balance_before`, and `balance_after`. `UPDATE`/`DELETE` on past transactions is strictly prohibited; corrections are compensating entries. Balances in `wallets` change only through the ledger service, inside an ACID transaction with row locking (`SELECT … FOR UPDATE`) or a Redis distributed lock (NFR-SEC-01).
- [ ] **The Two Payment Methods Never Mix:** `BANK_TRANSFER` = the customer prepays 100% and the platform ledger holds the funds (`ESCROW_HELD`) until settlement. `CASH` = the customer pays the nurse on site; the platform never holds the shift price; the nurse self-pays the 15% commission via the generated payment link (a `COMMISSION_PAYMENT` ledger event on the platform side). Any cash above the in-app price is the nurse's tip and is never commissioned (FR-PAY-01).
- [ ] **Deposit Discipline (FR-PAY-03):** `deposit_balance` is used **only** to deduct SLA penalties (`PENALTY_DEDUCT`: late cancel, no-show, upheld-complaint penalties). It must **never** be used to collect the cash-order commission, and never to settle any other charge. A nurse may accept jobs only while `deposit_balance ≥ 300,000`; a penalty that exceeds the balance is booked as debt (negative balance) and blocks new jobs until topped up. There is no progressive deposit build-up and no cap on bookable shift value.
- [ ] **Simulated-Escrow Honesty (§1.3):** In MVP, escrow is an internal ledger combined with sandbox gateways (PayOS / VNPay / VietQR). Code, UI copy, and reports must not represent it as licensed escrow; live commercial operation requires a State-Bank-licensed payment intermediary.
- [ ] **Integer Monetary Precision:** All amounts are exact integers in VND; rates are fixed-point decimals read from config. Pricing arithmetic is covered by the boundary cases of the Test Strategy (Tier 2), including the SRS worked examples (580,000 VND night shift; 2,000,000 VND Tết shift; 425,000 VND settlement credit).
- [ ] **Auditability of Automated Decisions:** Every automated money or status decision (settlement release, penalty deduction, tier demotion, suspension) emits an `audit_logs` record with actor, `action_type`, old/new values, and timestamp (§7 table 16).

### 1.2 Workflows & State Machine Integrity

- [ ] **Three-Axis Booking State Machine (§2.2):** `execution_status`, `payment_status`, and `dispute_status` evolve **independently** and only through server-enforced transitions; illegal or out-of-order transitions are rejected at the API layer; client-supplied status values are never trusted. In MVP flows, `PARTIALLY_SETTLED` and `RESOLVED_PARTIAL` are unreachable (adjudication is Phase 2, FR-DISP-02) although the enum values exist in the schema.
- [ ] **`profile_status` Is the Single Source of Truth:** Job-acceptance eligibility is decided from `nurse_profiles.profile_status` (plus tier and deposit checks) — never from `users.status` or `users.kyc_status` (TC-DB-01).
- [ ] **Tier Hard-Gate in the Backend on Every Invasive-Service Path:** Any path that can connect a nurse to a service with `is_invasive = true` — booking creation validation, search results, Radar dispatch, Job Board listing, direct invite, and the accept endpoint — enforces `tier = TIER_2_SPECIALIST` with a valid, in-scope GPHN on the server and returns **HTTP 403** otherwise. Services with `is_prohibited = true` cannot be booked at all. Frontend hiding is ergonomics, never enforcement.
- [ ] **GPHN Lifecycle Automation (§2.3, FR-AUTH-02):** On GPHN expiry without an approved renewal, the system demotes `TIER_2_SPECIALIST → TIER_1_BASIC` (profile stays `ACTIVE`); invasive `CONFIRMED` bookings scheduled after the expiry date are auto-cancelled without penalty and re-dispatched. Re-upgrade happens only after an Admin approves the newly uploaded GPHN (with `reviewed_by` recorded). A retirement decision is a supporting badge document only — it never opens invasive services.
- [ ] **All Timers via the Shared Job Queue:** Payment timeout (15 min), matching expiry, Radar radius expansion (5 min), direct-invite timeout (15 min), settlement release (check-out +24h), record-access closure (check-out +12h), cash-commission deadline (check-out +24h), daily GPHN expiry sweep, rating-visibility release (both-submitted or 7 days), push-acknowledgement fallback (60 s). Ad-hoc in-process `setTimeout` calls or uncoordinated crons are prohibited; clients never calculate deadlines.
- [ ] **Idempotent Operations:** Webhooks, job executions, commission confirmations, and the accept race (first accept wins, enforced by Redis lock / `SELECT … FOR UPDATE`) must be strictly idempotent — a repeated execution moves no money and changes no state twice.
- [ ] **Timezone & Segment Standards:** Store all timestamps in UTC; render user-facing times in `Asia/Ho_Chi_Minh`. The night window (22:00–06:00) is evaluated per time segment in local time; surcharges are computed on the base price and summed, never compounded (§5.1, FR-BOOK-01).

### 1.3 Security & Access Control

- [ ] **Phone + OTP Identity; Admin 2FA:** Login identity is the phone number with OTP (`/auth/request-otp`, `/auth/verify-otp`). Admin accounts additionally require a second factor (2FA) before any Admin Portal access. OTP numeric parameters (validity, attempts, lockout) are configuration values — they are not specified in SRS v2.0 and must not be invented in code (see Test Strategy §11).
- [ ] **Server-Side Authorization on Every Route:** Every route serving patient, nurse, financial, or record data validates on the backend: actor role × relationship to the target booking/profile × entity state. Medical-record and prescription access is additionally time-boxed: only the assigned nurse, only while the booking is `CONFIRMED`/`IN_PROGRESS`, and never after check-out +12h; an Admin re-grant is time-limited and audit-logged (FR-PRIV-01).
- [ ] **Private Media & Short-Lived Signed URLs:** CCCD, GPHN, prescription, selfie, and record images live in private object storage (S3/MinIO). Access is exclusively via presigned URLs with **10-minute** validity (NFR-SEC-01), minted only after server-side authorization for that specific object; persist content hashes.
- [ ] **Anti-Fraud Check-In (FR-SHIFT-01, CT-21):** Reject check-in when the OS reports a mock location; selfie capture is live-camera only (no gallery), watermarked with server timestamp + GPS coordinates; the check-in distance check is Haversine ≤ 200 m against the booking coordinates.
- [ ] **Masked Contact Only (FR-CHAT-01):** Customer↔nurse communication happens only inside the app (chat/calls, opened at `CONFIRMED`); real phone numbers are never exposed to the other party; message content is scanned for phone numbers/external links, warning the sender and logging the event.
- [ ] **Webhook Security (§9):** Verify the HMAC-SHA256 signature **before** processing any gateway payload; an invalid signature returns **HTTP 401** with no state change. Use the gateway transaction code as the `idempotency_key`.
- [ ] **Immutable Audit Logging:** Sensitive operations (`VIEW_MEDICAL_RECORD`, `APPROVE_GPHN`, `RESOLVE_DISPUTE`, `UPDATE_CONFIG`, `DELETE_PATIENT_DATA`) emit append-only `audit_logs`. Application logs never contain passwords, OTPs, tokens, or unnecessary health detail.
- [ ] **Centralized Secrets Governance:** Gateway secrets, signing keys, and database credentials are injected via environment variables / a secret manager; never commit `.env` files or credentials to git.
- [ ] **Mandatory Security PR Gates:** Pull requests modifying authentication/OTP, authorization, the tier gate, payments/wallets, or medical-record access require formal approval from a designated security reviewer, accompanied by negative test cases.

### 1.4 Test Verification & Traceability (Test Strategy Alignment)

- [ ] **Test Tier Alignment:** Every module implements the automated tests assigned to it in [`docs/testing/test-strategy.md`](../testing/test-strategy.md); money (pricing, settlement, commission, wallet), authorization, and tier-gate modules maintain **≥ 80% decision-branch coverage**.
- [ ] **Traceable Test Naming:** Test files and cases carry SRS codes (`FR-…`, `TC-…`, `CT-…`). Items the SRS leaves open (Test Strategy §11) are tested at mechanism level or tagged `OPEN` — never asserted with invented values.

---

## 2. Directory Architecture & Naming Conventions

### 2.1 Repository Root Structure

```
apps/admin-web/        # Admin Web Portal (React)
apps/patient-web/      # Patient & Family Web Application (React)
apps/nurse-web/        # Nurse Web Portal (React) — MVP scope per SRS v2.0, alongside the mobile app
apps/nurse-app/        # Nurse Mobile App (Android 8.0+ / iOS 13+, < 50 MB per NFR-COMP-01)
services/api/          # Backend RESTful API (Node.js + TypeScript)
packages/shared/       # Shared enums, constants, DTO types (single source of truth for status enums & config keys)
db/migrations/         # Sequential SQL schema migrations (16 SRS tables)
db/seeds/              # Reference datasets: system_configs (§5.1), service catalog (§4.2), synthetic demo data
db/tests/              # PostgreSQL schema constraint test suites
docs/                  # Project specifications and architecture catalog
```

### 2.2 Standard Backend Module Architecture (`services/api/src/modules/<module-name>/`)

Module Directory Naming: **English, kebab-case, singular**, representing a discrete business capability (never named after raw database tables). Every module adheres to the standard file layout below:

| File Name | Architectural Responsibility |
|---|---|
| `README.md` | Module mission, authoritative SRS FR/CT references, linked open items, test instructions. |
| `<module-name>.routes.ts` | Route declarations, authentication and authorization middleware bindings; zero business logic. |
| `<module-name>.service.ts` | Pure business logic implementing the SRS FRs; the sole location for business decisions. |
| `<module-name>.repo.ts` | Data access layer (parameterized SQL only); the sole database interaction point. |
| `<module-name>.policy.ts` | Module-specific authorization policy, including the tier hard-gate and record-access window where applicable. |
| `<module-name>.jobs.ts` | Background timers registered with the shared job queue (only for modules with temporal logic). |
| `<module-name>.types.ts` | DTOs and internal types; status enums imported strictly from `packages/shared`. |
| `<module-name>.schema.ts` | Strict whitelist request validation schemas for each route. |

*Cross-Cutting Core Components:* Generic utilities not bound to specific business domains belong in `services/api/src/core/` (e.g., database connection pool, audit logger, job queue engine, notification dispatchers, storage abstraction, error handlers). Never place business logic inside `core/`. Direct cross-module repository imports are prohibited — inter-module communication proceeds through domain services or asynchronous domain events.

*Module Test Locations:* Unit tests reside in `services/api/test/unit/<module-name>/`, integration tests in `services/api/test/integration/<module-name>/`, formatted as `<target>.test.ts` with SRS codes in the test titles (e.g., `test/unit/pricing-engine.test.ts` covering `TC-PRICE-01`).

### 2.3 Standard Frontend Feature Architecture (`apps/<app>/src/features/<feature-name>/`)

- Feature directory names use kebab-case representing user journeys (e.g., `booking`, `check-in`, `commission-payment`, `sos`).
- UI Components use PascalCase (e.g., `BookingSummary.tsx`); custom React hooks use `use-<name>.ts`.
- Network calls are centralized in a single `<feature-name>.api.ts` file within the feature — individual components never execute arbitrary HTTP fetch calls.
- Frontend features never execute business calculations: pricing, deadlines, tier eligibility, deposit gating, and action-button permissions are authoritative responses from backend APIs; the frontend handles rendering and client-side ergonomic validation only.
- **Nurse surfaces (Web Portal + Mobile App) implement the Elder-Friendly standard from day one** (NFR-UI-01): large fonts (16–18 pt app / 18–20 px web), WCAG 2.1 AA contrast, touch targets ≥ 48×48 dp, core flows in ≤ 3 actions.

### 2.4 Database & Documentation Standards

| Asset Type | File Naming Convention | Target Directory |
|---|---|---|
| **SQL Migrations** | `NNNN_<scope>_<short_description>.sql` (incrementing integer prefix; never edit merged migrations — author a new forward migration) | `db/migrations/` |
| **Database Seeds** | `NNN_<name>.sql` | `db/seeds/` |
| **Schema Constraint Tests** | `constraints.<group>.test.ts` | `db/tests/tests/` |
| **Architecture Records** | `NNNN-<decision_title>.md` | `docs/adr/` |
| **Module API Contracts** | `<module-name>.api.md` | `docs/api/` |
| **Standard Incident Runbooks** | `<incident_code>.md` | `docs/runbooks/` |
| **Quality & Test Specs** | `<title>.md` | `docs/testing/` |
| **System Specifications** | Preserved in established directories (`business_rule/`, `requirement/`, `security/`, `user_stories/`) | `docs/` |

*Shared Business Enums & Constants:* Shared enums (the three booking axes, profile lifecycle, wallet transaction types, config keys) are edited exclusively in `packages/shared/src/` — the centralized audit point for state-machine changes.

### 2.5 New Module Kick-Off Checklist

- [ ] Read the prerequisite specifications: the module's FRs in SRS §4, its RTM row in SRS §10, the relevant §5 configs/SLA rows, and the linked security policies in `docs/security/`.
- [ ] Enumerate the open items touching the module (Test Strategy §11) and record the handling strategy (configuration parameter / mechanism-level / out of scope) in the module `README.md`.
- [ ] Scaffold the backend module per Section 2.2 and the frontend feature per Section 2.3.
- [ ] Author test scaffolds (including traceable cases for the module's TC group) **prior to or alongside** feature code, aligned with the Test Strategy tiers.
- [ ] If the module introduces novel technical patterns (libraries, integration architecture), author an ADR in `docs/adr/` prior to broad adoption.

---

## 3. Module-by-Module Build Checklist (mapped to SRS FR groups)

Build order follows business dependencies: Foundation → AUTH → SCHED/SEARCH → BOOK → SHIFT → PAY → DISP/RATE/NOTIF/CHAT → ADMIN → Hardening (Section 8). Every module is tagged **[MVP]** or **[Phase 2]** per SRS §1.2/§4.0; Phase-2 modules are **not built** in the MVP cycle (Section 7).

---

### Phase 0 — Shared Infrastructure Foundation

**Objective:** Core services every business module depends on: database pooling, the shared job queue, audit logging, notification dispatch, secure object storage, configuration loading.

| Module / Component | SRS Source | Repository Location |
|---|---|---|
| `core/database` | ADR-0002 (SQL-first); §7 | `services/api/src/core/database/` |
| `core/jobs` | §1.2 golden timer rule; NFR-SEC-01 | `services/api/src/core/jobs/` |
| `core/audit` | §7 table 16 | `services/api/src/core/audit/` |
| `core/notifications` | FR-NOTIF-01 (FCM push + in-app + WebSocket; SMS/ZNS fallback) | `services/api/src/core/notifications/` |
| `core/storage` | NFR-SEC-01 (private buckets, 10-minute presigned URLs) | `services/api/src/core/storage/` |
| `core/config` | §5.1 (`system_configs` reader with caching; no hardcoded values) | `services/api/src/core/config/` |
| `shared` (enums, config keys, money helpers) | §2.2, §2.3, §5.1 | `packages/shared/src/` |
| Repo infrastructure / CI / Docker | `docs/dev-setup.md`; Test Strategy §8 | Repo root, `.github/workflows/` |

**Phase-Specific Quality Gates:**
- [ ] `audit_logs` is append-only at both the database-permission and application layers; writes happen only through the core audit writer.
- [ ] The job engine provides idempotency locks, a dead-letter queue, and backlog alerting from day one; every job is safe to re-run.
- [ ] The notification layer exposes provider interfaces (FCM / SMS) for deterministic mocking; urgent alerts use `priority = high` and start the 60-second acknowledgement watcher.
- [ ] CI executes all mandatory gates (unit tests, PostgreSQL migration + constraint suites, secret scanning) on an empty feature PR.

**Phase Exit Criteria:** Docker Compose provisions PostgreSQL + Redis; migrations and seeds (configs §5.1 + catalog §4.2) apply cleanly; `packages/shared` exports the §2.2/§2.3 enums; CI is green.

---

### Phase 1 — AUTH: Identity, eKYC, Tiers & Privacy (FR-AUTH-01/02/03, FR-PRIV-01) **[MVP]**

| Module | SRS Source | Repository Location |
|---|---|---|
| `accounts-otp` | §8 auth endpoints | `services/api/src/modules/accounts-otp/` |
| `nurse-onboarding` | FR-AUTH-01 (eKYC submission on Nurse Web/App: phone OTP, CCCD both sides, live portrait, degree, GPHN with `gphn_expiry_date` + scope, retirement decision as supporting doc) | `services/api/src/modules/nurse-onboarding/` |
| `credential-review` | FR-AUTH-02; `PATCH /admin/nurses/:id/verify`; `PUT /nurse/credentials/gphn` (records `reviewed_by`; assigns tier; approves GPHN renewals → re-upgrade) | `services/api/src/modules/credential-review/` |
| `tier-lifecycle` | FR-AUTH-02; §2.3 (daily GPHN sweep job: demote, invasive-booking auto-cancel + re-dispatch, re-upgrade) | `services/api/src/modules/tier-lifecycle/` |
| `patient-profiles` | FR-AUTH-03 (patient data + customer CCCD eKYC; home-care gate) | `services/api/src/modules/patient-profiles/` |
| `privacy-consent` | FR-PRIV-01 (consent capture with timestamp + IP/device; record-access window enforcement and Admin re-grant; 24-month retention; deletion/anonymization requests) | `services/api/src/modules/privacy-consent/` |

*Client Interfaces:* `apps/patient-web/src/features/auth/`, `features/patient-profiles/`; `apps/nurse-web/src/features/onboarding/`, `features/credentials/`; `apps/nurse-app/src/features/onboarding/`; `apps/admin-web/src/features/nurse-verification/`.

**Phase-Specific Quality Gates:**
- [ ] A profile in `PENDING_VERIFICATION` can never appear in search results, matching candidates, or accept any job.
- [ ] Tier assignment follows FR-AUTH-02 exactly: valid degree without GPHN → `TIER_1_BASIC`; valid in-scope GPHN → `TIER_2_SPECIALIST`; a retirement decision alone never yields Tier 2.
- [ ] A patient profile cannot be saved without the Decree-13 consent (`data_consent_accepted` + `consent_timestamp`); a home-care booking is impossible until the customer's eKYC is `VERIFIED` (hospital-location bookings need phone verification only).
- [ ] Record access checks combine assignment + booking state + the 12-hour post-check-out window in one policy function used by every record/prescription route.
- [ ] Verification tiers: Tier 1 (schema), Tier 2 (tier decision functions), Tier 3 (403 gates, OTP flows), Tier 5 (GPHN sweep), Tier 7 (security suite).

**Phase Exit Criteria:** A nurse completes onboarding → Admin review → tier assignment on staging; a demote/re-upgrade cycle via GPHN expiry and renewal executes end to end; a customer completes eKYC and creates a consented patient profile.

---

### Phase 2 — SCHED & SEARCH: Availability and Nurse Discovery (FR-SCHED-01, FR-SEARCH-01) **[MVP]**

| Module | SRS Source | Repository Location |
|---|---|---|
| `nurse-availabilities` | FR-SCHED-01; `PUT /nurse/availabilities` (recurring weekly windows + time-off exceptions in `nurse_availabilities`) | `services/api/src/modules/nurse-availabilities/` |
| `availability-engine` | FR-SCHED-01 (recurring schedule + `CONFIRMED`/`IN_PROGRESS` bookings + **60-minute travel buffer** → effective availability; shared by matching and search) | `services/api/src/modules/availability-engine/` |
| `nurse-search` | FR-SEARCH-01; `GET /nurses/search` (filters: service, area, time window, tier, gender; returns card data incl. `rating_avg`, experience, retired-staff badge) | `services/api/src/modules/nurse-search/` |

**Phase-Specific Quality Gates:**
- [ ] Search and matching consume the **same** availability-engine result — no divergent "free nurse" logic per feature.
- [ ] Only `profile_status = ACTIVE` nurses with `deposit_balance ≥ 300,000` and tier sufficient for the requested service are surfaced for dispatch; search display follows FR-SEARCH-01 (profile browsing may show cards, but booking/dispatch actions re-check all gates server-side).
- [ ] A `TIME_OFF_EXCEPTION` or a < 60-minute gap to a confirmed booking removes the nurse from candidates (TC-MATCH-01).
- [ ] Verification tiers: Tier 1 (schedule-conflict exclusion), Tier 2 (buffer logic), Tier 3 (search filters).

**Phase Exit Criteria:** Availability scenarios (recurring window, time-off, buffer collision) reproduce identically in search results and matching candidates.

---

### Phase 3 — BOOK: Booking, Pricing, Prescription Gate & Matching (FR-BOOK-01/02/03) **[MVP]**

| Module | SRS Source | Repository Location |
|---|---|---|
| `pricing-engine` | FR-BOOK-01; §5.1 (base + segment night surcharge + additive holiday surcharges + heavy-patient surcharge; result snapshot stored on the booking: `base_amount`, `surcharge_amount`, `platform_fee`, `total_amount`) | `services/api/src/modules/pricing-engine/` |
| `bookings` | FR-BOOK-01; `POST /bookings` (`payment_method` captured at creation; `DRAFT` with 15-minute payment hold; consent + customer-eKYC preconditions checked) | `services/api/src/modules/bookings/` |
| `prescription-gate` | FR-BOOK-02 (layer 1: invasive ⇒ prescription image + issue date ≤ 7 days, else HTTP 400; layer 2: Tier-2 nurse reviews the image before accepting; layer 3: on-site rejection endpoint) | `services/api/src/modules/prescription-gate/` |
| `matching-radar` | FR-BOOK-03 mechanism A (urgent ≤ 6h: 5 km for minutes 0–5, then 10 km; first-accept wins via Redis lock / `FOR UPDATE`; deposit + tier gates) | `services/api/src/modules/matching-radar/` |
| `job-board` | FR-BOOK-03 mechanism B (advance > 6h: board broadcast; direct invite from search with a 15-minute nurse response window before broadcast) | `services/api/src/modules/job-board/` |
| `booking-expiry` | FR-BOOK-03; §5.2 row 9 (payment timeout and matching expiry jobs → `EXPIRED`; 100% refund when `ESCROW_HELD`) | `services/api/src/modules/booking-expiry/` |
| `contract-bidding` **[Phase 2]** | FR-BOOK-04 (long-term posting, applications, trial shift) | — not built in MVP |
| `contract-lifecycle` **[Phase 2]** | FR-BOOK-05 (pause, mid-contract replacement, early termination) | — not built in MVP |

**Phase-Specific Quality Gates:**
- [ ] Prohibited services (catalog Group 3) cannot be instantiated as bookings through any route, including Admin tooling.
- [ ] Every acceptance path re-validates: `profile_status = ACTIVE`, tier vs `is_invasive`, `deposit_balance ≥ 300,000`, and effective availability — in the backend, at accept time (not only at dispatch time).
- [ ] The pricing engine is a pure function of (service, time range, patient flags, `system_configs`, holiday calendar); its Tier 2 boundary suite — including both SRS worked examples — is green before any booking UI ships.
- [ ] Verification tiers: Tier 2 (pricing), Tier 3 (creation gates), Tier 5 (expiry/expansion timers), Tier 6 (booking journeys).

**Phase Exit Criteria:** Both matching mechanisms fill a booking on staging; an unpaid booking expires at 15 minutes; an unmatched paid booking expires with a full refund.

---

### Phase 4 — SHIFT: Execution, Check-In Fraud Controls & SOS (FR-SHIFT-01–05) **[MVP]**

| Module | SRS Source | Repository Location |
|---|---|---|
| `check-in` | FR-SHIFT-01; `POST /bookings/:id/check-in` (mock-location rejection; Haversine ≤ 200 m; live selfie with server timestamp + GPS watermark; → `IN_PROGRESS`) | `services/api/src/modules/check-in/` |
| `shift-logs` | FR-SHIFT-02 (30-minute initial condition report + condition-mismatch flow — surcharge update request or no-penalty rejection; vitals & care activities in `shift_logs` JSONB; realtime sync via WebSocket) | `services/api/src/modules/shift-logs/` |
| `shift-extend` | FR-SHIFT-03; `POST /bookings/:id/extend` (1-hour blocks; nurse next-shift conflict check + nurse consent; extension fee added to escrow for transfer orders) | `services/api/src/modules/shift-extend/` |
| `check-out` | FR-SHIFT-04; `POST /bookings/:id/check-out` (minimal care report is mandatory; records `checkout_time`; starts the 24h dispute/settlement clock and the 12h record-access clock; opens two-sided rating) | `services/api/src/modules/check-out/` |
| `prescription-rejection` | FR-BOOK-02 layer 3; `POST /bookings/:id/reject-invalid-prescription` (evidence photo; booking `CANCELLED`; no penalty, no TrustScore deduction; travel support per §5.2 — amount `OPEN`, see Test Strategy §11) | `services/api/src/modules/prescription-rejection/` |
| `sos` | FR-SHIFT-05 (in-app SOS: 115 dialer opens immediately; simultaneous push + SMS-fallback alert with GPS + latest vitals to family and Admin; incident log in `shift_logs.emergency_incident_log`) | `services/api/src/modules/sos/` |

*Client Interfaces:* `apps/nurse-app/src/features/` (check-in, shift-log, check-out, sos); `apps/nurse-web/src/features/shift/`; `apps/patient-web/src/features/booking-tracking/`, `features/extend/`.

**Phase-Specific Quality Gates:**
- [ ] Check-out is blocked (API and UI) until the minimal care report exists: final vitals, completed care activities, handover notes. Task-based services completed in full are paid in full even when finished early (FR-SHIFT-04).
- [ ] The SOS action never waits on the network: the 115 dialer opens locally first; the system alert is a parallel, logged side effect (alert fan-out < 2 s, TC-SOS-01).
- [ ] Check-in anti-fraud is verified on physical devices, not only emulators (mock GPS app, gallery-upload attempt).
- [ ] Verification tiers: Tier 3 (check-in/out contracts), Tier 5 (clocks started at check-out), Tier 6 (execution journeys), Tier 7 (TC-SEC-01).

**Phase Exit Criteria:** A full shift executes on physical devices: check-in → logs → extension → check-out + report, including the invalid-prescription rejection and SOS branches.

---

### Phase 5 — PAY: Wallets, Escrow, Settlement, Deposit & Withdrawals (FR-PAY-01–04) **[MVP]**

| Module | SRS Source | Repository Location |
|---|---|---|
| `wallets-ledger` | §7 tables 8–9 (three balances: `available_balance`, `escrow_locked_balance`, `deposit_balance`; append-only `wallet_transactions` with `idempotency_key`; tx types incl. `COMMISSION_PAYMENT` kept strictly distinct from `PENALTY_DEDUCT`) | `services/api/src/modules/wallets-ledger/` |
| `gateway-webhooks` | FR-PAY-01; §9; `POST /payments/escrow-webhook` (HMAC-SHA256 verify → 401 on failure; idempotent processing → `ESCROW_HELD` + matching activation) | `services/api/src/modules/gateway-webhooks/` |
| `settlements` | FR-PAY-02 (transfer orders: customer early confirmation **or** check-out +24h with `dispute_status = NONE` → deduct 15%, credit 85% to `available_balance`; dispute `OPEN` freezes release) | `services/api/src/modules/settlements/` |
| `cash-commission` | FR-PAY-02; `POST /bookings/:id/commission-payment-link` (at check-out, generate the VietQR/payment link for 15% of the in-app price; webhook confirmation → `SETTLED`; +24h unpaid → nurse `SUSPENDED`; never debits `deposit_balance` or `available_balance`) | `services/api/src/modules/cash-commission/` |
| `deposits` | FR-PAY-03 (top-up to the 300,000 gate; penalty-only deductions with debt booking; full withdrawal only on account closure after 7 dispute-free days) | `services/api/src/modules/deposits/` |
| `cancellation-policy` | §5.2 rows 1–9 (data-driven policy table: refund/compensation/platform splits 100% · 80/15/5 · 50/40/10; actual-hours rule for mid-shift stops; ICU support; nurse-cancel penalty → Urgent Bonus; no-show → `BANNED` + 50,000 voucher) | `services/api/src/modules/cancellation-policy/` |
| `withdrawals` | FR-PAY-04; `POST /wallets/withdraw` (amount ≤ `available_balance` else HTTP 400; ACID + row lock; `WITHDRAW_REQUESTED → WITHDRAWN` via Admin/payout approval) | `services/api/src/modules/withdrawals/` |

**Phase-Specific Quality Gates:**
- [ ] The §5.2 cancellation/SLA matrix is implemented as a data-driven policy table — one row per scenario — each row covered by Tier 2 tests; no scenario logic is scattered across controllers.
- [ ] Every money path is proven against the RTM worked figures: 500,000 transfer settlement → 425,000 to the nurse; cash commission leaves `deposit_balance` byte-identical; a replayed webhook yields exactly one ledger entry.
- [ ] Refunds apply only to transfer orders (cash orders were never prepaid); nurse SLA penalties on cash orders still deduct from the deposit only.
- [ ] Verification tiers: Tier 1 (ledger idempotency), Tier 2 (splits), Tier 4 (gateway contracts), Tier 5 (settlement/commission timers), Tier 7 (race tests).

**Phase Exit Criteria:** Both payment methods run their full lifecycle on staging with zero ledger discrepancy across the canonical fixtures.

---

### Phase 6 — DISP, RATE, NOTIF, CHAT (FR-DISP-01, FR-RATE-01, FR-NOTIF-01, FR-CHAT-01) **[MVP]**

| Module | SRS Source | Repository Location |
|---|---|---|
| `disputes` | FR-DISP-01; `POST /bookings/:id/disputes`; `PATCH /admin/disputes/:id/resolve` (open from `IN_PROGRESS` until check-out +24h; ≤ 5 evidence files; `OPEN` freezes escrow; `RESOLVED_CUSTOMER` → 100% refund, `RESOLVED_NURSE` → 100% release; on CASH orders an upheld customer dispute deducts compensation from the violating nurse's deposit) | `services/api/src/modules/disputes/` |
| `partial-settlement` **[Phase 2]** | FR-DISP-02 (Admin split-ratio adjudication → `PARTIALLY_SETTLED`) | — not built in MVP |
| `reviews-trustscore` | FR-RATE-01; `POST /bookings/:id/reviews` (opens at `COMPLETED`; blind via `is_visible` until both submit or 7 days pass; TrustScore deltas −5/−20/−25, +2 recovery capped at 100; < 60 → `SUSPENDED`) | `services/api/src/modules/reviews-trustscore/` |
| `notifications` | FR-NOTIF-01 (FCM high-priority push, in-app center, WebSocket realtime; SMS/ZNS fallback for urgent events unacknowledged after 60 s) | `services/api/src/modules/notifications/` |
| `chat` | FR-CHAT-01 (in-app chat/calls on `conversations_messages`; opens at `CONFIRMED`; numbers masked; content scanning warns + logs; history retained as dispute evidence) | `services/api/src/modules/chat/` |

**Phase-Specific Quality Gates:**
- [ ] Opening a dispute atomically freezes the settlement job for that booking (verified at Tier 5: a dispute at hour 20 blocks the hour-24 release).
- [ ] Rating submission never waits for money settlement; visibility flipping is a job, not a read-time computation.
- [ ] Chat is unusable before `CONFIRMED` and after the booking closes, except read-only evidence access for Admin dispute handling (audit-logged).
- [ ] Verification tiers: Tier 2 (TrustScore), Tier 3 (dispute/chat contracts), Tier 5 (freeze, visibility, fallback timers), Tier 6 (exception journeys).

**Phase Exit Criteria:** The dispute freeze/resolve cycle, blind-rating cycle, and SMS fallback each execute on staging.

---

### Phase 7 — ADMIN: Catalog, Configuration & Reconciliation (FR-ADMIN-01) **[MVP]**

| Module | SRS Source | Repository Location |
|---|---|---|
| `admin-catalog` | FR-ADMIN-01 (service catalog CRUD incl. the `is_invasive` / `is_prohibited` flags and `required_tier`) | `services/api/src/modules/admin-catalog/` |
| `admin-configs` | FR-ADMIN-01; §5.1 (`system_configs` editing with no code change; every change audit-logged with `updated_by`) | `services/api/src/modules/admin-configs/` |
| `admin-users` | FR-ADMIN-01 (search/detail; lock/unlock customer & nurse accounts across `ACTIVE`/`SUSPENDED`/`BANNED`, respecting `profile_status` as the eligibility source) | `services/api/src/modules/admin-users/` |
| `admin-finance` | FR-ADMIN-01; CT-15 (reconciliation reports: total escrow held, total 15% platform commission, total payouts, total refunds, pending withdrawal approvals) | `services/api/src/modules/admin-finance/` |

**Phase-Specific Quality Gates:**
- [ ] No Admin action bypasses the ledger or the audit log: config edits, dispute resolutions, GPHN approvals, and account locks all emit `audit_logs`.
- [ ] Admin Portal access requires the Admin 2FA gate (Phase 1) for every session.
- [ ] Verification tiers: Tier 3 (admin contracts + authorization), Tier 6 (admin UAT flows).

**Phase Exit Criteria:** A full operational day is simulated through Admin interfaces only — verification queue, dispute queue, config change, reconciliation export — with no manual database edits.

---

## 4. Data Checklist — the 16 SRS Tables (§7)

- [ ] **`users`** — `phone` UNIQUE (login identity); `role` ∈ {PATIENT, NURSE, ADMIN}; `kyc_status` and account `status` maintained, but never used as a substitute for `profile_status` in eligibility decisions.
- [ ] **`nurse_profiles`** — `profile_status` ∈ {PENDING_VERIFICATION, ACTIVE, SUSPENDED, BANNED} is the single source of truth for job eligibility; `tier` ∈ {TIER_1_BASIC, TIER_2_SPECIALIST}; `gphn_expiry_date` indexed for the daily sweep; `trust_score` defaults to 100; `rating_avg` maintained from visible reviews only.
- [ ] **`nurse_credentials`** — `doc_type` ∈ {CCCD, DEGREE, GPHN, RETIREMENT_DECISION}; `verification_status` ∈ {PENDING, APPROVED, REJECTED}; `reviewed_by` FK → `users.id` (an Admin) with `reviewed_at` and `rejection_reason`.
- [ ] **`patient_profiles`** — consent fields `data_consent_accepted` + `consent_timestamp` enforced at write time; `location_type` ∈ {HOSPITAL, HOME} drives the customer-eKYC gate; `deleted_at` soft-delete supports anonymization under Decree 13/2023.
- [ ] **`service_categories`** — the three catalog groups of §4.2 are representable and enforced: `is_invasive`, `is_prohibited` (default false), `required_tier`, `base_price`, `unit` ∈ {PER_TIME, PER_HOUR, PER_SHIFT}, `service_type` ∈ {TASK_BASED, SHIFT_BASED, CONTRACT}.
- [ ] **`bookings`** — three independent status columns per §2.2; `payment_method` ∈ {BANK_TRANSFER, CASH} set at creation; amount snapshot columns (`base_amount`, `surcharge_amount`, `urgent_bonus_amount`, `platform_fee`, `total_amount`); prescription fields (`prescription_image_url`, `prescription_issued_date`, `prescription_verified_by_nurse`); `booking_code` UNIQUE; `nurse_id` nullable until matched.
- [ ] **`shift_logs`** — `booking_id` UNIQUE (one log per booking); check-in evidence fields incl. `is_mock_location_detected`; vitals/care/emergency logs as JSONB; `checkout_time` is the single anchor for the +12h access closure and +24h settlement/dispute clocks.
- [ ] **`wallets`** — `user_id` UNIQUE; three balances kept separate at all times; `wallet_status` ∈ {ACTIVE, FROZEN}; `deposit_balance` may go negative only as booked penalty debt.
- [ ] **`wallet_transactions`** — `idempotency_key` UNIQUE; `tx_type` ∈ {TOPUP, ESCROW_HOLD, ESCROW_RELEASE, COMMISSION_PAYMENT, PENALTY_DEDUCT, URGENT_BONUS, REFUND, PARTIAL_SETTLE, WITHDRAW} (`PARTIAL_SETTLE` reserved for Phase 2); `balance_before`/`balance_after` chain per wallet; table is append-only (no UPDATE/DELETE grants for the application role).
- [ ] **`nurse_availabilities`** — recurring (`day_of_week`) vs one-off (`specific_date`) rows; `availability_type` ∈ {RECURRING_AVAILABLE, TIME_OFF_EXCEPTION}.
- [ ] **`disputes`** — `status` ∈ {OPEN, UNDER_REVIEW, RESOLVED_CUSTOMER, RESOLVED_NURSE, RESOLVED_PARTIAL}; `refund_amount`/`release_amount` recorded on resolution; `resolved_by` FK → `users.id`; evidence stored as `evidence_urls` JSONB (≤ 5 files enforced at the API).
- [ ] **`reviews`** — `rating` CHECK 1–5; `reviewer_role` ∈ {PATIENT, NURSE}; `is_visible` default false, flipped by the visibility job only.
- [ ] **`conversations_messages`** — `message_type` ∈ {TEXT, IMAGE, VOICE_CALL_LOG, SYSTEM_ALERT}; call logs carry `call_duration_sec`; rows are retained as dispute evidence (no hard delete).
- [ ] **`notifications`** — `channel` ∈ {PUSH_FCM, IN_APP, SMS_FALLBACK}; `delivery_status` ∈ {PENDING, SENT, FAILED} tracked per notification (drives the 60-second fallback watcher).
- [ ] **`system_configs`** — seeded with exactly the §5.1 keys and values; `config_value` typed via `data_type`; `updated_by` FK → `users.id` on every change; the application reads config through `core/config` only.
- [ ] **`audit_logs`** — `action_type` covers at minimum {VIEW_MEDICAL_RECORD, APPROVE_GPHN, RESOLVE_DISPUTE, UPDATE_CONFIG, DELETE_PATIENT_DATA}; `old_value`/`new_value` JSONB; append-only.
- [ ] **Migrations & seeds:** SQL-first migrations build all 16 tables from an empty database; seeds contain only `system_configs`, the §4.2 catalog, and synthetic demo data — never production data.

---

## 5. API Checklist — SRS §8 Core Endpoints

Every endpoint below is implemented with server-side role checks, whitelist validation, and the error contract asserted by the RTM. Supporting endpoints not listed in SRS §8 (session management, chat, notifications, Admin configuration screens) are specified in `docs/api/` as they are built and follow the same rules.

| Endpoint | Role | Build Checks |
|---|---|---|
| `POST /api/v1/auth/request-otp` | PATIENT / NURSE | Rate-limited issuance; no OTP material in logs. |
| `POST /api/v1/auth/verify-otp` | PATIENT / NURSE | Issues the session only on a valid code; Admin accounts continue to the mandatory 2FA step. |
| `POST /api/v1/auth/nurse-onboarding` | NURSE | Accepts CCCD/degree/GPHN/retirement documents to private storage; profile lands in `PENDING_VERIFICATION`. |
| `PATCH /api/v1/admin/nurses/:id/verify` | ADMIN | Records `reviewed_by`; assigns tier per FR-AUTH-02; also used to approve a renewed GPHN (→ re-upgrade). |
| `PUT /api/v1/nurse/credentials/gphn` | NURSE | New GPHN enters `PENDING` review; no self-upgrade before Admin approval. |
| `PUT /api/v1/nurse/availabilities` | NURSE | Recurring windows + time-off in one consistent write; effective availability recomputed by the shared engine. |
| `GET /api/v1/nurses/search` | PATIENT | Returns only eligible, matching profiles with FR-SEARCH-01 card fields; tier filter enforced server-side. |
| `POST /api/v1/bookings` | PATIENT | Checks Decree-13 consent, customer eKYC (home care), prescription gate (400 when missing), prohibited-service block; prices from `system_configs`; stores `payment_method`. |
| `POST /api/v1/payments/escrow-webhook` | GATEWAY | HMAC-SHA256 verified first (401 on mismatch); `idempotency_key` dedupes replays (200 no-op); success → `ESCROW_HELD` + matching activation. |
| `POST /api/v1/bookings/:id/check-in` | NURSE | Mock-location rejection; Haversine ≤ 200 m; live selfie required; prescription on-site cross-check prompt for invasive services. |
| `POST /api/v1/bookings/:id/reject-invalid-prescription` | NURSE (Tier 2) | Evidence photo mandatory; booking `CANCELLED`; no penalty and no TrustScore deduction. |
| `POST /api/v1/bookings/:id/check-out` | NURSE | Blocked without the minimal care report; writes `checkout_time`; starts the +12h/+24h clocks; opens ratings. |
| `POST /api/v1/bookings/:id/extend` | PATIENT | 1-hour blocks; rejects when the nurse has a conflicting next booking or declines; extension fee escrowed for transfer orders. |
| `POST /api/v1/bookings/:id/disputes` | PATIENT / NURSE | Window enforced (`IN_PROGRESS` → check-out +24h); ≤ 5 evidence files; opening freezes settlement atomically. |
| `PATCH /api/v1/admin/disputes/:id/resolve` | ADMIN | Resolution moves money per FR-DISP-01 and writes the audit + dispute record; partial splits are Phase 2 only. |
| `POST /api/v1/bookings/:id/reviews` | PATIENT / NURSE | Accepted from `COMPLETED` (per FR-RATE-01); stored blind (`is_visible = false`); TrustScore effects applied by the rating service. |
| `POST /api/v1/bookings/:id/commission-payment-link` | NURSE | Generates the VietQR/payment link for exactly 15% of the in-app price of a CASH booking; callable from Nurse Web and App. |
| `POST /api/v1/wallets/withdraw` | NURSE | Amount ≤ `available_balance` else HTTP 400; row-locked; creates the `WITHDRAW_REQUESTED` flow for Admin/payout approval. |

**General API rules:**
- [ ] All routes are versioned under `/api/v1`; request bodies are whitelist-validated; error responses never leak stack traces or health data.
- [ ] Expected error codes are part of the contract and tested: **400** (missing prescription image; over-balance withdrawal), **401** (invalid webhook signature), **403** (tier gate; deposit gate; record access outside the window; ineligible profile status).
- [ ] Every state-changing endpoint is safe to retry: money and state effects are keyed by idempotency keys.

---

## 6. Pre-Merge Pull Request Quality Gate (Mandatory across all phases)

Every pull request must fulfill this verification checklist prior to merging into main branches:

- [ ] **SRS Traceability:** The PR description enumerates the touched `FR-…`, `CT-…`, and `TC-…` codes, the build phase/module, and any open items (Test Strategy §11) it touches.
- [ ] **Zero Hardcoded Business Values:** No rates, fees, thresholds, radii, or deadlines from §5.1 appear as literals; no status enums are defined outside `packages/shared`.
- [ ] **Tier Gate & Authorization Enforced:** New and modified routes implement backend authorization — including the tier hard-gate and record-access window where relevant — accompanied by negative tests (wrong tier, wrong owner, expired window ⇒ HTTP 403).
- [ ] **Money Integrity:** Financial changes write append-only ledger entries with idempotency keys; no `UPDATE`/`DELETE` on `wallet_transactions`; the deposit is never used for commission; automated decisions emit audit records.
- [ ] **Timers via the Job Queue:** No ad-hoc `setTimeout`/cron for business deadlines; every new timer is registered, idempotent, and covered by a fake-clock test.
- [ ] **Test Suite Passing:** All module tests are green; money, authorization, and tier-gate modules maintain **≥ 80% decision-branch coverage**.
- [ ] **CI Pipeline Green:** Unit tests, PostgreSQL migration + constraint suites, secret scanners, and dependency auditors all pass — security failures block merging.
- [ ] **Security Review Sign-Off:** PRs modifying authentication/OTP, authorization, the tier gate, financial logic, or medical-record access have formal sign-off from a designated security reviewer.
- [ ] **Documentation Synchronization:** Module `README.md`, `docs/api/<module>.api.md` (if contracts changed), and ADRs (if new technical decisions were introduced) are updated in the same PR.

---

## 7. Explicit Exclusions — Not Built in MVP

- [ ] **Marketplace / long-term contract bidding & trial shifts** (FR-BOOK-04) — Phase 2.
- [ ] **Long-term contract lifecycle** — pause, mid-contract replacement, early termination (FR-BOOK-05) — Phase 2.
- [ ] **`PARTIALLY_SETTLED` dispute adjudication** (FR-DISP-02) — Phase 2. The enum values exist in the schema; no MVP flow may produce them.
- [ ] **Recurring / subscription care packages** — not in the SRS v2.0 MVP scope; build only when specified.
- [ ] **Elder-Friendly UI for the Patient App** — Phase 2 (NFR-UI-01). The MVP obligation covers the Nurse Web Portal and Nurse Mobile App.
- [ ] **Deep AI eKYC liveness** — commercial phase (NFR-SEC-01). MVP check-in/onboarding uses live camera + server timestamp/GPS watermark.
- [ ] **Live licensed-intermediary escrow** — MVP escrow is simulated (internal ledger + sandbox gateways, §1.3).
- [ ] **Prohibited services** (catalog Group 3: blood transfusion, high-anaphylaxis-risk IV antibiotics, anesthesia/minor surgery at home, new prescriptions) — never bookable; implemented as blocking rules and keyword screening only.

---

## 8. Hardening & MVP Readiness

This phase introduces zero new business scope; it hardens the system from "functionally complete" to "production-grade":

- [ ] **Security Hardening:** Full CI security suite green; **independent third-party penetration test** before go-live with all Critical/High findings remediated; focused tests on wallet race conditions, OTP brute force, tier-gate bypass, and record-window bypass.
- [ ] **Availability & DR (NFR-AVAIL-01):** Uptime monitoring against the ≥ 99.5% target; no planned maintenance in the 19:00–21:00 handover window; daily snapshots + PITR drill proving RPO ≤ 1h (wallet) / ≤ 24h (logs) and RTO ≤ 4h.
- [ ] **Compatibility Verification (NFR-COMP-01):** Nurse app verified on Android 8.0 / iOS 13 low-end physical devices with install size < 50 MB; web portals verified responsive on the last two versions of Chrome, Safari, Edge, Firefox.
- [ ] **Observability & Runbooks:** Alerts configured for job-queue backlog, failed webhooks, OTP failure spikes, unacknowledged SOS alerts, and commission-overdue counts; incident runbooks in `docs/runbooks/` authored and rehearsed.
- [ ] **UAT & MVP Sign-Off:** All Test Strategy exit criteria (Section 8) fulfilled — the full MVP RTM matrix green, zero open Blocker/Critical defects, Tier 9 operational drills executed, formal sign-off by the Product Owner and QA Lead.

**Phase Exit Criteria:** Official MVP Go-Live Authorization signed by the Product Owner; Phase-2 scope (Section 7) formally documented as out of scope for the MVP milestone.

---

*Core Guiding Principle: Follow the dependency chain in strict order; every completed module must be independently runnable and testable. When specifications and code diverge, the governing SRS v2.0 prevails — points the SRS leaves open remain explicitly flagged, never assumed.*
