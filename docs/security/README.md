# HealthCareSystem On-Demand Nursing Platform — Security & Privacy Architecture

> **Governing Baseline:** SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
> **Applicable Scope:** Entire platform ecosystem (Patient Web/App, Nurse Web Portal, Nurse Mobile App, Admin Web Portal, APIs, payment gateway webhooks, object storage, background workers)
> **Compliance & Legal Frameworks:** OWASP Top 10 (2021), OWASP API Security Top 10 (2023), OWASP ASVS Level 2; Vietnam Decree 13/2023/ND-CP on Personal Data Protection (health data = **Sensitive Personal Data**); Law on Medical Examination and Treatment 15/2023/QH15 (practice licence — GPHN)
> **Original Vietnamese Baseline:** Preserved in [`archive/security-rules.vi.md`](archive/security-rules.vi.md)

---

## 1. Priority Classification System

Every security policy across the catalog is explicitly classified by implementation priority:

| Priority Level | Milestone Target | Definition |
|---|---|---|
| **[P0]** | **Mandatory MVP Blocker** | Critical security control required before the MVP (SRS §1.2, Phase 1) goes live with real customers and nurses. Launch cannot proceed if any [P0] rule is unsatisfied. |
| **[P1]** | **Mandatory Commercial Go-Live** | Mandatory control required before commercial operation with real money movement (replacing the simulated escrow / sandbox gateway with a licensed payment intermediary). |
| **[P2]** | **Continuous Roadmap Hardening** | Strategic hardening and continuous assurance enhancements implemented according to product roadmap (including Phase 2 scope). |

Where a control below is carried over from the previous baseline but is **not specified in SRS v2.0**, it is marked *(retained engineering standard — not specified in SRS v2.0)*.

---

## 2. Security Policy Catalog

The platform's security policies are modularized into 11 specialized policy documents:

| Policy Group | Document | Primary Scope & Protective Controls |
|---|---|---|
| **Group 0** | [**`sec-00-foundational-principles.md`**](sec-00-foundational-principles.md) | **Foundational Architecture & Security Axioms**<br>Zero trust on clients, least privilege, deny by default, defense in depth, auditability, and the marketplace trust boundaries (4 client surfaces, gateway webhooks, object storage). |
| **Group 1** | [**`sec-01-authentication-and-session-management.md`**](sec-01-authentication-and-session-management.md) | **Authentication & Session Management**<br>Phone + OTP login (request/verify), eKYC identity proofing (CCCD + live selfie), mandatory Admin 2FA with IP/DeviceID logging, session lifecycle across web and mobile. |
| **Group 2** | [**`sec-02-authorization-and-multitenant-isolation.md`**](sec-02-authorization-and-multitenant-isolation.md) | **Authorization & Role/Ownership Isolation**<br>RBAC (Customer / Nurse / Admin / Super Admin), tier hard-gating (TIER_1_BASIC blocked from invasive services), object ownership checks, medical-record access window, BOLA/IDOR prevention. *(File name retained from the previous baseline; multi-tenant isolation no longer applies — the platform has no hospital tenants.)* |
| **Group 3** | [**`sec-03-data-protection-and-privacy.md`**](sec-03-data-protection-and-privacy.md) | **Data Protection & Privacy (Decree 13/2023/ND-CP)**<br>Data classification (CCCD, GPHN, health records, chat logs, location), TLS 1.3 & AES-256, signed URLs, consent lifecycle (FR-PRIV-01), retention and erasure/anonymization. |
| **Group 4** | [**`sec-04-api-security-and-input-validation.md`**](sec-04-api-security-and-input-validation.md) | **API Security & Input Validation**<br>Whitelist validation and mass-assignment defense for the SRS §8 endpoint set, injection/XSS prevention, CSRF/CORS, rate limiting and anti-enumeration. |
| **Group 5** | [**`sec-05-payments-and-financial-integrity.md`**](sec-05-payments-and-financial-integrity.md) | **Payments, Escrow Ledger & Gateway Webhooks**<br>Zero cardholder data footprint, server-authoritative pricing from `system_configs`, HMAC-SHA256 webhook verification, idempotency keys, append-only wallet ledger, deposit-integrity and cash-commission rules. |
| **Group 6** | [**`sec-06-concurrency-and-business-logic-integrity.md`**](sec-06-concurrency-and-business-logic-integrity.md) | **Concurrency & Business Logic Integrity**<br>First-come job claiming, schedule-conflict prevention, exactly-once settlement, OTP and commission deadline races, non-blocking emergency SOS. |
| **Group 7** | [**`sec-07-file-uploads-and-clinical-content.md`**](sec-07-file-uploads-and-clinical-content.md) | **File Uploads & Clinical Content**<br>Upload pipeline for CCCD/GPHN/doctor's-order/care images, malware scanning, private storage, 10-minute signed URLs, live-capture-only check-in selfies, EXIF handling. |
| **Group 8** | [**`sec-08-infrastructure-and-deployment-hardening.md`**](sec-08-infrastructure-and-deployment-hardening.md) | **Infrastructure, Deployment & Network Hardening**<br>HTTPS & security headers, centralized secrets management, restrictive CORS for the 4 client surfaces, environment isolation, dependency auditing, encrypted backups with PITR. |
| **Group 9** | [**`sec-09-logging-observability-and-incident-response.md`**](sec-09-logging-observability-and-incident-response.md) | **Logging, Observability & Incident Response**<br>`audit_logs` coverage (GPHN approvals, dispute decisions, config changes, record views, money movements), SOS alerting, 72-hour breach notification, isolated log retention. |
| **Group 10** | [**`sec-10-secure-development-and-testing-lifecycle.md`**](sec-10-secure-development-and-testing-lifecycle.md) | **Secure Development Lifecycle & Verification**<br>DevSecOps CI gates aligned to the SRS §10 RTM security test cases, ASVS Level 2 verification, independent penetration testing before commercial go-live, threat modeling. |

