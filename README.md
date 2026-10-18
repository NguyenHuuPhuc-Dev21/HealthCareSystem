# Home-Care Nursing Platform — HealthCareSystem

> A multi-tenant SaaS platform for hospitals: patients book hospital nurses for home care — scheduling, nurse matching, in-home care sessions, payment and reconciliation — with symptom screening and an emergency SOS flow built in.

![Status](https://img.shields.io/badge/stage-design_baseline_frozen-blue)
<!-- Keep build/CI badges only once CI actually runs on this repo. A fake badge costs more credibility than no badge. -->

---

## 1. Overview

After discharge, patients often still need care at home — wound dressing, injections, post-surgical care — but nurse dispatch is currently coordinated manually by phone: nothing is traceable, deposits cannot be reconciled, and there is no standard procedure when an incident happens at the patient's home.

This project digitizes the full lifecycle of a home-care visit: the patient books an appointment → the system matches a suitable nurse → the nurse travels, checks in and performs the visit → a care report is filed (mandatory) → payment, deposit refunds and end-of-period reconciliation are handled inside the system.

## 2. Pilot (MVP) scope

Per decision Q-23 in the design documents:

- A single hospital
- Advance booking only (no instant booking / fast matching yet)
- Gateway payments only (no cash collection)
- Symptom screening by rule engine + on-duty doctor review (the AI does not conclude on its own)
- SOS: notify and escalate to the responsible staff within 5 minutes — the system does **not** auto-call 115 (the national emergency number) in the MVP

Out of pilot scope: cash at the patient's home, instant booking, automatic reconciliation deductions, national-ID / age verification.

## 3. Who uses the system

| Role | Description |
|---|---|
| Patient / Family member | Registers with email, books visits, tracks sessions, pays, presses SOS (UC140) |
| Nurse | Accepts assignments, departs & checks in, performs visits, files care reports |
| Doctor | Reviews screening results, handles cases flagged for early review |
| Hospital Admin | Verifies staff profiles, coordinates dispatch, handles complaints & manual refunds (UC90) |
| Platform Admin | Manages tenants (hospitals), configuration, and escalated financial decisions (BR-18) |

## 4. Design documents (source of truth)

| Document | Contents | Location in repo |
|---|---|---|
| `use_case_diagram.drawio` | 140 use cases (UC1–UC140), 23 business rules (BR-01–BR-23) | `docs/design/` |
| `workflow_diagram.drawio` | 17 activity flows + traceability matrix (page 00c) | `docs/design/` |
| `erd_diagram.drawio` | Physical ERD draft & schema dictionary | `docs/design/` |
| Decision register Q-01–Q-51 | Lives on page 00b of the flow file; a feature whose decision has no value yet must not be built | inside the flow file |
| `User Stories Catalog` | 27 Must User Stories modularized with ACs & Acceptance Test Cases | `docs/user_Stories/` |
| `Business Rules Catalog` | 23 Business Rules (BR-01–BR-23) + Table F modularized by domain groups | `docs/business_rule/` |
| `Requirements Specifications` | Functional (FR-01–FR-11) & Non-Functional (NFR-01–NFR-09) Specifications | `docs/requirement/` |
| `Security & Privacy Architecture` | 11 Policy Groups (SEC-00–SEC-10) & 8 Non-Negotiable Invariants | `docs/security/` |
| `Test Strategy Specification` | Comprehensive 9-Tier Quality Assurance & Traceability Strategy | `docs/testing/` |
| `Development & Engineering Checklist` | Phase-by-phase implementation gates & pre-merge checklists | `docs/development/` |

Rule: when code and documents disagree, **the documents win** until they are revised and versioned. Business changes are made in the design files first, code second.

## 5. Non-negotiable business rules

- Login is **email-only** (password + email OTP); 2FA is mandatory for staff. No SMS, no national ID collection (BR-20).
- The in-session check-in code is an in-app code, **not** the account email OTP (BR-20).
- A care report is **mandatory** after every visit, even when the patient added no symptoms before the session (BR-22).
- Money decided on timeout must follow the financial decision table BR-18 (F1a/F1b…F9) — never invent a default in code.
- Every business configuration (fees, thresholds, deadlines) is **effective-dated** — never overwrite values in place and lose history.

## 6. Tech stack

<!-- [TBD — fill in once the team decides. Never list technology that is not actually used.] -->

| Layer | Technology |
|---|---|
| Mobile apps (patient / nurse) | _[TBD]_ |
| Admin web | _[TBD]_ |
| Backend / API | _[TBD]_ |
| Database | _[TBD — the draft ERD assumes a relational model]_ |
| Payments | Payment gateway _[partner TBD]_ |

## 7. Repository layout (proposed)

```
.
├── README.md
├── docs/
│   └── design/          # .drawio files + ERD — the business source of truth
├── apps/                # [once coding starts]
│   ├── patient-app/
│   ├── nurse-app/
│   └── admin-web/
├── services/            # backend
└── infra/               # docker, CI, deployment scripts
```

## 8. Getting started

<!-- [Fill in once there is runnable code. A professional README never leaves this
     section empty for long: a newcomer must be running the project in 3–5 commands.] -->

```bash
# [skeleton example — replace with the real commands]
git clone <repo-url>
cd <repo-name>
# cp .env.example .env   # then fill in the values
# <install command>
# <run command>
```

## 9. Contributing

- The `main` branch is protected: no direct pushes, no force-push; every change goes through a Pull Request with at least one reviewer.
- Branch names: `feature/<short-description>`, `fix/<short-description>`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`…
- Every PR must cite the use cases / business rules it implements (e.g. "implements UC90, BR-18 F1b") so work stays traceable to the specification.
- Do not commit draw.io backup files (`*.drawio.bkp`, `~$*`) — they are covered by `.gitignore`.

## 10. Project status & roadmap

- [x] Use-case specification + activity flows (baseline v8.1 / 8.14)
- [x] Physical ERD draft
- [ ] Sign off the official state enums (page 00c of the flow file is still a draft)
- [ ] Decide Q-03 (minimum home-visit fee) and Q-11 (deposit invoice timing)
- [ ] Bootstrap code + CI
- [ ] Pilot at one hospital

## 11. Contact & license

- Development team: Group 3
