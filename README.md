# HealthCareSystem — Hospital Home-Care Nursing Platform

> A multi-tenant SaaS platform that lets hospitals deliver nursing care at patients' homes: advance booking, automated nurse matching, verified in-home care sessions, gateway payments with deposit reconciliation, and an emergency SOS workflow — fully traceable from booking to care report.

[![CI Quality Gate](https://github.com/NguyenHuuPhuc-Dev21/HealthCareSystem/actions/workflows/ci.yml/badge.svg)](https://github.com/NguyenHuuPhuc-Dev21/HealthCareSystem/actions/workflows/ci.yml)
![Stage](https://img.shields.io/badge/stage-specification_frozen_·_implementation_scaffolded-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6)
![React](https://img.shields.io/badge/React-18-61DAFB)
![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-20-339933)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1)

---

## Overview

After discharge, many patients still need professional care at home — wound dressing, injections, IV therapy, post-surgical follow-up. Today, hospitals coordinate this by phone: assignments are untraceable, deposits cannot be reconciled, care is undocumented, and there is no standard procedure when something goes wrong at the patient's home.

**HealthCareSystem** digitizes the complete lifecycle of a home-care visit:

1. A patient (or a family member acting with consent) creates a care profile and completes symptom screening.
2. The system classifies the case into one of four triage groups; emergencies are redirected to emergency services, never to routine home care.
3. The patient books in advance and pays a deposit through the **hospital's own payment gateway** — the platform never holds patient funds.
4. The platform matches a qualified, credential-verified nurse and manages reminders, re-confirmation, and re-matching when plans change.
5. The nurse departs under GPS tracking, checks in at the patient's home with a geofence + in-app code, performs an initial assessment, and delivers care.
6. A **care report is mandatory** before the visit can close; the final bill is confirmed in two stages, the balance is settled online, and deposits are reconciled at period end.
7. At any moment, the patient or a relative can trigger an **SOS** that alerts the hospital's on-duty team immediately and escalates automatically if unacknowledged within 5 minutes.

Every step — money, status changes, violations, disputes — is recorded in append-only ledgers and audit logs, so any decision can be traced back to the rule that produced it.

## Pilot Scope (MVP)

The pilot scope is frozen by decision **Q-23** in the specification:

| In scope for the pilot | Out of scope (by design) |
|---|---|
| A single hospital tenant | Instant booking / fast auto-assignment |
| Advance booking only | Cash collection at the patient's home |
| Gateway payments only — no cash | Call-centre proxy booking (UC135, pending decision) |
| Rule-based symptom screening + on-duty doctor review (AI assists, never concludes alone) | Automated indemnity deductions |
| SOS notification with 5-minute escalation (the system does **not** auto-dial 115) | National-ID (CCCD) collection or age verification |

## Key Capabilities

- **Identity & consent** — Email-only accounts (password + email OTP); mandatory 2FA for staff; two-step staff credential verification (BR-21); per-profile consent with email-link confirmation for relatives, withdrawal, and re-consent on terms changes (BR-17); data erasure within 72 hours (BR-12).
- **Screening & clinical safety** — Deterministic four-group triage with versioned rules (BR-10); supplemental symptoms accepted up to T−1h with re-triage; service-specific clinical forms for the initial assessment and the mandatory care report (BR-22).
- **Booking & matching** — Advance booking (T+2h to T+14 days) inside hospital operating windows; qualification-, schedule- and area-aware matching; automatic re-matching rounds; manual dispatch fallback (BR-01, BR-03, BR-13, BR-14).
- **Visit execution** — Departure deadlines and live GPS tracking, abandonment ("no-show") detection, geofenced check-in with an in-app code, in-session add-on items in three classes with patient confirmation, and mid-session stops with rule-based fee handling (BR-07, BR-15, BR-16).
- **Payments & reconciliation** — 30% deposit (minimum 50,000 VND) with a 15-minute payment window; tiered refunds; two-stage bill confirmation; manual refund orders with vouchers (UC90); end-of-period deposit reconciliation across four buckets; all financial outcomes on timeout decided by the BR-18 matrix (F1a–F9) — never by ad-hoc code defaults.
- **Violations, complaints & disputes** — Sliding-window violation tracking with technical lock/unlock (including the 24-hour auto-unlock safeguard, Q-43); fee-line disputes split into unpaid (F1a) and paid (F1b) branches with escalation to the Platform Admin; patient abuse flagging (BR-02, BR-11, BR-18, BR-19).
- **Emergency SOS** — One-tap SOS for patients and relatives, immediate in-app alerting to on-duty responders, per-level escalation events, and mandatory resolution notes before an incident can close (BR-23).
- **Platform administration** — Multi-tenant configuration with effective-dated values (prices, service areas, thresholds, SLAs, on-duty contacts), overdue-queue monitoring, and full audit traceability (BR-09).

## User Roles

| Role | Responsibilities |
|---|---|
| **Patient / Family member** | Registers with email, manages care profiles and consent, books and pays, tracks the visit, confirms add-ons and bills, triggers SOS (UC140) |
| **Nurse** | Manages availability, accepts assignments, departs and checks in, performs visits, files care reports |
| **Doctor** | Reviews screening results and high-risk cases, verifies prescriptions, handles follow-up and SOS incidents |
| **Hospital Admin / Dispatcher** | Verifies staff credentials, coordinates dispatch, adjudicates violations, complaints and manual refunds (UC90) |
| **Platform Admin** | Onboards hospital tenants, manages platform configuration, arbitrates escalated financial disputes (BR-18 F1b) |

## Tech Stack

The stack was confirmed on 2026-10-18 and is reflected in the repository scaffolding. Architecture decisions are recorded in [`docs/adr/`](docs/adr/).

| Layer | Technology |
|---|---|
| Patient web (booking portal, PWA) | React 18 + Vite, TypeScript |
| Nurse mobile app | React Native 0.74, TypeScript (background GPS & geofencing are hard requirements — BR-07) |
| Admin web (hospital & platform) | React 18 + Vite, TypeScript |
| Backend API | Node.js 20 + TypeScript (`pg`, Redis client, Zod validation) |
| Database | PostgreSQL 16 — relational model, SQL-first migrations (ADR-0002) |
| Job queue & cache | Redis 7 (deposit windows, reminders, SLA timers, SOS escalation) |
| File storage | Private cloud object storage; health images served only via short-lived signed URLs (≤ 15 min) |
| Channels | Transactional email + push notifications (FCM/APNs) — **no SMS** (BR-20) |
| Payments | Hospital's payment gateway (signed, idempotent webhooks); funds settle directly to the hospital |
| Tooling | npm workspaces monorepo, Docker Compose for local services, GitHub Actions CI |

## Repository Structure

```
.
├── apps/
│   ├── patient-web/        # Patient & family booking portal (React + Vite, PWA)
│   ├── nurse-app/          # Nurse field application (React Native)
│   └── admin-web/          # Hospital & platform administration (React + Vite)
├── services/
│   └── api/                # Backend API (Node.js + TypeScript)
├── packages/
│   └── shared/             # Shared enums, constants and types — single source of truth for states
├── db/
│   ├── migrations/         # Forward-only SQL migrations (0001_initial_schema.sql)
│   ├── seeds/              # Reference data & the canonical demo case (#MH-8824)
│   └── tests/              # Tier-1 schema & constraint test suite (Vitest, real PostgreSQL 16)
├── infra/
│   └── docker/             # Local PostgreSQL 16 + Redis via Docker Compose
├── docs/                   # Specification & project documentation (see below)
└── .github/workflows/      # CI Quality Gate: lint/typecheck, DB constraints, secret scanning
```

## Documentation

The specification is the source of truth for this project. When code and documents disagree, **the documents win** until they are formally revised. Precedence: use-case diagram → activity flows → user stories / requirements.

| Area | Contents | Location |
|---|---|---|
| Design diagrams | Use-case diagram (140 UCs), workflow diagrams (17 flows), ERD | [`docs/design/`](docs/design/) |
| Business rules | BR-01–BR-23 + supplementary rules, grouped by domain; open-decisions register (Q-01–Q-51) | [`docs/business_rule/`](docs/business_rule/) |
| User stories | 27 Must stories for the pilot (ACs + acceptance test cases), 10 Should stories | [`docs/user_stories/`](docs/user_stories/) |
| Requirements | Functional (FR-01–FR-11) and non-functional (NFR-01–NFR-09) specifications | [`docs/requirement/`](docs/requirement/) |
| Security | Security policy groups SEC-00–SEC-10 | [`docs/security/`](docs/security/) |
| Database schema | Reviewed PostgreSQL 16 DDL (75 tables) — the specification copy of the schema | [`docs/database/schema.sql`](docs/database/schema.sql) |
| Architecture decisions | ADR-0001 (record architecture decisions), ADR-0002 (SQL-first database layer) | [`docs/adr/`](docs/adr/) |
| Development guide | Golden rules, phase-by-phase module checklist, pre-merge gates | [`docs/development/development_checklist.md`](docs/development/development_checklist.md) |
| Test strategy | Nine-tier testing strategy with full US/BR/FR/NFR traceability | [`docs/testing/test-strategy.md`](docs/testing/test-strategy.md) |
| API contracts | Per-module API contract definitions | [`docs/api/`](docs/api/) |
| Runbooks | Operational playbooks for the four standard incidents (NFR-09.5) | [`docs/runbooks/`](docs/runbooks/) |

## Getting Started

**Prerequisites:** Node.js ≥ 20, npm ≥ 10, Docker (for local PostgreSQL/Redis).

```bash
# 1. Clone and install
git clone https://github.com/NguyenHuuPhuc-Dev21/HealthCareSystem.git
cd HealthCareSystem
npm install

# 2. Start local infrastructure (PostgreSQL 16 + Redis)
#    The database container auto-applies db/migrations and db/seeds on first start.
npm run docker:up

# 3. Run the applications (separate terminals)
npm run dev:api        # Backend API (services/api)
npm run dev:admin      # Admin web (apps/admin-web)
npm run dev:patient    # Patient web (apps/patient-web)
# Nurse app: cd apps/nurse-app && npm start   (then npm run android / npm run ios)

# 4. Verify
npm run build          # Build all workspaces
npm test               # Run workspace test suites
```

> **Current state:** the monorepo is scaffolded (workspaces, shared types, database schema/migration/seed, CI) and feature implementation proceeds phase by phase according to the [development checklist](docs/development/development_checklist.md). Environment variables are documented in [`services/api/.env.example`](services/api/.env.example).

## Testing

Testing follows the nine-tier strategy in [`docs/testing/test-strategy.md`](docs/testing/test-strategy.md): database constraint tests, business-rule unit tests (≥ 80% branch coverage required for financial, violation and authorization modules), API/authorization matrix tests, external contract tests, job & timer tests, end-to-end journeys, security testing (SEC-10), non-functional verification, and hospital UAT.

```bash
npm run test:unit      # Business-rule unit tests (services/api)
npm run test:db        # Schema & constraint tests against a real PostgreSQL 16 (db/tests)
```

Every pull request must pass the **CI Quality Gate**: lint & typecheck, database constraint suite on PostgreSQL 16, and automated secret scanning.

## Development Workflow

- The `main` branch is protected: no direct pushes, no force-push; every change goes through a Pull Request with at least one reviewer.
- Branch names: `feature/<short-description>`, `fix/<short-description>`, `docs/<short-description>`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`…
- Every PR must cite the use cases / business rules it implements (e.g. "implements UC90, BR-18 F1b") so work stays traceable to the specification.
- PRs touching authentication, authorization, payments or clinical data require a security review and negative test cases (SEC-10.1).
- Business changes are made in the design documents first, code second. Do not commit draw.io backup files (`*.drawio.bkp`) — they are covered by `.gitignore`.

## Non-Negotiable Business Rules

- **Email is the only identity** — password + email OTP; 2FA mandatory for staff; no SMS, no national-ID collection (BR-20). The in-session check-in code is an in-app code, **not** the account email OTP.
- **The platform never holds money** — deposits and payments settle directly to the hospital's gateway account (BR-05); every money movement is a new append-only ledger entry, never an in-place edit.
- **Timeouts are decided by the BR-18 matrix** (F1a–F9) — code must never invent a financial default; the cash-dispute case F5 is deliberately left open (Q-12).
- **A care report is mandatory** after every visit, even when the patient added no symptoms beforehand (BR-22).
- **Configuration is effective-dated** — fees, thresholds and deadlines are never overwritten in place; history must remain reproducible.
- **Access is enforced at the backend** with a four-factor check (role × hospital tenant × relationship × visit/profile context) on every route (BR-09); health files are private and served only via signed URLs.
- **Undecided items stay undecided** — features governed by an open decision in the Q register (e.g. Q-03 minimum visit fee, Q-11 deposit invoice timing) are built mechanism-first and parameterized, never hard-coded.

## Project Status & Roadmap

- [x] Use-case specification and activity flows frozen (baseline v8.1 / 8.14)
- [x] Business rules, user stories, FR/NFR and security specifications modularized in `docs/`
- [x] Database schema reviewed and verified on PostgreSQL 16 (75 tables)
- [x] Monorepo scaffolding: apps, API service, shared package, Docker infrastructure
- [x] CI Quality Gate (typecheck, database constraints, secret scanning)
- [ ] Official sign-off of state enums and open decisions (Q-03, Q-11, F1b default — Q-44)
- [ ] Feature implementation by phase (identity → booking → payments → visit execution → SOS → disputes)
- [ ] Independent penetration test and disaster-recovery drill (SEC-10.3, NFR-02.2)
- [ ] Hospital UAT and pilot go-live

## Contact & License

- **Development team:** Group 3
- **Repository:** [github.com/NguyenHuuPhuc-Dev21/HealthCareSystem](https://github.com/NguyenHuuPhuc-Dev21/HealthCareSystem)
- **License:** Proprietary — all rights reserved. A public license has not been issued for this project yet.
