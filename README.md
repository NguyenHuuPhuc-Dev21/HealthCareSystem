# HealthCareSystem — On-Demand Nursing Marketplace

> A marketplace platform that connects patients and families with independent nurses — retired doctors/nurses and newly graduated nursing staff — for professional care at home or at the hospital: verified credentials, rule-based matching, anti-fraud shift check-in, transparent platform-held payments, and a full dispute and rating trail.

![Stage](https://img.shields.io/badge/stage-SRS_v2.0_baseline_·_Phase_0_scaffolded-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6)
![React](https://img.shields.io/badge/React-18-61DAFB)
![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-20-339933)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1)

---

## Overview

After surgery or discharge, many patients still need professional care — wound dressing, injections, IV maintenance therapy, catheter care. Today, families find home nurses through informal channels: no credential verification, no price transparency, no record of what was done, and no protection for either side when something goes wrong.

**HealthCareSystem** is a two-sided marketplace (the platform connects and guarantees the transaction; it does **not** employ the nurses and is **not** a hospital system):

1. A nurse registers with **phone number + OTP**, completes eKYC (ID card, degree, practice license — GPHN) and is reviewed by an Admin, who assigns **Tier 1 (basic care)** or **Tier 2 (specialist)**.
2. A customer creates a care-recipient profile and gives **Decree 13/2023 data consent**; home-care bookings additionally require the customer's own eKYC.
3. The customer books a service from a **three-group catalog** (non-invasive / invasive-with-doctor's-order / strictly prohibited). Invasive services are hard-gated to Tier 2 nurses with a valid GPHN and a doctor's order attached.
4. The price is computed from `system_configs` — base price plus night (22:00–06:00, +20%), holiday (Tết +300%, other holidays +200%) and heavy-patient (+15%) surcharges, all additive on the base price.
5. The customer either **prepays by bank transfer** (the platform ledger holds the funds until settlement) or **pays the nurse in cash** at the end of the shift.
6. The system matches a nurse by **Radar dispatch** (urgent shifts: 5 km radius, expanding to 10 km) or the **Job Board** (advance bookings and direct invites).
7. The nurse checks in on site with **GPS ≤ 200 m, mock-location blocking and a live selfie**; during the shift, vitals and care activities are logged; check-out requires a minimum care report.
8. After check-out there is a **24-hour dispute window**; then the shift settles: the nurse receives **85%**, the platform keeps **15%**. For cash shifts, the nurse self-pays the 15% commission via a generated VietQR/payment link within 24 hours.
9. Both sides review each other (blind, two-way) and the nurse's **TrustScore** moves with behaviour; an in-shift **SOS** opens the 115 emergency dialer immediately and alerts family and Admin in parallel.

Every money movement is an append-only ledger entry; every sensitive access is audit-logged. The governing specification is the **SRS — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)** in [`docs/`](docs/).

## MVP Scope

| In scope (MVP) | Out of scope (Phase 2 / later) |
|---|---|
| Phone + OTP accounts; customer & nurse eKYC | Long-term contract bidding and trial shifts (FR-BOOK-04) |
| Two nurse tiers with GPHN lifecycle (auto-demote on expiry, re-upgrade on renewal) | Contract lifecycle: pause, mid-contract replacement, early termination (FR-BOOK-05) |
| Three-group service catalog with hard tier gating | Partial-settlement dispute adjudication (FR-DISP-02) |
| Radar dispatch + Job Board matching | Recurring / subscription care packages |
| Bank-transfer prepayment (platform-held, simulated escrow) + cash payment | Licensed-intermediary escrow (commercial phase) |
| Upfront 300,000 VND nurse deposit — SLA penalties only | Deep-AI eKYC liveness (commercial phase; MVP uses live capture + server timestamp/GPS stamps) |
| Disputes, blind two-way reviews, TrustScore | Elder-friendly UI for the patient app (MVP obligation covers nurse surfaces) |
| In-app chat/calls with masked phone numbers; SOS protocol | Any AI symptom screening or triage — clinical safety is rule- and human-based by design |

## Key Capabilities

- **Identity, eKYC & tiers** — Phone + OTP login (Admin additionally requires 2FA); nurse onboarding on web and mobile; Admin credential review with tier assignment; automatic tier demotion when a GPHN expires and re-upgrade after an approved renewal; `nurse_profiles.profile_status` is the single source of truth for job eligibility (FR-AUTH-01/02/03, FR-PRIV-01).
- **Catalog & pricing** — Three-group service catalog (§4.2) enforced by `is_invasive` / `is_prohibited` flags and `required_tier`; parameterized pricing from `system_configs` with a price snapshot stored on every booking (FR-BOOK-01).
- **Booking & matching** — Two matching mechanisms (Radar dispatch for urgent shifts, Job Board for advance bookings and direct invites); availability engine with recurring schedules, time-off and a 60-minute travel buffer shared by search and matching; two-layer doctor's-order verification by the Tier 2 nurse, with a penalty-free on-site rejection right (FR-BOOK-02/03, FR-SCHED-01, FR-SEARCH-01).
- **Shift execution** — Anti-fraud check-in (mock-location rejection, ≤ 200 m Haversine, live selfie with server timestamp + GPS); real-time shift logs with an initial condition report and mismatch flow; 1-hour-block extensions; check-out gated on the minimum care report, which starts the +12 h record-access and +24 h settlement/dispute clocks (FR-SHIFT-01–05).
- **Payments & wallets** — Three separate wallet balances (available / escrow-locked / deposit); append-only ledger with idempotency keys and HMAC-SHA256-verified gateway webhooks; settlement at check-out +24 h or early customer confirmation; cash-job commission self-paid by the nurse — **never** deducted from any wallet; the deposit is debited **only** for SLA penalties under the §5.2 matrix (FR-PAY-01–04).
- **Disputes, reviews & communication** — Disputes open from in-progress until check-out +24 h and freeze settlement immediately; blind two-way reviews with TrustScore deltas (+2 recovery, −5/−20/−25 penalties, suspension below 60); in-app chat/calls with masked numbers and contact-leak scanning; multi-channel notifications with a 60-second SMS/ZNS fallback for unacknowledged urgent events (FR-DISP-01, FR-RATE-01, FR-CHAT-01, FR-NOTIF-01).
- **Administration** — Catalog and `system_configs` management without code changes, user management, dispute queues, credential verification queues, and financial reconciliation reports — every Admin action audit-logged (FR-ADMIN-01).

## User Roles

| Role | Surfaces | Responsibilities |
|---|---|---|
| **Patient / Family member** | Patient Web | Creates care-recipient profiles with consent, searches nurses, books and pays, tracks the shift, extends, disputes, reviews |
| **Nurse — Tier 1 (Basic)** | Nurse Web Portal + Nurse Mobile App | Non-invasive care only; manages availability, accepts jobs, executes shifts, manages wallet and deposit |
| **Nurse — Tier 2 (Specialist)** | Nurse Web Portal + Nurse Mobile App | All Tier 1 work plus invasive services under a doctor's order; verifies orders before accepting and on site |
| **Admin / Operator** | Admin Web Portal (2FA required) | Verifies credentials and assigns tiers, manages catalog and configuration, adjudicates disputes, reconciles finances |

## Tech Stack

| Layer | Technology |
|---|---|
| Patient web | React 18 + Vite, TypeScript |
| Nurse web portal | React 18 + Vite, TypeScript (elder-friendly standard: large type, ≥ 48 dp touch targets) |
| Nurse mobile app | React Native 0.74, TypeScript (Android 8.0+ / iOS 13+, install size < 50 MB) |
| Admin web | React 18 + Vite, TypeScript |
| Backend API | Node.js 20 + TypeScript (`pg`, `ioredis`, Zod validation) — REST under `/api/v1` |
| Database | PostgreSQL 16 — 25 tables, SQL-first migrations (ADR-0002) |
| Job queue & locks | Redis 7 (business timers, matching locks, settlement/dispute clocks) |
| File storage | Private object storage (S3/MinIO); CCCD/GPHN/order/selfie images only via presigned URLs (10-minute validity) |
| Notifications | FCM push (high priority for urgent), in-app centre, WebSocket realtime, SMS/ZNS fallback |
| Payments | Sandbox gateways (PayOS / VNPay / VietQR); MVP escrow is **simulated** — an internal ledger, never represented as licensed escrow |
| Tooling | npm workspaces monorepo, Docker Compose for local services |

## Repository Structure

```
.
├── apps/
│   ├── patient-web/        # Patient & family web (React + Vite)
│   ├── nurse-web/          # Nurse web portal (React + Vite)
│   ├── nurse-app/          # Nurse mobile app (React Native)
│   └── admin-web/          # Admin / operator console (React + Vite)
├── services/
│   └── api/                # Backend API (Node.js + TypeScript)
│       └── src/
│           ├── core/       # database, jobs, audit, notifications, storage, config, middleware
│           └── modules/    # 36 business modules, created per phase (see modules/README.md)
├── packages/
│   └── shared/             # Shared enums, config keys, money helpers and types — single source of truth
├── db/
│   ├── migrations/         # Forward-only SQL migrations (0001 = 25-table SRS v2.0 schema)
│   ├── seeds/              # system_configs (§5.1), service catalog (§4.2), holidays, synthetic demo accounts
│   └── tests/              # Schema & constraint test suites by domain (Vitest, real PostgreSQL 16)
├── infra/
│   └── docker/             # Local PostgreSQL 16 + Redis via Docker Compose
├── docs/                   # Specification & project documentation (see below)
└── .github/
    ├── CODEOWNERS          # Review ownership mapped to the FE/BE role split
    └── workflows/          # CI quality gate definitions
```

Each frontend app organises code under `src/features/<feature>/` (one feature per user journey, mapped 1-to-1 to a backend module); each backend module follows the standard 8-file layout (`routes / service / repo / policy / jobs / types / schema / README`). Modules and features are created **when their development phase starts** — see [`services/api/src/modules/README.md`](services/api/src/modules/README.md).

## Documentation

The SRS is the source of truth. When code and documents disagree, **the documents win** until they are formally revised. Precedence: SRS v2.0 (Updated) → `docs/requirement/` → `docs/business_rule/` → `docs/user_stories/` → `docs/security/`.

| Area | Contents | Location |
|---|---|---|
| Requirements | Functional requirements (FR groups), non-functional requirements | [`docs/requirement/`](docs/requirement/) |
| Business rules | Rule groups A–G as revised per SRS v2.0, plus the open-decisions register (OD-01–OD-12) | [`docs/business_rule/`](docs/business_rule/) |
| User stories | Stories by epic (A–I) with acceptance criteria | [`docs/user_stories/`](docs/user_stories/) |
| Security | Security specification SEC-00–SEC-10 | [`docs/security/`](docs/security/) |
| Database schema | PostgreSQL 16 DDL — 25 tables (16 SRS §7 + 9 additions from the ERD) | [`docs/database/schema.sql`](docs/database/schema.sql) |
| Design diagrams | ERD and design files | [`docs/design/`](docs/design/) |
| Architecture decisions | ADR-0001 (record architecture decisions), ADR-0002 (SQL-first database layer) | [`docs/adr/`](docs/adr/) |
| Development checklist | Golden rules, 9 phases (0–8), 36 modules with FE/BE assignment, pre-merge gates | [`docs/development/development_checklist.md`](docs/development/development_checklist.md) |
| Test strategy | Tiered testing strategy traced to the SRS §10 RTM | [`docs/testing/test-strategy.md`](docs/testing/test-strategy.md) |
| API contracts | Core endpoint catalogue; per-module contracts are added as modules are built | [`docs/api/`](docs/api/) |
| Runbooks | Operational playbooks | [`docs/runbooks/`](docs/runbooks/) |

## Getting Started

**Prerequisites:** Node.js ≥ 20, npm ≥ 10, Docker (for local PostgreSQL/Redis).

```bash
# 1. Clone and install
git clone https://gitlab.com/group39671542/HealthCareSystem.git
cd HealthCareSystem
npm install

# 2. Start local infrastructure (PostgreSQL 16 + Redis)
#    On first start the database container auto-applies db/migrations and db/seeds.
npm run docker:up

# 3. Run the applications (separate terminals)
npm run dev:api        # Backend API (services/api)
npm run dev:patient    # Patient web (apps/patient-web)
npm run dev:nurse-web  # Nurse web portal (apps/nurse-web)
npm run dev:admin      # Admin web (apps/admin-web)
npm run dev:nurse-app  # Nurse mobile app bundler (apps/nurse-app; then run android / ios from that workspace)

# 4. Verify
npm run build          # Build all workspaces
npm test               # Run workspace test suites
```

Environment variables are documented in [`services/api/.env.example`](services/api/.env.example).

## Testing

Testing follows the tiered strategy in [`docs/testing/test-strategy.md`](docs/testing/test-strategy.md), traced to the SRS §10 RTM: database constraint suites (grouped by domain — identity, availability, booking, shift, wallet, dispute, review), business-rule unit tests (≥ 80% decision-branch coverage for money, authorization and tier-gate modules), API/authorization matrix tests, external contract tests, job & timer tests, end-to-end journeys, and security testing.

```bash
npm run test:unit      # API unit tests (services/api)
npm run test:db        # Schema & constraint tests against a real PostgreSQL 16 (db/tests)
```

## Development Workflow

- Work happens on `develop`; `main` holds the stable line. Every change goes through a GitLab merge request with at least one reviewer — `CODEOWNERS` routes reviews to the owner of each area (FE-1 patient/admin web, FE-2 nurse web/app, BE-1 platform/identity, BE-2 booking/shift, BE-3 money/post-shift).
- Branch names: `feature/<short-description>`, `fix/<short-description>`, `docs/<short-description>`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`…
- Every merge request must cite the SRS identifiers it implements (e.g. "implements FR-PAY-02, TC-PAY-01") so work stays traceable to the specification.
- Merge requests touching authentication/OTP, authorization, the tier gate, payments/wallets or medical-record access require a security review and negative test cases.
- Business changes are made in the specification documents first, code second.

## Non-Negotiable Business Rules

- **Phone number is the identity** — login is phone + OTP; Admin accounts additionally require 2FA. There is no email-only login.
- **`profile_status` decides job eligibility** — never `users.status` or `users.kyc_status`; the tier hard-gate is enforced on the **backend** (HTTP 403) on every invasive-service path, never by hiding UI.
- **The deposit is for penalties only** — `deposit_balance` is debited solely for SLA penalties (`PENALTY_DEDUCT`). Cash-job commission is self-paid by the nurse via the generated payment link within 24 h of check-out and is **never** deducted from any wallet.
- **Money moves only through the ledger** — every movement is an append-only `wallet_transactions` entry with a unique `idempotency_key`; balances change only inside ACID transactions with row locking.
- **No hardcoded business values** — commission rate, deposit minimum, surcharges, radii and deadlines live in `system_configs` (SRS §5.1) and are read at runtime.
- **Medical records are time-boxed** — the assigned nurse may view a patient's record and doctor's-order images only from `CONFIRMED` until 12 hours after check-out; every view is audit-logged; exceptional re-grants are time-limited and audited.
- **All business timers run on the shared job queue** — payment timeout (15 min), Radar expansion, settlement release (+24 h), record-access closure (+12 h), commission deadline (+24 h), rating visibility, GPHN expiry sweep. No ad-hoc `setTimeout` deadlines.
- **No AI clinical decisions** — matching, gating, TrustScore and leak scanning are deterministic rules; medical safety is enforced by structure (catalog gating) and humans (Tier 2 order review, Admin credential review).

## Project Status & Roadmap

- [x] Marketplace pivot adopted; governing baseline is SRS v2.0 (Updated, 28/10/2026)
- [x] Full `docs/` tree rewritten to the SRS v2.0 baseline (83 files)
- [x] ERD finalised at 25 tables; schema reconciled and verified on a real PostgreSQL 16
- [x] Shared package aligned (enums, config keys, money helpers); domain constraint test suites in `db/tests`
- [x] Phase 0 scaffold: 4 app shells with feature structure, API core services, `CODEOWNERS`
- [ ] Phase 1 — AUTH: identity, eKYC, tiers & privacy
- [ ] Phase 2 — Availability & nurse search
- [ ] Phase 3 — Booking, pricing, prescription gate & matching
- [ ] Phase 4 — Shift execution, anti-fraud check-in & SOS
- [ ] Phase 5 — Wallets, escrow, settlement, deposit & withdrawals
- [ ] Phase 6 — Disputes, reviews/TrustScore, notifications & chat
- [ ] Phase 7 — Admin: catalog, configuration & reconciliation
- [ ] Phase 8 — Hardening: penetration test, DR drill, UAT and MVP go-live sign-off

## Project Team

| Name | GitLab | Role |
|---|---|---|
| Nguyễn Hữu Phúc | [@NguyenHuuPhuc-Dev21](https://gitlab.com/NguyenHuuPhuc-Dev21) | Frontend |
| Nguyễn Nho Trường Phát | [@phatnguyen.02102005](https://gitlab.com/phatnguyen.02102005) | Frontend |
| Võ Thị Mỹ Xuân | [@Myxuan10](https://gitlab.com/Myxuan10) | Backend |
| Tô Thị Oanh | [@W3n3r](https://gitlab.com/W3n3r) | Backend |
| Kiều Đình Đức | [@KieuDuc179](https://gitlab.com/KieuDuc179) | Backend |

## Contact & License

- **Repository:** [gitlab.com/group39671542/HealthCareSystem](https://gitlab.com/group39671542/HealthCareSystem)
- **License:** Proprietary — all rights reserved. A public license has not been issued for this project yet.
