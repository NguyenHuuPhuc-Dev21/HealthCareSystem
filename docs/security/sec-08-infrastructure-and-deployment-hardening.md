# Security Policy Group 8 — Infrastructure, Deployment & Network Hardening

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` |
| **Applicable Scope** | Cloud Infrastructure, Network Perimeters, Secrets Management, CORS, Environment Isolation, Dependency Auditing |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |

---

## Infrastructure & Deployment Hardening Rules

### SEC-8.1 [P0] Universal HTTPS & Hardened HTTP Security Headers
All web portals and API services must mandate HTTPS and return standardized, restrictive HTTP security headers:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy (CSP):` Restrictive script and style sources; arbitrary `unsafe-inline` and `unsafe-eval` directives are prohibited; `frame-ancestors 'none'` to block clickjacking.
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy:` Restrict geolocation, microphone, and camera access strictly to authorized origins.
- **Server Fingerprint Suppression:** Strip identifying response headers (e.g., `Server`, `X-Powered-By`, `X-AspNet-Version`).

### SEC-8.2 [P0] Centralized Secrets Management & Key Rotation
- Third-party API keys (e.g., Google Maps API), payment gateway merchant secrets, JWT signing keys, and database credentials must be managed via dedicated cloud secret stores (e.g., AWS Secrets Manager, HashiCorp Vault, or environment injection at runtime).
- Storing secrets in source code repositories, commit histories, Docker build images, or client-distributed packages is strictly prohibited.
- Maintain documented operational procedures for automated scheduled key rotation and emergency key revocation in the event of suspected compromise.

### SEC-8.3 [P0] Restrictive Domain-Bound CORS Policies
- Cross-Origin Resource Sharing (CORS) configurations must be locked strictly to the explicit whitelist of official domains for the respective applications (Patient Portal, Staff Mobile App, Hospital Administration Web, SaaS Platform Portal).
- The wildcard directive `Access-Control-Allow-Origin: *` is **strictly prohibited** on any API endpoint requiring authentication or handling user data.

### SEC-8.4 [P0] Absolute Isolation of Deployment Environments
- Complete architectural and network segregation must be enforced between Development, Staging, and Production environments.
- **Strict Prohibition of Real Patient Data in Non-Production:** Real patient health records, names, or contact details must **never** be copied or synchronized to development, testing, or staging databases. Test environments must use synthetically generated mock fixtures.
- Sandbox payment gateway credentials and testing merchant accounts must remain completely isolated from live production gateway accounts.

### SEC-8.5 [P0] Continuous Vulnerability Management & Dependency Auditing
- Integrate automated Software Composition Analysis (SCA) and Static Application Security Testing (SAST) tools into the CI/CD pipeline (e.g., Dependabot, Snyk, SonarQube).
- Establish strict patching remediation SLAs: Critical CVEs must be patched within **48 hours**; High CVEs within **7 days**.
- Deploying application builds with unresolved Critical vulnerabilities is automatically blocked at the CI merge gate.

### SEC-8.6 [P1] Edge Web Application Firewall (WAF) & DDoS Mitigation
- Public-facing internet endpoints (User Registration, Login, Booking Creation) must be protected behind an edge Web Application Firewall (WAF) and DDoS mitigation layer (e.g., Cloudflare, AWS WAF).
- WAF rate limiting and bot management rules serve as an auxiliary perimeter defense and must never be treated as a substitute for server-side application validation.

### SEC-8.7 [P0] Encrypted Backups & Disaster Recovery Drills
- All database snapshots, transaction write-ahead logs, and object storage backups must be encrypted at rest using isolated encryption keys.
- Backup storage access must be segregated from application runtime credentials to defend against ransomware compromise.
- Conduct quarterly disaster recovery restoration drills: *a backup that has never been successfully restored in a staging drill is considered non-existent*.

### SEC-8.8 [P1] Database Least Privilege & Bastion Access Controls
- Application backend processes must connect to the database using an unprivileged application role scoped strictly to the required database schemas (prohibiting `SUPERUSER`, `DROP DATABASE`, or administrative privileges).
- Human operational access to production servers and databases must be conducted via secure bastion hosts with named user credentials, mandatory 2FA, and full session recording.
