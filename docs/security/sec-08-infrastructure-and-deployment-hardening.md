# Security Policy Group 8 — Infrastructure, Deployment & Network Hardening

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (NFR-AVAIL-01, NFR-COMP-01, §9 integrations) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | Cloud Infrastructure, Network Perimeters, Secrets Management, CORS, Environment Isolation, Dependency Auditing, Backup & Disaster Recovery |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |
| **Protected Surfaces** | Four client surfaces (Patient Web, Patient Mobile App, Nurse Web Portal, Nurse Mobile App, Admin Web Portal), the Node.js/TypeScript API, Redis + job-queue workers, PostgreSQL, private object storage (S3/MinIO), and third-party integrations (payment gateway, FCM/APNs, SMS/ZNS, maps/geocoding). |

---

## Infrastructure & Deployment Hardening Rules

### SEC-8.1 [P0] Universal HTTPS & Hardened HTTP Security Headers
All web portals and API services must mandate HTTPS (TLS 1.3, SRS §6) and return standardized, restrictive HTTP security headers:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy (CSP):` Restrictive script and style sources; arbitrary `unsafe-inline` and `unsafe-eval` directives are prohibited; `frame-ancestors 'none'` to block clickjacking.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy:` Restrict geolocation, microphone, and camera access strictly to authorized origins — noting the Nurse Mobile App and portals legitimately need camera (selfie/eKYC) and geolocation (check-in, radar) on their own origins only.
- **Server Fingerprint Suppression:** Strip identifying response headers (e.g., `Server`, `X-Powered-By`).

### SEC-8.2 [P0] Centralized Secrets Management & Key Rotation
- Payment gateway secrets (webhook HMAC keys), FCM/APNs credentials, SMS gateway keys, maps/geocoding API keys, JWT/session signing keys, object-storage credentials, and database credentials must be managed via a dedicated secret store (e.g., cloud Secrets Manager, HashiCorp Vault, or runtime environment injection).
- Storing secrets in source code, commit history, Docker images, or client-distributed packages (web bundles, mobile APK/IPA) is strictly prohibited. Mobile apps hold **no** server secrets — in particular, no gateway secret and no storage master credential; uploads/downloads use server-issued scoped URLs only (SEC-7.1).
- Documented procedures must exist for scheduled key rotation and emergency revocation on suspected compromise.

### SEC-8.3 [P0] Restrictive Domain-Bound CORS Policies
- CORS configurations are locked to the explicit whitelist of official origins of the web surfaces (Patient Web, Nurse Web Portal, Admin Web Portal). Native mobile apps do not use CORS and must authenticate with bearer tokens instead.
- The wildcard directive `Access-Control-Allow-Origin: *` is **strictly prohibited** on any authenticated endpoint or endpoint handling user data.

### SEC-8.4 [P0] Absolute Isolation of Deployment Environments
- Complete segregation between Development, Staging, and Production environments.
- **Strict Prohibition of Real Patient Data in Non-Production:** Real health records, CCCD/GPHN images, names, or phone numbers must **never** be copied to development, testing, or staging. Test environments use synthetically generated fixtures only (see SEC-10.2).
- Sandbox payment gateway credentials (MVP simulated escrow, SRS §1.3) remain completely isolated from any future production gateway account; sandbox and production webhook secrets are distinct and independently rotatable.

### SEC-8.5 [P0] Continuous Vulnerability Management & Dependency Auditing
- Integrate automated Software Composition Analysis (SCA) and Static Application Security Testing (SAST) into the CI/CD pipeline (e.g., Dependabot, Snyk, SonarQube) across the TypeScript monorepo (web surfaces, API, shared packages) and the mobile app.
- Patching remediation SLAs *(retained engineering standard — not specified in SRS v2.0)*: Critical CVEs patched within **48 hours**; High CVEs within **7 days**. Builds with unresolved Critical vulnerabilities are blocked at the CI merge gate.

### SEC-8.6 [P1] Edge Web Application Firewall (WAF) & DDoS Mitigation
- Public-facing endpoints (OTP request, booking creation, nurse search, webhook ingress) are protected behind an edge WAF and DDoS mitigation layer (e.g., Cloudflare, AWS WAF).
- WAF rate limiting and bot management are an auxiliary perimeter defense and never a substitute for server-side validation (SEC-4.4). The webhook path must remain reachable by the gateway while still enforcing SEC-5.3 signature verification at the application layer.

### SEC-8.7 [P0] Encrypted Backups & Disaster Recovery (NFR-AVAIL-01)
- Automated daily PostgreSQL snapshots combined with **Point-in-Time Recovery (PITR) retained for 35 days**; recovery objectives per SRS: **RPO ≤ 1 hour** for wallet transactions, **RPO ≤ 24 hours** for logs, **RTO ≤ 4 hours**. System availability target is **99.5%**, and planned maintenance avoids the 19:00–21:00 night-shift handover window (NFR-AVAIL-01).
- Object storage holding Class A/B files (SEC-3.1) is versioned/backed up under the same encryption and retention discipline; backup access is segregated from application runtime credentials to defend against ransomware.
- Conduct quarterly disaster recovery restoration drills: *a backup that has never been successfully restored in a staging drill is considered non-existent*.

### SEC-8.8 [P1] Database Least Privilege & Bastion Access Controls
- The application connects to PostgreSQL using an unprivileged role scoped to the required schemas (no `SUPERUSER`, no `DROP`), with ledger-table protections of SEC-5.5 enforced at this layer.
- Human operational access to production servers and databases goes through bastion hosts with named credentials, mandatory 2FA, and session recording *(retained engineering standard — not specified in SRS v2.0)*.
- Redis (sessions, locks, queues) is never exposed publicly; it requires authentication and network isolation, since lock/session tampering directly attacks SEC-6 controls.
