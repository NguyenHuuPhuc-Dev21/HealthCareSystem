# Non-Functional Requirements Specification (NFRS)
## HealthCareSystem — On-Demand Healthcare & Nursing Staffing Platform

| Metadata | Details |
|---|---|
| **Specification Baseline** | SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**, §6 (NFR-UI-01, NFR-COMP-01, NFR-AVAIL-01, NFR-SEC-01), supplemented by the measurable targets stated in SRS §9 (External Integrations) and §10 (RTM Acceptance Criteria) |
| **Scope Assumption** | Single marketplace platform (no hospital tenants): Patient Web/App, Nurse Web Portal & Nurse Mobile App, Admin Web Portal. Nurse audience includes retired practitioners on low-end devices. |
| **Document Status** | **Revised per SRS v2.0 — supersedes the hospital-baseline version.** Every target below is taken from the SRS v2.0 text; quality attributes the SRS does not quantify are explicitly marked as open items instead of carrying over numbers from the superseded hospital baseline. |

---

## NFR-UI — Elder-Friendly User Interface (SRS NFR-UI-01)

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-UI-01.1** | Typography & Contrast (Nurse surfaces, MVP) | Both the Nurse Web Portal and the Nurse Mobile App support a large-text mode: font size 16pt–18pt on the App, 18px–20px on the Web; colour contrast compliant with WCAG 2.1 Level AA (minimum 4.5:1). | SRS §6 (NFR-UI-01) |
| **NFR-UI-01.2** | Touch Targets & Flow Depth (Nurse surfaces, MVP) | Tap targets ≥ 48×48dp; the accept-shift, shift-logging and commission-payment flows take at most 3 actions each. | SRS §6 (NFR-UI-01) |
| **NFR-UI-01.3** | Elder-Friendly UI for the Patient App | The same Elder-Friendly UI standard is extended to the Patient App so elderly patients can book unaided. | SRS §6 (NFR-UI-01) — **Phase 2** |

---

## NFR-COMP — Compatibility & Low-End Device Support (SRS NFR-COMP-01)

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-COMP-01.1** | Nurse Mobile App Footprint & OS Range | Because retired doctors/nurses commonly use older smartphones, the Nurse Mobile App must be lightweight (< 50 MB) and backward-compatible from **Android 8.0 (API level 26)** and **iOS 13.0** upwards. | SRS §6 (NFR-COMP-01) |
| **NFR-COMP-01.2** | Web Portal Compatibility | Nurse Web Portal, Patient Web and Admin Portal are responsive designs, working correctly on Chrome, Safari, Edge and Firefox (latest 2 versions) on both desktop and mobile devices. | SRS §6 (NFR-COMP-01) |

---

## NFR-AVAIL — Availability, Backup & Disaster Recovery (SRS NFR-AVAIL-01)

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-AVAIL-01.1** | System Availability | Uptime SLA ≥ **99.5%**; planned maintenance should avoid the night-shift handover window **19:00–21:00**. | SRS §6 (NFR-AVAIL-01) |
| **NFR-AVAIL-01.2** | Backup & Recovery | Automated daily full PostgreSQL backup (daily snapshot) combined with Point-in-Time Recovery (PITR). **RPO ≤ 1 hour** for wallet transactions and **≤ 24 hours** for logs; **RTO ≤ 4 hours**. | SRS §6 (NFR-AVAIL-01) |

---

## NFR-SEC — Security, Anti-Fraud & Financial Integrity (SRS NFR-SEC-01, §9)

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-SEC-01.1** | Private Medical Media Storage | All CCCD, GPHN, medical-order and selfie images are stored **Private** on S3/MinIO and are accessible only via **Presigned URLs valid for 10 minutes**. Permanent public URLs are prohibited. | SRS §6 (NFR-SEC-01) |
| **NFR-SEC-01.2** | Concurrency & Race-Condition Safety | ACID transactions plus `SELECT ... FOR UPDATE` or a Redis Distributed Lock are mandatory for the job-acceptance API and for every wallet balance-changing API (settlement, commission payment, penalty deduction, withdrawal). | SRS §6 (NFR-SEC-01); SRS §4.5 (FR-PAY-04) |
| **NFR-SEC-01.3** | Check-in Anti-Spoofing | The OS mock-location flag must be blocked and gallery photo selection disabled for check-in selfies; within the MVP, verification is by Live Camera capture stamped with the server timestamp and GPS coordinates (deep AI eKYC liveness is recorded in the SRS as a commercial-phase upgrade). | SRS §6 (NFR-SEC-01); FR-SHIFT-01 |
| **NFR-SEC-01.4** | Payment Webhook Integrity | Every gateway webhook must be verified by recomputing the **HMAC-SHA256** signature over the payload with the secret key; a signature mismatch is rejected with HTTP 401 and no balance change. Duplicate webhook deliveries are deduplicated by the gateway transaction id stored as `idempotency_key` (UNIQUE in `wallet_transactions`): a repeat delivery returns HTTP 200 but never credits money twice. | SRS §9 |
| **NFR-SEC-01.5** | Immutable Financial Ledger | Wallet movements are recorded in an append-only ledger (`wallet_transactions`) capturing `balance_before` and `balance_after` for every transaction; the cash-booking commission self-payment (`COMMISSION_PAYMENT`) is a transaction type strictly separate from deposit penalty deductions (`PENALTY_DEDUCT`). | SRS §7 (tables 8–9) |
| **NFR-SEC-01.6** | Audit Logging | All sensitive operations — medical-record views, GPHN approvals, dispute resolutions, configuration updates, patient-data deletions — are written to `audit_logs` with actor, action type, target, old/new values, IP address and timestamp. Medical-record access granted to a nurse is closed 12 hours after check-out (FR-PRIV-01); Admin re-grants for dispute handling must be time-boxed and audit-logged. | SRS §7 (table 16); FR-PRIV-01 |