---

## 3. The 8 Non-Negotiable Security Invariants

These 8 security axioms must never be violated under any operational circumstance or emergency hotfix:

| # | Security Invariant | Authoritative Rules | Baseline Grounding |
|---|---|---|---|
| **1** | **Universal Server-Side Authorization**<br>Every API request evaluates: Role × Ownership/Relationship × Session × Object State (the booking's 3-axis state). Frontend UI hiding is never a security boundary. | [SEC-2.1](sec-02-authorization-and-multitenant-isolation.md) | **SRS §8** (role column), **FR-PRIV-01** |
| **2** | **Tier Hard-Gating & Prohibited-Service Block**<br>A `TIER_1_BASIC` nurse can never claim or be matched to an `is_invasive = true` service (HTTP `403`); a service with `is_prohibited = true` can never be booked at all. Tier and claim rights derive only from `nurse_profiles` (`profile_status`, `tier`, `gphn_expiry_date`). | [SEC-2.3](sec-02-authorization-and-multitenant-isolation.md) | **FR-AUTH-02**, **SRS §4.2 service catalog**, **TC-AUTH-01…03** |
| **3** | **Medical-Record Access Window**<br>Only the nurse assigned to a booking may view that patient's record and doctor's-order images, only from `CONFIRMED` until **12 hours after check-out**; access then auto-revokes. Every view is written to `audit_logs`. | [SEC-2.4](sec-02-authorization-and-multitenant-isolation.md), [SEC-3.6](sec-03-data-protection-and-privacy.md) | **FR-PRIV-01**, **TC-PRIV-01** |
| **4** | **Separation of Verification Mechanisms**<br>Login OTP codes, eKYC/liveness artifacts, signed-URL tokens, and webhook secrets are distinct mechanisms with independent stores, scopes, and lifecycles; none may be substituted for another. | [SEC-1.6](sec-01-authentication-and-session-management.md) | **SRS §8** (`/auth/request-otp`, `/auth/verify-otp`), **NFR-SEC-01** |
| **5** | **Signed Webhooks & Idempotent Money Movement**<br>Payment webhooks without a valid HMAC-SHA256 signature are rejected (HTTP `401`). Every wallet movement carries a unique `idempotency_key`; the wallet ledger (`wallet_transactions`) is append-only — in-place edits and deletions are prohibited. | [SEC-5.3](sec-05-payments-and-financial-integrity.md), [SEC-5.4](sec-05-payments-and-financial-integrity.md), [SEC-5.5](sec-05-payments-and-financial-integrity.md) | **FR-PAY-01**, **SRS §9.1**, **TC-PAY-01/02** |
| **6** | **Deposit Integrity**<br>The nurse deposit balance (`deposit_balance`, minimum 300,000 VND) may be debited **only** for SLA penalties (`PENALTY_DEDUCT`). It must never be used to collect the 15% commission on cash jobs; commission is paid by the nurse's own transfer via the commission payment link. | [SEC-5.7](sec-05-payments-and-financial-integrity.md), [SEC-5.8](sec-05-payments-and-financial-integrity.md) | **FR-PAY-02**, **FR-PAY-03**, **TC-WALLET-01** |
| **7** | **Unconditional Emergency SOS Access**<br>An in-shift SOS must never be throttled, delayed, or blocked: the app immediately opens the 115 emergency dialer and simultaneously alerts family and the Admin Portal with live location. Silent background scheduler failures must raise critical alerts. | [SEC-6.6](sec-06-concurrency-and-business-logic-integrity.md), [SEC-9.2](sec-09-logging-observability-and-incident-response.md) | **FR-SHIFT-05**, **TC-SOS-01** |
| **8** | **Zero Sensitive Data in Logs; Zero Real Patient Data in Non-Production**<br>Application logs must exclude health data, chat content, OTPs, tokens, passwords, and card data. Production health data must never be replicated to staging or development; test fixtures use synthetic data only. | [SEC-3.5](sec-03-data-protection-and-privacy.md), [SEC-8.4](sec-08-infrastructure-and-deployment-hardening.md) | **Decree 13/2023**, **FR-PRIV-01** |

---

## 4. Precedence & Governance

When software implementations and architectural specifications diverge, the governing hierarchy of authority is:
1. **SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)** — functional requirements, state machines, SLA/config tables (§5), database schema (§7), API specification (§8), and RTM acceptance criteria (§10).
2. **Security & Privacy Architecture** (`docs/security/`) — this catalog. Where the SRS is silent, controls marked *(retained engineering standard)* apply as engineering policy, not as SRS requirements.
3. **Requirements & Business Documentation** (`docs/requirement/`, `docs/business_rule/`, `docs/user_stories/`) as revised per SRS v2.0.
