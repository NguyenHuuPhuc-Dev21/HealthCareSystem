# Security Policy Group 10 — Secure Development Lifecycle & Verification

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` |
| **Applicable Scope** | DevSecOps CI/CD Automation, Security Code Reviews, Penetration Testing, Threat Modeling |
| **Reference Frameworks** | OWASP ASVS (Application Security Verification Standard), Shift-Left Security Practices |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |

---

## Secure Development Lifecycle (SDLC) Rules

### SEC-10.1 [P0] Security Review Gate on Merge
- Any Pull Request (PR) altering authentication, authorization, session handling, financial logic, or clinical data schemas requires mandatory sign-off from a designated security reviewer before merge.
- Reviewers must verify a formal security checklist:
  - Is server-side authorization independently verified per **BR-09**?
  - Are all inputs validated against strict whitelists?
  - Are audit log entries emitted for sensitive operations?
  - Do negative and adversarial test cases accompany the feature?

### SEC-10.2 [P0] Automated CI Security Test Suite
- Automated security test suites must execute within the continuous integration (CI) pipeline on every pull request.
- **Mandatory Automated Test Categories:**
  - **IDOR / Cross-Tenant Tests:** Automated matrix swapping user and tenant identifiers, asserting HTTP `403` or `404` across all routes (**SEC-2.3**).
  - **State Machine Integrity Tests:** Asserting that invalid state transition requests are blocked (**SEC-6.3**).
  - **Payment Idempotency Tests:** Verifying that concurrent duplicate requests produce exactly one financial execution (**SEC-5.4**).
  - **Automated Secret Scanning:** Scanning git commits for exposed credentials and private keys (e.g., GitGuardian, TruffleHog).
  - **Dependency Auditing:** Scanning third-party dependencies for known vulnerabilities (**SEC-8.5**).

*Any failing security test must automatically block the CI pipeline and prevent deployment.*

### SEC-10.3 [P1] Independent Penetration Testing Prior to Go-Live
- Prior to the pilot launch with real patient users, and following any major architectural redesign of authentication or financial subsystems, the platform must undergo independent third-party penetration testing.
- **Minimum Test Scope:**
  - OWASP Top 10 Web Application Vulnerabilities.
  - OWASP API Security Top 10.
  - Cross-tenant data isolation escape scenarios.
  - Financial race conditions and balance manipulation vectors.

### SEC-10.4 [P1] Threat Modeling for Emerging Capabilities
- Every major new capability or architectural modification must undergo structured threat modeling (e.g., using STRIDE) during the design phase prior to coding.
- *Example Context:* If assisted phone hotline booking (**UC135**) is scheduled for implementation, a formal threat modeling session must resolve: how caller spoofing is mitigated, how legal consent is authoritatively confirmed via third parties, and how impersonation is prevented.

### SEC-10.5 [P2] Coordinated Vulnerability Disclosure Policy
- Establish a public-facing security contact channel (`security@...`) accompanied by a documented Coordinated Vulnerability Disclosure policy (`security.txt`).
- Define published response SLAs and a safe-harbor policy for ethical security researchers reporting vulnerabilities.
