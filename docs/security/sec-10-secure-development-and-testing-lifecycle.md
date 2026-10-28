# Security Policy Group 10 — Secure Development Lifecycle & Verification

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (§10 RTM & Acceptance Criteria, NFR-SEC-01) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | DevSecOps CI/CD Automation, Security Code Reviews, Penetration Testing, Threat Modeling |
| **Reference Frameworks** | OWASP ASVS (Application Security Verification Standard) — target **Level 2** per SRS §6; Shift-Left Security Practices |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |

---

## Secure Development Lifecycle (SDLC) Rules

### SEC-10.1 [P0] Security Review Gate on Merge
- Any Pull Request (PR) altering authentication (OTP), authorization/tier gating, session handling, wallet/payment logic, state machines, or health-data schemas requires mandatory sign-off from a designated security reviewer before merge.
- Reviewers must verify a formal security checklist:
  - Is server-side authorization independently verified per SEC-2.1 (role × ownership × session × state)?
  - Are tier and deposit gates enforced inside the locked transaction where required (SEC-2.3, SEC-6.2)?
  - Are all inputs validated against strict whitelists, with system-controlled fields blocked from mass assignment (SEC-4.1)?
  - Are `audit_logs` entries emitted for sensitive operations (SEC-9.1)?
  - Do negative and adversarial test cases accompany the feature, traceable to SRS §10 test case IDs?

### SEC-10.2 [P0] Automated CI Security Test Suite
- Automated security tests execute in CI on every pull request, implementing the security-relevant acceptance criteria of the SRS §10 RTM. Mandatory categories include:
  - **Tier-Gating Tests (TC-AUTH-01…03):** retirement-decision-only accounts stay `TIER_1_BASIC`; GPHN expiry auto-demotes and re-approval re-promotes; Tier-1 claim on an `is_invasive = true` booking returns HTTP `403`; `is_prohibited = true` services cannot be booked.
  - **Privacy & Access-Window Tests (TC-PRIV-01):** profile cannot be saved without health-data consent; after the record window closes (post-settlement / 12 h after check-out) the former nurse's record access returns HTTP `403`.
  - **Payment Integrity Tests (TC-PAY-01/02):** forged webhook signature → HTTP `401` and no balance change; the same webhook delivered 5 times → exactly one `ESCROW_HOLD`.
  - **Wallet & Deposit Tests (TC-WALLET-01, TC-WITHDRAW-01):** claim blocked (HTTP `403`) below the 300,000 VND deposit; commission never debits `deposit_balance`; withdrawal above `available_balance` rejected.
  - **State-Machine & Race Tests (TC-STATE-01, TC-DISP-01, TC-MATCH-01/02):** unpaid bookings expire at 15 minutes; a dispute opened at hour 20 blocks the hour-24 settlement; time-off or < 60-minute-buffer nurses never appear in matching results; radar expands 5 km → 10 km after 5 minutes.
  - **Anti-Fraud Tests (TC-SEC-01):** mock-location check-in is rejected and flagged in `shift_logs`.
  - **IDOR / Cross-User Tests:** identifier-swapping matrix across bookings, wallets, and records asserting HTTP `403`/`404` (SEC-2.5).
  - **Secret Scanning & Dependency Auditing:** git history scanned for credentials (e.g., Gitleaks, TruffleHog); dependencies scanned per SEC-8.5.
- All test data is synthetic (SEC-8.4). Any failing security test blocks the pipeline and prevents deployment.

### SEC-10.3 [P1] Independent Penetration Testing Prior to Commercial Go-Live
- Before commercial operation with real funds (and before the MVP pilot with real patients, proportionate to scope), and after any major redesign of authentication or financial subsystems, the platform must undergo independent third-party penetration testing.
- **Minimum Test Scope:**
  - OWASP Top 10 Web Application Vulnerabilities and OWASP API Security Top 10, targeting **ASVS Level 2** verification (SRS §6).
  - Tier-gate and role-escalation bypass attempts (Tier-1 → invasive service; customer → Admin endpoints).
  - Webhook forgery, replay, and idempotency abuse; commission-link manipulation on cash jobs.
  - Financial race conditions: double claim, double settlement, dispute-vs-settlement interleaving, withdrawal races.
  - Check-in spoofing: mock GPS, gallery/replayed selfies, timestamp manipulation.

### SEC-10.4 [P1] Threat Modeling for Emerging Capabilities
- Every major new capability or architectural modification undergoes structured threat modeling (e.g., STRIDE) during design, before coding.
- *Standing examples for this platform:* the cash-commission payment-link flow (link theft/replay, paying another nurse's commission, deadline-race suspension — SEC-6.5); automatic GPHN-expiry demotion (bookings in flight, re-promotion abuse); Phase 2 partial settlement (FR-DISP-02) and long-term contracts (FR-BOOK-04/05) before they enter scope.

### SEC-10.5 [P2] Coordinated Vulnerability Disclosure Policy
- Establish a public-facing security contact channel (`security@...`) accompanied by a documented Coordinated Vulnerability Disclosure policy (`security.txt`).
- Define published response SLAs and a safe-harbor policy for ethical security researchers reporting vulnerabilities.
