# Security Policy Group 2 — Authorization & Role/Ownership Isolation

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (§8 role column, FR-AUTH-02, FR-PRIV-01, FR-BOOK-03) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version. Multi-tenant isolation is **removed**: the platform is a single marketplace with no hospital tenants. Isolation is enforced per user — by role, ownership, and assignment. (File name retained for link stability.) |
| **Applicable Scope** | Role-Based Access Control (RBAC), Tier Hard-Gating, Object-Level Authorization (BOLA/IDOR), Medical-Record Access Window |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |
| **Core Vulnerability Target** | OWASP API Security #1: Broken Object Level Authorization (BOLA) and cross-user data leakage between customers, nurses, and admins. |

---

## Authorization & Isolation Rules

### SEC-2.1 [P0] Mandatory Four-Factor Authorization Check
Every incoming API request that accesses or mutates business data must independently pass a four-factor authorization validation on the server side:
1. **Actor Role:** Does the user's role (`PATIENT` / `NURSE` / `ADMIN`, with `Super Admin` as the highest Admin level) permit this general action, per the role column of the SRS §8 API specification?
2. **Ownership / Relationship Context:** Does the authenticated user own or legitimately relate to the target entity?
   - *Examples:* The customer created this booking (`bookings.customer_id`); the nurse is the assigned nurse of this booking (`bookings.nurse_id`); the wallet belongs to the requester (`wallets.user_id`); the dispute was raised by a party to the booking.
3. **Session & Identity Authenticity:** Is the current session valid, unexpired, unrevoked, and does the account lifecycle permit acting (`users.status = ACTIVE`; for nurses, `nurse_profiles.profile_status = ACTIVE` is the single source of truth for job-claim rights — TC-DB-01)?
4. **Target Entity Lifecycle State:** Does the resource's current state permit this action, evaluated against **all three booking axes** (`execution_status`, `payment_status`, `dispute_status` — SRS §2.2)? A settlement release, for example, is legal only when `execution_status = COMPLETED`, the 24-hour cooling period has elapsed, and `dispute_status = NONE`.

*Failure at any single check must immediately abort processing and reject the request with HTTP `403 Forbidden` (or HTTP `404 Not Found` per SEC-2.6). Authorization is never delegated to the client: hiding a button in any of the four client surfaces is not a control (SEC-0.1).*

### SEC-2.2 [P0] RBAC Matrix (Normative Summary)
| Resource / Action | Customer (PATIENT) | Nurse (NURSE) | Admin (ADMIN) | Super Admin |
|---|---|---|---|---|
| Own profile, own patient profiles | Read/Write own | — | Read (support, audited) | Read |
| Nurse onboarding & credentials (own) | — | Create/Update own | Verify (`reviewed_by`), assign tier | Verify |
| Service catalog & `system_configs` | Read active catalog | Read active catalog | Read/Write | Read/Write |
| Bookings | Create; read/cancel own | Read matched/assigned; claim; check-in/out assigned | Read all; cancel/reassign | Read all |
| Medical record & doctor's-order images | Own patient profiles | **Assigned bookings only, within the access window (SEC-2.4)** | Dispute handling only, time-bounded re-grant, audited | Audited |
| Chat / calls | Own confirmed bookings | Own confirmed bookings | Read as dispute evidence (audited) | Audited |
| Wallet & ledger | Read own | Read own; withdraw own | Read; approve withdrawals; reconcile | Read |
| Deposit top-up / commission payment link | — | Own | Read | Read |
| Disputes | Raise/read own | Raise/read own | Resolve (`resolved_by`) | Resolve |
| User lifecycle (SUSPEND/BAN) | — | — | Yes, audited | Yes |
| `audit_logs` | — | — | Read (own scope) | Read all |

Sub-role differentiation inside the Admin Portal (e.g., separating credential verification, dispute resolution, and finance approval duties) is a *(retained engineering standard — not specified in SRS v2.0)*; the SRS `users.role` enum carries a single `ADMIN` value.

