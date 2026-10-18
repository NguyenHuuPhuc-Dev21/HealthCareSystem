# Security Policy Group 4 — API Security & Input Validation

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` |
| **Applicable Scope** | RESTful / GraphQL API Endpoints, Request Deserialization, Input Sanitization, Rate Limiting, OpenAPI Contracts |
| **Reference Frameworks** | OWASP Top 10 (2021), OWASP API Security Top 10 (2023) |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |

---

## API Security & Input Validation Rules

### SEC-4.1 [P0] Strict Server-Side Whitelist Validation & Mass-Assignment Defense
- All input received by backend APIs must be strictly validated against rigid whitelist rules (explicit data types, maximum length, expected enum values, numeric boundaries, and regex patterns).
- **Prohibition of Mass Assignment (Auto-binding):** Object mappers and ORMs must explicitly reject or ignore unrecognized or unauthorized request fields. Clients are strictly forbidden from passing system-controlled attributes, including `status`, `hospital_id`, `role`, `price`, `discount_rate`, or `payment_status`.

### SEC-4.2 [P0] Robust Injection Prevention & Contextual Output Encoding
- **SQL / NoSQL Injection:** All database interactions must use parameterized queries, prepared statements, or hardened ORM query abstractions. String concatenation of user inputs into raw SQL statements is strictly prohibited.
- **Cross-Site Scripting (XSS):** All user-supplied text (such as patient symptom notes or nurse visit remarks) must be contextually encoded and sanitized before rendering across web portals and mobile applications to prevent Stored XSS.

### SEC-4.3 [P0] Cross-Site Request Forgery (CSRF) Mitigation
- For web endpoints using browser cookie-based authentication, state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) must enforce anti-CSRF token validation or rely on `SameSite=Strict`/`Lax` cookie flags paired with strict `Origin` and `Referer` header verification.
- APIs utilizing `Authorization: Bearer <token>` headers must strictly enforce Cross-Origin Resource Sharing (CORS) whitelists per **SEC-8.3**.

### SEC-4.4 [P0] Multi-Tiered Rate Limiting & Anti-Enumeration Protections
- Enforce granular rate limiting per endpoint, client IP, and authenticated user account:
  - Aggressive limits on authentication endpoints (Login, OTP generation, Password Reset).
  - Dedicated rate caps on resource-intensive endpoints (Booking submission, Search queries, SOS triggers).
- **Anti-Enumeration Defenses:** Prevent username and booking code enumeration by returning consistent error messages and identical response execution times (e.g., "If an account exists for this email, a verification code has been dispatched").

### SEC-4.5 [P0] Request Constraints & Application-Layer DoS Protection
- Enforce strict upper bounds on HTTP request body sizes (e.g., maximum 10 MB for file attachments, 256 KB for JSON payloads).
- Apply aggressive connection and execution timeouts (e.g., 10–15 seconds maximum for synchronous HTTP API requests).
- **Mandatory Pagination:** All collection listing endpoints must mandate pagination with enforced maximum page size limits (e.g., maximum 50 records per page), preventing memory exhaustion attacks via unbound database queries.
- Heavy computations and batch report exports must be queued asynchronously to background worker processes.

### SEC-4.6 [P1] Formal API Versioning & Schema Contracts
- All external and mobile-facing APIs must implement formal URL path versioning (e.g., `/api/v1/`).
- Deprecated endpoints must follow a documented decommissioning schedule with transition notifications.
- OpenAPI (Swagger) specifications serve as the authoritative single source of truth, used to automatically generate runtime validation middlewares.

### SEC-4.7 [P1] Server-Side Business Logic Abuse Safeguards
- Core operational invariants must be validated by server-side constraints and database triggers, never relying on UI client state:
  - A patient cannot have more than one active in-progress home-care visit concurrently.
  - A nurse cannot be dispatched to overlapping appointment time slots.
  - Cancellation refund percentages must be strictly calculated against server time.
