# Security Policy Group 0 — Foundational Architecture & Security Axioms

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | Entire System: Patient Web/App, Nurse Web Portal, Nurse Mobile App, Admin Web Portal, Backend APIs, Payment Gateway Webhooks, Object Storage, Background Workers |
| **Reference Frameworks** | OWASP Top 10 (2021), OWASP API Security Top 10 (2023), OWASP ASVS Level 2; Vietnam Decree 13/2023/ND-CP; Law on Medical Examination and Treatment 15/2023/QH15 |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |
| **Vietnamese Baseline Archive** | Preserved in [`archive/security-rules.vi.md`](archive/security-rules.vi.md) |

---

## Foundational Security Principles

The following core security axioms govern all architectural, design, and implementation decisions across the HealthCareSystem on-demand nursing marketplace. No feature, optimization, or operational workaround may bypass these foundational rules.

HealthCareSystem is a **single-platform marketplace**: it connects customers (patients/families) with independent nurses on one platform operated by one operator. There are **no hospital tenants and no multi-tenant isolation**; the isolation unit of this system is the individual user, their role, and their ownership of / assignment to specific bookings, wallets, and records (see Group 2).

### SEC-0.1 [P0] Zero Trust on the Client (Never Trust Frontend State)
- All authorization decisions, pricing calculations, role and tier validations, and lifecycle state changes must be enforced exclusively on the backend server.
- Hiding, disabling, or modifying visual UI elements (such as buttons, navigation tabs, or form fields) is an ergonomic design choice and **never** a security boundary.
- The server must independently evaluate permissions based on Actor Role + Ownership/Relationship Context + Authenticated Session + Object Lifecycle State for every incoming request (SEC-2.1). A `TIER_1_BASIC` nurse must receive HTTP `403` on an invasive-service claim even if a modified client renders the button (TC-AUTH-03).

### SEC-0.2 [P0] Default Least Privilege
- Every user account, operational role, service token, API key, database user, and background worker must operate under the absolute minimum set of privileges necessary to execute its intended business function.
- Temporary elevation of privileges or administrative exemptions must include an auditable business justification and an enforced automatic expiration timestamp. This applies in particular to Admin re-grants of medical-record access during dispute handling (FR-PRIV-01), which must be time-bounded and written to `audit_logs`.

### SEC-0.3 [P0] Deny by Default
- Any API endpoint, network route, administrative function, or data asset without an explicitly defined, active allow-rule must default to blocking access.
- System resources are never open by default; permissions must be explicitly granted and validated. Prohibited services (`is_prohibited = true`) are denied at booking creation, not merely hidden from the catalog (SRS §4.2).

### SEC-0.4 [P0] Defense in Depth (Layered Resilience)
- No single security measure (such as a Web Application Firewall, OTP, or a signed URL) is ever deemed sufficient to protect system assets.
- Every defensive layer must be designed under the assumption that the preceding protective layer has been compromised or bypassed. Anti-fraud for shift check-in, for example, layers mock-location detection, a ≤ 200 m Haversine radius check, and live-capture selfie verification (FR-SHIFT-01) — no one check stands alone.

### SEC-0.5 [P1] Complete Audit Traceability
- Every security-relevant event — including GPHN approvals and tier changes, dispute resolutions, `system_configs` changes, medical-record views, patient-data deletions, and money movements — must produce an audit record in the `audit_logs` table (SRS §7, table 16), governed under [Group 9: Logging & Observability](sec-09-logging-observability-and-incident-response.md).

### SEC-0.6 [P0] Marketplace Trust Boundaries
The platform's trust boundaries are exactly the following; every crossing of one of these boundaries requires authentication, authorization, and validation per the relevant policy group:
1. **Four client surfaces** — Patient Web & Mobile App, Nurse Web Portal, Nurse Mobile App, Admin Web Portal. All are untrusted; the Nurse Mobile App additionally runs on low-end, older devices (NFR-COMP-01) and must not be assumed tamper-proof (mock-location and fake-GPS attempts are expected — RISK-05).
2. **Payment gateway callbacks** — PayOS / VNPay / VietQR webhooks enter from outside the platform and are trusted only after HMAC-SHA256 signature verification and idempotency checks (SEC-5.3, SRS §9.1).
3. **Object storage** — CCCD images, GPHN scans, portraits, doctor's-order (y lệnh) images, check-in selfies, and care-record attachments live in private object storage and cross the boundary only via short-lived signed URLs (SEC-7.1, NFR-SEC-01).
4. **Third-party services** — FCM/APNs push, SMS/ZNS fallback gateway, and maps/geocoding APIs (SRS §9). Their credentials are secrets (SEC-8.2); their failure modes (e.g., push not acknowledged within 60 seconds → SMS fallback) must not silently degrade safety-critical flows.

### SEC-0.7 [P0] Configuration-Driven Business Parameters
- Every business number that affects money, eligibility, or safety — commission rate (15%), deposit minimum (300,000 VND), surcharges, timeouts, settlement cooling period (24 h), check-in radius (200 m) — is read from the `system_configs` table at runtime (SRS §5.1, CT-05). Hard-coding these values in source code is prohibited.
- Changes to `system_configs` are privileged Admin operations, recorded in `audit_logs` with old and new values (`UPDATE_CONFIG`), because a single config change silently reprices every future booking (TC-PRICE-01).
