# Non-Functional Requirements Specification (NFRS)
## Hospital Home-Care Nursing Platform

| Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_v8.1.drawio` (140 UCs, BR-01–BR-23) + `luong_hoat_dong_v8.14.drawio` (Frozen baseline Oct 16, 2026; accompanying consolidated Business Rules document) |
| **Pilot Load Assumption** | Single hospital tenant, ~300 home-care visits/day, concentrated peak hours between 17:00–21:30 (BR-03 window). If operational volume deviates, target metrics must be recalibrated. |
| **Document Status** | **Proposal — Pending PO Sign-off.** Target metrics represent engineering baselines proposed by Atlas, except items annotated as "Per Specification" (derived directly from frozen BRs/flows). |
| **Original Vietnamese Baseline** | Preserved in [`archive/functional-and-non-functional.vi.md`](archive/functional-and-non-functional.vi.md) |

---

## NFR-01 — Performance & Latency

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-01.1** | API Response Latency | P95 latency ≤ 300 ms for read operations, ≤ 800 ms for write/transaction operations under baseline pilot load; mobile application home screen interactive within ≤ 2.0 seconds over standard 4G networks. | Engineering Proposal |
| **NFR-01.2** | Emergency SOS Dispatch Latency | Elapsed time from user SOS tap to push notification receipt by the hospital on-duty team ≤ 10 seconds (P95); 5-minute unacknowledged escalation window governed strictly per BR-23. | BR-23 + Engineering Proposal |
| **NFR-01.3** | Real-Time Location Telemetry | Nurse GPS telemetry transmitted every 10–15 seconds while en route; patient map tracking view latency ≤ 15 seconds; mobile client battery drain restricted to ≤ 5% per hour of continuous transit tracking. | BR-07 + Engineering Proposal |
| **NFR-01.4** | Payment Webhook Throughput | Webhook acknowledgment and status persistence completed within ≤ 3 seconds; idempotent request deduplication guarantees zero duplicate transactions or double-refund orders. | BR-05 + Engineering Proposal |

---

## NFR-02 — High Availability & Disaster Recovery

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-02.1** | Core Service Availability | Monthly uptime availability ≥ 99.9% during pilot for core business capabilities (booking creation, visit execution, payment settlement, and SOS escalation). | Engineering Proposal (Subject to Hospital SLA) |
| **NFR-02.2** | Database Backup & Recovery | PostgreSQL Point-in-Time Recovery (PITR): Recovery Point Objective (RPO) ≤ 1 hour, Recovery Time Objective (RTO) ≤ 4 hours; automated quarterly disaster recovery drill. | Engineering Proposal |
| **NFR-02.3** | Graceful Degradation | Peripheral system outages (payment gateway, AI engine, map provider) must not halt core workflow operations: AI outage fails over to on-duty doctor triage (BR-10); gateway outage initiates manual refund workflow F8; GPS disruption falls back to secondary photo check-in (BR-07). | Per Specification |
| **NFR-02.4** | Planned Maintenance Windows | Scheduled maintenance executed strictly outside peak operating hours; requires ≥ 24 hours advance in-app notification to active users. | Engineering Proposal |

---

## NFR-03 — Security & Access Governance

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-03.1** | Cryptographic Protection | Mandatory TLS 1.2+ for all data in transit; AES-256 encryption-at-rest for PostgreSQL relational databases and cloud object storage buckets. | Industry Standard |
| **NFR-03.2** | Authentication & Token Security | Password hashing using Argon2id or bcrypt (cost factor calibrated to hardware); 6-digit numeric OTP with validity windows governed by BR-20, rate-limited attempts; account lockout enforced per FR-01.2. | BR-20 + Engineering Proposal |
| **NFR-03.3** | Medical Media & File Access | Storage buckets configured as private; media assets accessible strictly via time-limited **pre-signed URLs (validity ≤ 15 minutes)** generated only after server-side four-factor authorization validation (BR-09); permanent public URLs strictly prohibited. | BR-09 + Engineering Proposal |
| **NFR-03.4** | Authorization Enforcement | All access checks executed at the API backend and query layers (zero trust toward frontend state); pre-launch penetration testing prior to pilot go-live and annual audit cycles targeting OWASP ASVS Level 2 compliance. | BR-09 + Engineering Proposal |
| **NFR-03.5** | Immutable Audit Trails | Append-only audit logs with application-level modification and deletion prohibited; logs must never capture plain-text passwords, authentication tokens, or unnecessary Protected Health Information (PHI); retention aligned with Q-14. | BR-09, BR-21 + Engineering Proposal |
| **NFR-03.6** | Secrets & Cryptographic Keys | Third-party API keys and merchant secrets stored in a dedicated cloud secret manager, never committed to source code repositories; payment gateway webhooks validated using HMAC cryptographic signatures. | Engineering Proposal |

---

## NFR-04 — Privacy & Legal Compliance

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-04.1** | Sensitive Data Protection (Decree 13/2023/ND-CP) | Patient health data classified as sensitive personal data under Vietnam Decree 13/2023/ND-CP: requires explicit profile-level consent records, terms version tracking, right to withdraw consent, and right to erasure per BR-12 and BR-17. | Statutory Mandate + Per Specification |
| **NFR-04.2** | Data Residency | Application databases and object storage hosted in a Vietnam cloud region (or nearest compliant region subject to cross-border transfer impact assessment under Decree 13 prior to launch). | Engineering Proposal (Subject to Legal Review) |
| **NFR-04.3** | Statutory Data Retention | Medical care records and financial transaction vouchers retained in accordance with Decision Q-14 (pending hospital legal counsel); retention rules must be system-configurable without code alterations. | BR-12 (Decision Q-14) |
| **NFR-04.4** | Side-Channel Privacy Safeguards | Push notifications and transactional emails must omit granular clinical health details; care report screenshots and documents excluded from public web indexing; testing environments restricted strictly to synthetic data. | BR-23 + Engineering Proposal |

---

## NFR-05 — Data Integrity & Financial Precision

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-05.1** | Monetary Representation & Accounting | All monetary values stored as exact non-negative integers in Vietnam Dong (VND); financial transactions modeled using an immutable double-entry ledger (append-only), prohibiting in-place updates or deletions. | Per Specification (use_case page 14) |
| **NFR-05.2** | Financial Transaction Idempotency | Each financial refund event generates exactly one refund instruction; enforced via database-level unique constraints (as modeled in ERD v8.11 for emergency triage cancellations). | ERD v8.11 Baseline |
| **NFR-05.3** | Business Temporal Accuracy | System timers (15-minute deposit hold, T−2h reminder, BR-18 SLA timeouts) must operate within a maximum clock skew of ≤ 60 seconds relative to scheduled targets; timestamps persisted in UTC and rendered in Asia/Ho_Chi_Minh. | Engineering Proposal |
| **NFR-05.4** | State Machine Consistency | Booking and session status transitions strictly adhere to the approved formal state machine (enum specifications on flow page 00c); invalid or unauthorized state transitions blocked at the API layer. | State Matrix 00c |

---

## NFR-06 — Scalability & Multitenancy

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-06.1** | Multi-Tenant Data Isolation | Strict logical tenant data isolation enforced at the database query layer from Day 1 (even within the single-hospital pilot) to guarantee multi-hospital expansion without architectural refactoring. | SaaS Architecture + BR-09 |
| **NFR-06.2** | Horizontal Scalability | Stateless API server architecture supporting horizontal scale-out; capable of absorbing a 5× surge over baseline pilot volume without requiring architectural modifications. | Engineering Proposal |
| **NFR-06.3** | Asynchronous Job Decoupling | Long-running tasks, reminders, and notifications processed via dedicated background job workers without blocking synchronous user API threads; queue depth and dead-letter queues actively monitored. | Technical Stack Baseline |

---

## NFR-07 — Usability & Field Accessibility

*Target user base: Elderly or convalescing home-care patients and field nurses traveling on mobile devices.*

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-07.1** | Patient UI Accessibility | Base font size ≥ 16 px, interactive touch target dimensions ≥ 48 × 48 px, color contrast ratios meeting WCAG 2.1 AA standards; critical information must not rely solely on color cues. | Design System Baseline |
| **NFR-07.2** | Navigation Depth Efficiency | Complete advance booking flow achievable within ≤ 5 primary screens; emergency SOS trigger accessible within ≤ 2 taps from any primary application screen. | Engineering Proposal |
| **NFR-07.3** | Localization & Plain Language | Full user interface and communications delivered in clear Vietnamese; complex clinical terminology supplemented with patient-friendly lay explanations. | Engineering Proposal |
| **NFR-07.4** | Safeguards Against Erroneous Input | Two-step confirmation dialogs for financial payments and booking cancellations; emergency SOS incorporates a non-blocking 5-second cancellation countdown to mitigate accidental taps without delaying dispatch. | Engineering Proposal (Requires PO Sign-off) |

---

## NFR-08 — Compatibility & Field Resilience

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-08.1** | Client Platform Compatibility | Patient and Nurse mobile applications support Android 10+ and iOS 15+; hospital web administration portal supports the latest 2 major versions of modern web browsers (Chrome, Edge, Safari). | Engineering Proposal |
| **NFR-08.2** | Offline & Degraded Connectivity | Nurse mobile application sustains functionality under unstable 3G networks: local persistence for on-site check-in and draft care reports with automatic synchronization upon reconnection; sync conflict resolution submitted for hospital admin review. | Engineering Proposal (Requires Scope Confirmation) |
| **NFR-08.3** | Geolocation Tolerance | In-home check-in geofence accounts for urban GPS drift (configurable radius, default per BR-07); secondary check-in mechanism readily available when GPS hardware is unavailable or obstructed. | BR-07 + Engineering Proposal |

---

## NFR-09 — Maintainability, Testability & Observability

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-09.1** | Automated Test Coverage | Financial calculation logic (BR-04, BR-18), nurse violation tracking (BR-01, BR-02), and four-factor authorization rules (BR-09) must maintain ≥ 80% decision branch test coverage in CI pipelines prior to merge. | Engineering Proposal |
| **NFR-09.2** | Configuration-Driven Business Logic | All operational fees, thresholds, deadlines, and SLA windows managed via effective-dated database configuration tables (FR-10.1, FR-10.2), enabling business updates without application code deployment. | Per Specification |
| **NFR-09.3** | Observability & Alerting | Structured JSON logging, system health dashboards, and automated operational alerts for: background queue backlogs, failed payment webhooks, spikes in email OTP failure rates, and unacknowledged SOS events exceeding 5 minutes. | BR-18, BR-23 + Engineering Proposal |
| **NFR-09.4** | Environment Segregation | Complete isolation across Development, Staging, and Production environments; Staging environments strictly restricted to anonymized synthetic test fixtures with zero real patient data. | Engineering Proposal |
| **NFR-09.5** | Standard Incident Runbooks | Documented operational playbooks for 4 standard system incidents: payment gateway failure (F8), AI engine outage (BR-10), unacknowledged SOS event (BR-23), and end-of-period financial reconciliation discrepancies (F7). | Per Specification |

---

## Key Decisions Pending Final PO Sign-Off

1. **NFR-02.1** — Production availability SLA commitment to pilot hospital (99.9% proposed; scaling to 99.95% increases infrastructure costs).
2. **NFR-02.2** — Formal RPO/RTO target sign-off and backup infrastructure budget allocation.
3. **NFR-04.2** — Cloud hosting region selection and formal cross-border data transfer legal assessment (linked to Decision Q-14).
4. **NFR-08.2** — Definition of nurse application offline mode boundaries (if excluded from pilot, offline check-in/report loss risk must be formally accepted).
5. **NFR-07.4** — SOS accidental tap prevention countdown mechanism (intersects user experience in BR-23, pending PO approval).

---

*Note: In the event of any discrepancies between specifications, the precedence order is: Business Rules (`use_case_v8.1.drawio`) → Activity Flows (`luong_hoat_dong_v8.14.drawio`) → Requirements Specifications.*
