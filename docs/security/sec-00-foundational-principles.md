# Security Policy Group 0 — Foundational Architecture & Security Axioms

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` |
| **Applicable Scope** | Entire System: Patient / Staff / Admin Apps, Backend APIs, Payment Gateways, Multi-Tenant SaaS Infrastructure |
| **Reference Frameworks** | OWASP Top 10 (2021), OWASP API Security Top 10 (2023), OWASP ASVS; Vietnam Decree 13/2023/ND-CP |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |
| **Vietnamese Baseline Archive** | Preserved in [`archive/security-rules.vi.md`](archive/security-rules.vi.md) |

---

## Foundational Security Principles

The following core security axioms govern all architectural, design, and implementation decisions across the Home-Care Nursing Platform. No feature, optimization, or operational workaround may bypass these foundational rules.

### SEC-0.1 [P0] Zero Trust on the Client (Never Trust Frontend State)
- All authorization decisions, pricing calculations, role validations, and lifecycle state changes must be enforced exclusively on the backend server.
- Hiding, disabling, or modifying visual UI elements (such as buttons, navigation tabs, or form fields) is an ergonomic design choice and **never** a security boundary.
- Directly maps to **BR-09**: the server must independently evaluate permissions based on Actor Role + Relationship Context + Authenticated Session + Object Lifecycle State for every incoming request.

### SEC-0.2 [P0] Default Least Privilege
- Every user account, operational role, service token, API key, database user, and background worker must operate under the absolute minimum set of privileges necessary to execute its intended business function.
- Temporary elevation of privileges or administrative exemptions must include an auditable business justification and an enforced automatic expiration timestamp.

### SEC-0.3 [P0] Deny by Default
- Any API endpoint, network route, administrative function, or data asset without an explicitly defined, active allow-rule must default to blocking access.
- System resources are never open by default; permissions must be explicitly granted and validated.

### SEC-0.4 [P0] Defense in Depth (Layered Resilience)
- No single security measure (such as a Web Application Firewall, CAPTCHA, or One-Time Password) is ever deemed sufficient to protect system assets.
- Every defensive layer must be designed under the assumption that the preceding protective layer has been compromised or bypassed.

### SEC-0.5 [P1] Complete Audit Traceability
- Every security-relevant event—including privilege grants, role modifications, security configuration alterations, and clinical patient record accesses—must produce an immutable, forensically sound audit log entry (governed under [Group 9: Logging & Observability](sec-09-logging-observability-and-incident-response.md)).
