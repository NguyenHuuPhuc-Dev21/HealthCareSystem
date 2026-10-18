# Security Policy Group 2 — Authorization & Multi-Tenant Isolation

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` (BR-09, BR-21, UC16, UC17, UC80, UC81) |
| **Applicable Scope** | Multi-Hospital Data Segregation, Role-Based Access Control (RBAC), Object-Level Authorization (BOLA/IDOR), Sub-Roles |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |
| **Core Vulnerability Target** | OWASP API Security #1: Broken Object Level Authorization (BOLA) and Cross-Tenant Data Leakage in a SaaS environment. |

---

## Authorization & Isolation Rules

### SEC-2.1 [P0] Mandatory Four-Factor Authorization Check
Every incoming API request that accesses or mutates business data must independently pass a four-factor authorization validation on the server side (**BR-09**):
1. **Actor Role:** Does the user's role have permission to execute this general action?
2. **Relationship Context:** Does the authenticated user possess a legitimate, verified clinical or operational relationship to the target entity?
   - *Example:* Is the patient the creator of this booking? Is the nurse formally assigned to this home-care visit? Is the administrator an employee of this specific hospital facility?
3. **Session & Identity Authenticity:** Is the current session token valid, unexpired, unrevoked, and bound to the authenticated identity?
4. **Target Entity Lifecycle State:** Does the current lifecycle status of the resource permit this specific transition or action?
   - *Example:* A visit cannot be marked "Completed" if it has not been "Started", or if the mandatory care report has not been submitted (**BR-22**).

*Failure at any single check must immediately abort processing and reject the request with HTTP `403 Forbidden` (or HTTP `404 Not Found` per SEC-2.4).*

### SEC-2.2 [P0] Tenant Boundary in Every Database Query
- Every operational database table and clinical entity must include a mandatory `hospital_id` (tenant identifier) column.
- The data access layer (ORM / query builder / repository) must automatically inject `WHERE hospital_id = :authenticated_hospital_id` into all database queries.
- The system must **never trust a `hospital_id` parameter supplied in the client request body or URL path**. The tenant context must be extracted strictly from the server-validated authentication token/session.
- Cross-tenant data access must remain mathematically impossible at the query layer, even if an attacker successfully guesses internal database UUIDs or sequential IDs.

### SEC-2.3 [P0] Systematic IDOR / BOLA Prevention
- Every direct reference to a resource identifier (e.g., `/api/v1/visits/{visit_id}`, `/api/v1/patients/{patient_id}`) must be validated against the relationship context defined in **SEC-2.1** prior to returning data.
- **Mandatory CI Security Test:** Automated integration test suites must execute cross-entity swapping test cases (e.g., User A requesting User B's appointment details, or Hospital Admin 1 requesting Hospital Admin 2's staff list) and assert that HTTP `403 Forbidden` or `404 Not Found` is returned across 100% of API endpoints.

### SEC-2.4 [P0] Suppression of Information Leakage via Errors and Metadata
- Requests attempting to access unauthorized resources must return generic error representations that are indistinguishable from requests for non-existent entities (e.g., standard HTTP `404 Not Found`).
- Error messages must never disclose whether a target identifier exists in another hospital tenant's dataset.
- Paginated search and listing endpoints must strictly isolate aggregation counters (`total_count`, summary totals) to ensure cross-tenant volume metrics are not inadvertently leaked.

### SEC-2.5 [P0] Platform Administrator Clinical Data Isolation
- In accordance with the SaaS architecture model, Platform Administrators manage platform infrastructure, tenant subscriptions, global configurations, and escalated billing disputes.
- Platform Administrators are **strictly prohibited from viewing granular patient clinical health records** (symptoms, doctor notes, care reports) by default.
- Any emergency operational access to tenant data by Platform Administrators must be time-bounded, require explicit justification, and generate an immutable, high-priority audit log.

### SEC-2.6 [P1] Enforcement of Granular Operational Sub-Roles
- Per page 13 of the baseline Use Case specification, the broad "Hospital Administrator" persona must be decomposed into discrete operational sub-roles:
  - **Dispatch Coordinator:** Manages nurse matching, schedule shifts, and re-dispatch.
  - **Accountant:** Handles invoice reconciliation, fee disputes, and manual refund execution.
  - **SOS Triage Operator:** Receives and triages urgent safety alerts and incident responses.
  - **HR & Quality Control (HR-QC):** Verifies nurse practicing licenses (CCHN) and reviews patient feedback.
  - **Chief Hospital Administrator:** Manages facility pricing, policies, and staff terminations.
- Blanket "Super-Admin" operational accounts are prohibited in day-to-day hospital operations.

### SEC-2.7 [P1] Instant Revocation Propagation Across All Layers
- Account suspension (e.g., nurse visit abandonment penalty per **BR-02**, clinical license expiry per **BR-21**, employee resignation) must take effect **instantaneously**.
- Revocation must propagate synchronously across:
  - Authentication JWTs and refresh token tables.
  - In-memory permission caches (e.g., Redis session stores).
  - Active WebSocket connections and real-time push subscriptions.
- Suspended staff must be immediately disconnected and prevented from executing any in-flight actions.
