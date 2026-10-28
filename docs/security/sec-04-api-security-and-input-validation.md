# Security Policy Group 4 — API Security & Input Validation

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (§8 API specification, §9 integrations) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | The SRS §8 REST endpoint set (auth, onboarding, bookings, check-in/out, disputes, reviews, wallets, admin), Request Deserialization, Input Sanitization, Rate Limiting, OpenAPI Contracts. Payment **webhook** transport rules live in SEC-5.3 / SRS §9.1. |
| **Reference Frameworks** | OWASP Top 10 (2021), OWASP API Security Top 10 (2023) |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |

---

## API Security & Input Validation Rules

### SEC-4.1 [P0] Strict Server-Side Whitelist Validation & Mass-Assignment Defense
- All input received by backend APIs must be validated against rigid whitelist rules (explicit types, maximum lengths, enum values, numeric boundaries, regex patterns). Every SRS §8 endpoint validates against its declared contract; unknown fields are rejected or ignored, never persisted.
- **Prohibition of Mass Assignment:** Clients are strictly forbidden from setting system-controlled attributes, including: `role`, `kyc_status`, `tier`, `profile_status`, `trust_score`, `gphn_expiry_date` (set only via the credential-verification flow), `reviewed_by`, `is_invasive` / `is_prohibited` / `required_tier` on services, any wallet balance (`available_balance`, `escrow_locked_balance`, `deposit_balance`), `platform_fee`, `total_amount`, and any of the three booking status axes. These change only through their owning server-side workflows (Admin verification, settlement worker, dispute resolution).
- Money and price inputs from clients are untrusted assertions: booking totals are recomputed server-side from `service_categories` + `system_configs` (SEC-5.2), and a withdrawal amount is validated against the locked `available_balance` at execution time (FR-PAY-04).

### SEC-4.2 [P0] Robust Injection Prevention & Contextual Output Encoding
- **SQL Injection:** All database interactions must use parameterized queries or prepared statements. String concatenation of user input into SQL is prohibited — this includes the radius search over PostGIS/spatial indexes (SRS §9.3) and all admin search filters.
- **Cross-Site Scripting (XSS):** All user-supplied text — chat messages, review comments, care-note free text, dispute descriptions — must be contextually encoded/sanitized before rendering in any of the four client surfaces, preventing Stored XSS. Free text never accepts raw HTML (see SEC-7.2).

### SEC-4.3 [P0] Cross-Site Request Forgery (CSRF) Mitigation
- For web endpoints using cookie-based authentication (Patient Web, Nurse Web Portal, Admin Portal), state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) must enforce anti-CSRF token validation or `SameSite=Strict`/`Lax` cookies paired with strict `Origin`/`Referer` verification.
- APIs using `Authorization: Bearer <token>` headers (mobile apps) must enforce the CORS whitelist of SEC-8.3.

### SEC-4.4 [P0] Multi-Tiered Rate Limiting & Anti-Enumeration Protections
- Enforce granular rate limiting per endpoint, client IP, device, and authenticated account, with the strictest tiers on:
  - **Auth endpoints** (`/auth/request-otp`, `/auth/verify-otp`) — see SEC-1.2/SEC-1.8.
  - **Booking creation and nurse search** — scraping and fake-booking abuse.
  - **Commission payment-link generation** and **withdrawal creation** — financial abuse.
- **Anti-Enumeration Defenses:** OTP requests, phone-number lookups, and `booking_code` lookups must return consistent messages and comparable response times regardless of whether the target exists (e.g., "If an account exists for this number, a code has been sent").
- SOS intake is explicitly **exempt** from throttling (SEC-6.6).

### SEC-4.5 [P0] Request Constraints & Application-Layer DoS Protection
- Enforce strict upper bounds on request body sizes (JSON payloads small; uploads handled by the SEC-7 pipeline — dispute evidence is capped at 5 files per FR-DISP-01).
- Apply connection and execution timeouts to synchronous API requests; heavy work (report export, reconciliation, notification fan-out) is queued to background workers (SEC-6.7).
- **Mandatory Pagination:** All collection endpoints (search, lists, histories) mandate pagination with a maximum page size; the radius search must stay within its performance budget (< 500 ms, SRS §9.3) via spatial indexing, not unbounded scans.

### SEC-4.6 [P1] Formal API Versioning & Schema Contracts
- All APIs use URL path versioning (`/api/v1/`, per SRS §8). Deprecated endpoints follow a documented decommissioning schedule, with extra care for the Nurse Mobile App running on old devices that upgrade slowly (NFR-COMP-01).
- The OpenAPI specification is the authoritative contract and generates runtime validation middleware; the SRS §8 table (method, path, role, behavior) is the business-level source the contract is checked against.

### SEC-4.7 [P1] Server-Side Business Logic Abuse Safeguards
Core invariants are enforced by server-side logic and database constraints, never by client state:
- A booking cannot be created for a `is_prohibited = true` service, nor for a home-care location by a customer who has not completed CCCD eKYC (FR-AUTH-03), nor without health-data consent (FR-PRIV-01).
- A Tier-1 nurse cannot be matched to an invasive service on any path (SEC-2.3).
- A nurse cannot hold overlapping confirmed bookings (availability + confirmed shifts + 60-minute travel buffer — FR-SCHED-01, SEC-6.2).
- Cancellation refunds and penalties are computed from **server time** against the SRS §5.2 SLA matrix; client-supplied timestamps are never trusted.
- Check-in is accepted only with mock-location flag clear and Haversine distance ≤ 200 m (`CHECKIN_MAX_RADIUS_METERS`) from the booking coordinates (FR-SHIFT-01).
