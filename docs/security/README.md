# Home-Care Nursing Platform — Security & Privacy Architecture

> **Specification Baseline:** `use_case_diagram.drawio` + `workflow_diagram.drawio`  
> **Status:** Proposal — Pending Product Owner & Engineering Leadership Sign-off  
> **Applicable Scope:** Entire platform ecosystem (Patient, Nurse, Hospital Admin, SaaS Platform, APIs, Gateways, Infrastructure)  
> **Compliance & Legal Frameworks:** OWASP Top 10 (2021), OWASP API Security Top 10 (2023), OWASP ASVS; Vietnam Decree 13/2023/ND-CP on Personal Data Protection (Health data = **Sensitive Personal Data**)  
> **Original Vietnamese Baseline:** Preserved in [`archive/security-rules.vi.md`](archive/security-rules.vi.md)

---

## 1. Priority Classification System

Every security policy across the catalog is explicitly classified by implementation priority:

| Priority Level | Milestone Target | Definition |
|---|---|---|
| **[P0]** | **Mandatory Pilot Blocker** | Critical security control required prior to onboarding real patients and clinical staff in the pilot hospital. Launch cannot proceed if any [P0] rule is unsatisfied. |
| **[P1]** | **Mandatory Production Go-Live** | Mandatory enterprise control required before general commercial production release (multi-hospital launch). |
| **[P2]** | **Continuous Roadmap Hardening** | Strategic hardening and continuous assurance enhancements implemented according to product roadmap. |

---

## 2. Security Policy Catalog

The platform's security policies are modularized into 11 specialized policy documents:

| Policy Group | Document | Primary Scope & Protective Controls |
|---|---|---|
| **Group 0** | [**`sec-00-foundational-principles.md`**](sec-00-foundational-principles.md) | **Foundational Architecture & Security Axioms**<br>Zero trust on clients, least privilege by default, deny by default, defense in depth, and auditability. |
| **Group 1** | [**`sec-01-authentication-and-session-management.md`**](sec-01-authentication-and-session-management.md) | **Authentication & Session Management**<br>Email-only auth hardening, Argon2id password hashing, 5 mandatory OTP properties, mandatory staff 2FA, session invalidation, and account recovery SOP. |
| **Group 2** | [**`sec-02-authorization-and-multitenant-isolation.md`**](sec-02-authorization-and-multitenant-isolation.md) | **Authorization & Multi-Tenant Isolation**<br>4-factor backend authorization (BR-09), tenant boundary in every query, BOLA/IDOR prevention, sub-roles, and clinical data isolation. |
| **Group 3** | [**`sec-03-data-protection-and-privacy.md`**](sec-03-data-protection-and-privacy.md) | **Data Protection & Privacy (Decree 13/2023/ND-CP)**<br>Sensitive health data protection, TLS 1.2+ & AES-256, display masking, private in-app calling, consent lifecycle, 72h data erasure, and DPIA filing. |
| **Group 4** | [**`sec-04-api-security-and-input-validation.md`**](sec-04-api-security-and-input-validation.md) | **API Security & Input Validation**<br>Server-side whitelist validation, mass-assignment defense, parameterized queries, CSRF defenses, rate limiting, and business logic abuse controls. |
| **Group 5** | [**`sec-05-payments-and-financial-integrity.md`**](sec-05-payments-and-financial-integrity.md) | **Payments, Deposits & Gateway Webhooks**<br>Zero cardholder data footprint (PCI scope minimization), server-authoritative calculations, HMAC webhook verification, idempotency, and append-only ledgers. |
| **Group 6** | [**`sec-06-concurrency-and-business-logic-integrity.md`**](sec-06-concurrency-and-business-logic-integrity.md) | **Concurrency & Business Logic Integrity**<br>Server-authoritative temporal windows, atomic resource locking, state machine consistency, non-blocking emergency SOS, and background worker protection. |
| **Group 7** | [**`sec-07-file-uploads-and-clinical-content.md`**](sec-07-file-uploads-and-clinical-content.md) | **File Uploads & Clinical Form Content**<br>File upload verification pipeline, malware scanning, signed URLs, structured clinical schemas, stored XSS prevention, and EXIF metadata stripping. |
| **Group 8** | [**`sec-08-infrastructure-and-deployment-hardening.md`**](sec-08-infrastructure-and-deployment-hardening.md) | **Infrastructure, Deployment & Network Hardening**<br>HTTPS & security headers, centralized secrets management, restrictive CORS, absolute environment isolation, automated dependency auditing, and backup drills. |
| **Group 9** | [**`sec-09-logging-observability-and-incident-response.md`**](sec-09-logging-observability-and-incident-response.md) | **Logging, Observability & Incident Response**<br>Immutable append-only audit logging, real-time threat alerting, statutory 72h regulatory breach reporting, and centralized log isolation. |
| **Group 10** | [**`sec-10-secure-development-and-testing-lifecycle.md`**](sec-10-secure-development-and-testing-lifecycle.md) | **Secure Development Lifecycle & Verification**<br>DevSecOps CI gates, automated security regression tests, independent pre-launch penetration testing, threat modeling, and vulnerability disclosure. |