---

## NFR-PERF — Performance Targets Stated in the SRS

The SRS v2.0 quantifies only the following performance points; they are normative. General API latency or throughput budgets are **not** quantified in the SRS (see Open Items).

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-PERF-01** | Geo Matching Query Speed | Spatial filtering of nurses within the 5 km / 10 km matching radius (Spatial Index / EarthDistance) completes in **< 500 ms**. | SRS §9 (Maps & Geolocation) |
| **NFR-PERF-02** | SOS Alert Delivery | On an SOS trigger, the emergency alert reaches the Family and the Admin Portal in **< 2 seconds**, while the app simultaneously opens the 115 dialler on the nurse's device. | SRS §10 (TC-SOS-01 acceptance criterion) |
| **NFR-PERF-03** | Urgent Notification Fallback | Urgent pushes are sent via FCM with `priority = high`; if FCM returns Unregistered/InvalidToken or the nurse's device does not acknowledge an urgent alert within **60 seconds**, a background worker automatically sends an SMS/Zalo ZNS fallback message. | SRS §9; FR-NOTIF-01 |

---

## NFR-PRIV — Privacy & Legal Compliance

| Requirement ID | Quality Attribute | Target Metric | Basis / Source |
|---|---|---|---|
| **NFR-PRIV-01** | Health-Data Consent (Decree 13/2023/ND-CP) | Patient health data is sensitive personal data: explicit consent of the patient or legal guardian is mandatory before a patient profile can be saved, recorded with `consent_timestamp` and IP/Device ID; a function to request deletion/anonymisation of personal data must be provided. | SRS §4.1 (FR-PRIV-01); REF-LAW-03 |
| **NFR-PRIV-02** | Medical Record Retention | Medical records are retained for a maximum of **24 months** for lookup/legal purposes. | SRS §4.1 (FR-PRIV-01) |
| **NFR-PRIV-03** | Contact-Detail Masking | Customer and nurse phone numbers are never exposed to each other; all contact happens through in-app chat/calling, and chat content is scanned for leaked phone numbers or external contact links (warning shown to the sender, event logged). | SRS §4.6 (FR-CHAT-01); §3 (RISK-06) |
| **NFR-PRIV-04** | Credential Validity Enforcement | Invasive services are gated in the database by the `is_invasive` flag and the nurse's tier; a Tier 1 nurse calling the accept API for an `is_invasive = true` booking must receive HTTP 403, and `is_prohibited = true` services cannot be booked at all. GPHN expiry is enforced by a daily check that demotes the nurse to Tier 1 until a renewed GPHN is approved (FR-AUTH-02). | SRS §10 (TC-AUTH-01…03); FR-AUTH-02 |

---

## Open Items — Not Specified in SRS v2.0

The following quality attributes were quantified in the superseded hospital-baseline NFRS but have **no target in SRS v2.0**. They must be decided and added to `system_configs` / this document before being treated as commitments (see `docs/business_rule/open-decisions-register.md`):

1. **General API latency & throughput budgets** — [Not specified in SRS v2.0 — open item] (only the geo-matching, SOS and notification-fallback targets above are quantified).
2. **Load/volume assumptions** (bookings per day, concurrent users, peak windows beyond the 19:00–21:00 maintenance-avoidance note) — [Not specified in SRS v2.0 — open item].
3. **Encryption algorithms at rest / in transit, password hashing standard, OTP length, validity and attempt limits** — [Not specified in SRS v2.0 — open item].
4. **Data residency / hosting region** — [Not specified in SRS v2.0 — open item].
5. **Offline / degraded-connectivity behaviour of the Nurse Mobile App** — [Not specified in SRS v2.0 — open item].
6. **Automated test-coverage thresholds and CI quality gates** — [Not specified in SRS v2.0 — open item].
7. **Disaster-recovery drill cadence** — [Not specified in SRS v2.0 — open item] (backup, RPO and RTO targets themselves are fixed by NFR-AVAIL-01.2).

---

*Note: In the event of any discrepancy between this specification and the governing baseline, the **SRS HealthCareSystem On-Demand Nursing v2.0 (Updated, 28/10/2026)** prevails.*