### SEC-2.3 [P0] Tier Hard-Gating & Claim Eligibility
Tier and eligibility checks are hard server-side gates, evaluated on **every** matching and claim path (Radar Dispatch and Job Board, FR-BOOK-03):
- A nurse whose `tier = TIER_1_BASIC` must be rejected with **HTTP `403 Forbidden`** when claiming, being matched to, or being directly invited to any booking whose service has `is_invasive = true` (TC-AUTH-03). Tier 2 requires a GPHN that is unexpired (`gphn_expiry_date` in the future) **and** in-scope (`scope_of_practice`); a retirement decision alone never unlocks invasive services (FR-AUTH-02).
- A service with `is_prohibited = true` cannot be booked by anyone: booking creation is rejected server-side, and the catalog flags are Admin-managed data (`service_categories`), never client-supplied (SEC-4.1).
- **Deposit gate:** A nurse may claim a job only when `deposit_balance ≥ 300,000 VND` (`MIN_NURSE_DEPOSIT`); otherwise the claim is rejected with HTTP `403` and a top-up instruction (TC-WALLET-01). There is no per-job value cap.
- **Lifecycle gate:** Nurses with `profile_status` in `PENDING_VERIFICATION`, `SUSPENDED`, or `BANNED` cannot claim jobs. Tier demotion on GPHN expiry is automatic (daily job, FR-AUTH-02): confirmed invasive bookings scheduled after the expiry date are auto-cancelled without penalty and re-matched; re-promotion occurs only after an Admin approves the renewed GPHN.

### SEC-2.4 [P0] Medical-Record Access Window
Patient health data (patient profile, medical history, doctor's-order images) is exposed to a nurse **only** under all of the following conditions (FR-PRIV-01):
- The nurse is the assigned nurse of the booking (`bookings.nurse_id = requester`), and
- The booking is in `execution_status = CONFIRMED` or `IN_PROGRESS`, or within **12 hours after check-out** (`shift_logs.checkout_time + 12h`).
Outside that window the API must return HTTP `403` — including after settlement (TC-PRIV-01). Every successful record view writes an `audit_logs` row (`action_type = VIEW_MEDICAL_RECORD`). During the 24-hour dispute window, evidence is taken from system logs; an Admin may re-grant a nurse time-bounded record access for dispute handling only, with the grant itself audit-logged (SEC-0.2).

### SEC-2.5 [P0] Systematic IDOR / BOLA Prevention
- Every direct object reference in the SRS §8 endpoint set — `/bookings/:id/*`, `/wallets/*`, `/admin/nurses/:id/*`, `/admin/disputes/:id/*` — must be validated against SEC-2.1 factors 1–2 before any data is read or mutated. A customer must never read another customer's booking by guessing its UUID or `booking_code`; a nurse must never read another nurse's wallet, earnings, or credential files.
- List/search endpoints must be scope-filtered server-side: nurse search (FR-SEARCH-01) returns only public profile cards of `ACTIVE` nurses; it must never expose credential documents, GPHN numbers, or contact details.
- **Mandatory CI Security Test:** Automated integration tests must execute cross-user swapping cases (Customer A requesting Customer B's booking; Nurse A requesting Nurse B's wallet; a nurse requesting a record outside the SEC-2.4 window) and assert HTTP `403`/`404` across 100% of endpoints (SEC-10.2).

### SEC-2.6 [P0] Suppression of Information Leakage via Errors and Metadata
- Where the SRS mandates an explicit signal (tier gating → `403`, invalid booking payload → `400`, bad webhook signature → `401`), return exactly that signal.
- For object-existence hiding, unauthorized-resource responses should be indistinguishable from non-existent entities (generic `404`) so attackers cannot enumerate valid booking or user IDs *(retained engineering standard — not specified in SRS v2.0; applies wherever it does not contradict an SRS-mandated status code)*.
- Aggregations and counters in list responses must be computed only over the requester's authorized scope.

### SEC-2.7 [P1] Admin Data Minimization & Break-Glass Access
- Admins operate on operational data (accounts, bookings, wallets, configs). Bulk browsing of patient health records is not an Admin capability: record access is granted per dispute, time-bounded, justified, and audit-logged (SEC-2.4).
- Financial approvals follow segregation of duties: the Admin who resolves a dispute is recorded (`disputes.resolved_by`), and withdrawal approvals are separately attributable (SEC-5.9).

### SEC-2.8 [P1] Instant Revocation Propagation Across All Layers
- Lifecycle revocations must take effect **immediately**, not at next login:
  - `profile_status` → `SUSPENDED` (TrustScore < 60, deposit below minimum after a penalty, commission unpaid > 24 h) or `BANNED` (no-show, forged credentials): job-claim rights stop at once.
  - Tier demotion (`TIER_2_SPECIALIST` → `TIER_1_BASIC` on GPHN expiry): invasive-service access stops at once, on web and mobile.
- Revocation must propagate synchronously across session/token stores, Redis permission caches, active WebSocket connections, and push subscriptions. A suspended or banned user must be unable to execute in-flight mutations with a previously issued token.