---

## 3. The 8 Non-Negotiable Security Invariants

These 8 security axioms must never be violated under any operational circumstance or emergency hotfix:

| # | Security Invariant | Authoritative Rules | Baseline Grounding |
|---|---|---|---|
| **1** | **Universal 4-Factor Server Authorization**<br>Every API request evaluates: Role × Relationship × Session × Object State. Frontend UI hiding is never a security boundary. | [SEC-2.1](sec-02-authorization-and-multitenant-isolation.md) | **BR-09** |
| **2** | **Absolute Multi-Tenant Isolation**<br>Tenant boundaries injected at the data query layer. Cross-hospital entity access must be mathematically impossible even if IDs are guessed. | [SEC-2.2](sec-02-authorization-and-multitenant-isolation.md), [SEC-2.3](sec-02-authorization-and-multitenant-isolation.md) | **SaaS Architecture** |
| **3** | **Strict Separation of Verification Code Types**<br>Account Email OTP ≠ In-Visit Check-in Code (UC40) ≠ Legal Consent Token. Each code has distinct lifecycles, scopes, and cryptographic stores. | [SEC-1.6](sec-01-authentication-and-session-management.md) | **BR-20** |
| **4** | **Server-Authoritative Pricing & Signed Webhooks**<br>All fees and deposits calculated exclusively by backend configuration. Payment webhooks without valid HMAC signatures are immediately rejected. | [SEC-5.2](sec-05-payments-and-financial-integrity.md), [SEC-5.3](sec-05-payments-and-financial-integrity.md) | **BR-04, BR-05** |
| **5** | **Idempotent Operations & Append-Only Financial Ledgers**<br>Every monetary movement generates an immutable journal entry. In-place edits and deletions are prohibited at the engine level. | [SEC-5.4](sec-05-payments-and-financial-integrity.md), [SEC-5.5](sec-05-payments-and-financial-integrity.md) | **Financial Core** |
| **6** | **Unconditional Emergency SOS Access**<br>Real-time patient emergency SOS triggers must never be throttled, delayed, or blocked. Silent background scheduler failures must raise critical alerts. | [SEC-6.4](sec-06-concurrency-and-business-logic-integrity.md), [SEC-6.5](sec-06-concurrency-and-business-logic-integrity.md) | **BR-23** |
| **7** | **Zero Sensitive Data in Log Streams**<br>Application logs must strictly exclude clinical symptoms, care reports, OTPs, auth tokens, passwords, and payment card numbers. | [SEC-3.5](sec-03-data-protection-and-privacy.md) | **Decree 13 / Privacy** |
| **8** | **Zero Real Patient Data in Non-Production Environments**<br>Production clinical health data must never be replicated to staging or development databases. Test fixtures must use synthetic data only. | [SEC-8.4](sec-08-infrastructure-and-deployment-hardening.md) | **Decree 13 / Compliance** |

---

## 4. Precedence & Governance

When software implementations and architectural specifications diverge, the governing hierarchy of authority is:
1. **Business Rules Catalog** (`use_case_diagram.drawio`, BR-01–BR-23)
2. **Activity Flows & State Machine** (`workflow_diagram.drawio`, Flows 01–17)
3. **Security & Privacy Architecture** (`docs/security/`)
4. **Requirements Specifications** (`docs/requirement/`)
