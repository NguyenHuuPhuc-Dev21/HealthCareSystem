# Non-Functional Requirements Specification (NFRS)
## HealthCareSystem — On-Demand Healthcare & Nursing Staffing Platform

| Metadata | Details |
|---|---|
| **Specification Baseline** | SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**: Core quality attributes (§6: NFR-UI-01, NFR-COMP-01, NFR-AVAIL-01, NFR-SEC-01), supplemented by external integration SLAs (§9) and RTM acceptance criteria (§10). |
| **Architectural Model** | Single marketplace platform (no hospital tenants): Patient Web & Mobile App, Nurse Web Portal & Nurse Mobile App, Admin Web Portal. Target audience includes retired medical professionals requiring accessible UI on older mobile hardware. |
| **Document Status** | **Revised per SRS v2.0 — supersedes the hospital-baseline version.** Every quantified target below stems directly from the SRS v2.0 text. Quality attributes not explicitly quantified in SRS v2.0 are segregated into the *Open Items* register to avoid unverified assumptions. |

---

## Table of Contents
1. [NFR-UI: Elder-Friendly User Interface](#1-nfr-ui-elder-friendly-user-interface)
2. [NFR-COMP: Compatibility & Low-End Device Support](#2-nfr-comp-compatibility--low-end-device-support)
3. [NFR-AVAIL: Availability, Backup & Disaster Recovery](#3-nfr-avail-availability-backup--disaster-recovery)
4. [NFR-SEC: Security, Anti-Fraud & Financial Integrity](#4-nfr-sec-security-anti-fraud--financial-integrity)
5. [NFR-PERF: Quantified Performance Targets](#5-nfr-perf-quantified-performance-targets)
6. [NFR-PRIV: Privacy, Legal & Regulatory Compliance](#6-nfr-priv-privacy-legal--regulatory-compliance)
7. [Open Items Register (Decisions Pending)](#7-open-items-register-decisions-pending)

---

## 1. NFR-UI: Elder-Friendly User Interface

> **Rationale:** A significant proportion of the platform's Tier 2 specialist workforce consists of retired doctors and senior nurses. Product ergonomics must minimize cognitive load, visual strain, and complex interaction gestures.

### Summary Table
| Requirement ID | Attribute / Target Area | Target Metric / Standard | Target Phase |
|---|---|---|---|
| **NFR-UI-01.1** | Typography & Color Contrast | • Mobile: Font size 16pt–18pt<br>• Web: Font size 18px–20px<br>• Contrast: WCAG 2.1 AA ($\ge 4.5:1$) | MVP (Nurse Surfaces) |
| **NFR-UI-01.2** | Touch Targets & Interaction Depth | • Tap targets $\ge 48 \times 48\text{ dp}$<br>• Core flows $\le 3\text{ actions}$ | MVP (Nurse Surfaces) |
| **NFR-UI-01.3** | Elder-Friendly Patient App | • Extension of NFR-UI-01.1 & 01.2 to Customer Mobile App | Phase 2 (Patient App) |

### Detailed Specifications

#### NFR-UI-01.1: Typography & Color Contrast (Nurse Surfaces)
* **Target Standard:** WCAG 2.1 Level AA compliance.
* **Specification:**
  * Both the Nurse Web Portal and Nurse Mobile App provide an explicit "Large Text Mode" toggle.
  * Body font sizing: **16pt to 18pt** on the Mobile App, **18px to 20px** on the Web Portal.
  * Contrast ratio between foreground text and background elements must strictly meet or exceed **4.5:1** for standard text and **3.0:1** for large interactive headers.
* **Verification:** Automated axe-core / Lighthouse audit passes $\ge 95\%$ on accessibility score.

#### NFR-UI-01.2: Touch Targets & Interaction Depth (Nurse Surfaces)
* **Target Standard:** Android Material Design / iOS Human Interface Guidelines for accessibility.
* **Specification:**
  * All interactive touch targets (buttons, list selections, modal toggles) must be dimensioned to at least **$48 \times 48\text{ dp}$** with minimum 8dp spacing.
  * The three primary operational journeys—**Accept Shift**, **Log Shift Vitals/Tasks**, and **Pay 15% Cash Commission**—must require **no more than 3 interactions/screens** from dashboard entry to completion.
* **Verification:** Usability test protocol confirming 100% completion of primary tasks within 3 taps.

#### NFR-UI-01.3: Elder-Friendly Mode for Patient App (Phase 2)
* **Specification:** Extends the typography, simplified iconography, and oversized touch targets of NFR-UI-01.1 and NFR-UI-01.2 to the Patient Mobile App to enable independent booking by elderly patients.

---

## 2. NFR-COMP: Compatibility & Low-End Device Support

### Summary Table
| Requirement ID | Attribute / Platform | Target Metric / Scope | Target Phase |
|---|---|---|---|
| **NFR-COMP-01.1** | Nurse Mobile App Footprint & OS | • Binary size $< 50\text{ MB}$<br>• Android 8.0+ (API 26)<br>• iOS 13.0+ | MVP |
| **NFR-COMP-01.2** | Web Portals Browser Support | • Latest 2 versions of Chrome, Safari, Edge, Firefox<br>• Fully responsive across Desktop & Mobile | MVP |

### Detailed Specifications

#### NFR-COMP-01.1: Nurse Mobile App Footprint & OS Range
* **Context:** Retired professionals often operate mid-range or legacy smartphones with constrained internal flash storage and memory.
* **Specification:**
  * Clean release APK / IPA package size must remain under **50 MB**.
  * Backwards compatibility:
    * **Android:** Android 8.0 Oreo (API Level 26) and above.
    * **iOS:** iOS 13.0 and above.
  * In-memory footprint must remain stable below 150 MB RAM during camera operations and GPS tracking.

#### NFR-COMP-01.2: Web Portals Browser Compatibility
* **Specification:**
  * Patient Web, Nurse Web Portal, and Admin Web Portal must render and function seamlessly across modern evergreen desktop and mobile browsers:
    * Google Chrome (latest 2 versions)
    * Apple Safari (latest 2 versions)
    * Microsoft Edge (latest 2 versions)
    * Mozilla Firefox (latest 2 versions)
  * Responsive viewport breakpoints supported: Mobile ($320\text{px} - 767\text{px}$), Tablet ($768\text{px} - 1023\text{px}$), and Desktop ($\ge 1024\text{px}$).

---

## 3. NFR-AVAIL: Availability, Backup & Disaster Recovery

### Summary Table
| Requirement ID | Quality Attribute | Target Metric / SLA | Baseline Source |
|---|---|---|---|
| **NFR-AVAIL-01.1** | System Uptime & Maintenance Windows | • Availability SLA $\ge \mathbf{99.5\%}$<br>• Maintenance embargo: 19:00–21:00 | SRS §6 (NFR-AVAIL-01) |
| **NFR-AVAIL-01.2** | Database Backup, RPO & RTO | • PITR enabled + Daily Snapshot<br>• **RPO $\le 1\text{ hour}$** for wallets, $\le 24\text{h}$ for logs<br>• **RTO $\le 4\text{ hours}$** | SRS §6 (NFR-AVAIL-01) |

### Detailed Specifications

#### NFR-AVAIL-01.1: System Availability & Maintenance Embargo
* **Uptime Commitment:** Minimum **99.5%** monthly uptime (equating to $\le 3.65\text{ hours}$ unplanned downtime per month), excluding scheduled maintenance.
* **Shift Handover Embargo:** Routine database migrations or service deployments must **never** occur during the peak shift handover window between **19:00 and 21:00**, preventing disruption to evening and overnight shift check-ins.

#### NFR-AVAIL-01.2: Database Backup & Recovery Point / Time Objectives
* **Backup Scheme:**
  * Automated daily full PostgreSQL snapshot retained for 30 rolling days.
  * Continuous Write-Ahead Log (WAL) archiving to support Point-in-Time Recovery (PITR).
* **Recovery Targets:**
  * **Recovery Point Objective (RPO):**
    * Financial and wallet ledger transactions: $\mathbf{RPO \le 1\text{ hour}}$.
    * General operational shift logs and audit trails: $\mathbf{RPO \le 24\text{ hours}}$.
  * **Recovery Time Objective (RTO):** Full system availability restored within $\mathbf{RTO \le 4\text{ hours}}$ in the event of primary instance failure.

---

## 4. NFR-SEC: Security, Anti-Fraud & Financial Integrity

### Summary Table
| Requirement ID | Attribute Area | Core Security Mechanism | Baseline Source |
|---|---|---|---|
| **NFR-SEC-01.1** | Medical Media Storage | S3/MinIO Private Storage + 10-Minute Presigned URLs | SRS §6 |
| **NFR-SEC-01.2** | Concurrency Safety | ACID Transactions + Row Locks / Redis Distributed Locks | SRS §6, §4.5 |
| **NFR-SEC-01.3** | Check-In Anti-Spoofing | Hardware OS Mock Check + Live Camera Capture + GPS Timestamp | SRS §6, §4.4 |
| **NFR-SEC-01.4** | Payment Webhook Security | HMAC-SHA256 Signature Verification + Idempotency Keys | SRS §9 |
| **NFR-SEC-01.5** | Immutable Financial Ledger | Append-only `wallet_transactions` + `balance_before` / `after` | SRS §7 |
| **NFR-SEC-01.6** | Audit Trail & Access Revocation | Automated 12-hour health record cutoff + Immutable `audit_logs` | SRS §7, §4.1 |

### Detailed Specifications

#### NFR-SEC-01.1: Private Medical Media Storage
* **Policy:** All sensitive uploads—including CCCD identification photos, GPHN practicing licenses, medical prescriptions, and check-in selfies—are stored in **private** cloud storage buckets.
* **Access Control:** No public URLs are ever exposed. Client access is granted exclusively through dynamically generated **Presigned URLs with a maximum lifespan of 10 minutes**.

#### NFR-SEC-01.2: Concurrency & Race-Condition Safety
* **Enforcement:** The shift-acceptance endpoint (`POST /api/v1/bookings/:id/accept`) and all wallet mutation endpoints (settlement, commission self-payment, penalty deduction, withdrawal) must be protected by:
  * Database transaction isolation with row-level locks (`SELECT ... FOR UPDATE`).
  * Distributed lock via Redis with strict TTL to eliminate double acceptance and balance desynchronization.

#### NFR-SEC-01.3: Check-In Anti-Spoofing Protocol
* **Policy:**
  * Rejection of simulated GPS coordinates via `isFromMockProvider` (Android) or `isSimulatedBySoftware` (iOS).
  * Direct invocation of hardware camera; selection from device gallery is disabled in software.
  * Server-side watermark applied containing current UTC timestamp and geocoded coordinates.

#### NFR-SEC-01.4: Payment Webhook Cryptographic Integrity
* **Policy:**
  * Gateway callbacks (PayOS / VNPay) are verified by computing the **HMAC-SHA256** checksum across raw request body bytes and matching against the shared secret. Mismatches return HTTP 401 with immediate alert logging.
  * Replay protection: The gateway transaction ID is stored as a `UNIQUE` `idempotency_key` in `wallet_transactions`. Duplicate webhook calls return HTTP 200 without executing secondary balance increments.

#### NFR-SEC-01.5: Immutable Financial Ledger
* **Architecture:** Financial state is recorded via an **append-only ledger** (`wallet_transactions`).
* **Requirements:**
  * Direct SQL `UPDATE` queries on `balance` columns without a corresponding ledger entry are strictly prohibited.
  * Every mutation logs `balance_before` and `balance_after`.
  * Cash commission payments (`COMMISSION_PAYMENT`) and SLA penalties (`PENALTY_DEDUCT`) are strictly distinguished by explicit transaction types.

#### NFR-SEC-01.6: Audit Logging & Time-Boxed Access Expiry
* **Policy:**
  * Every administrative modification, credential approval, dispute resolution, and medical record access is captured in `audit_logs`.
  * Assigned nurses lose all viewing privileges to patient profiles and prescription images **exactly 12 hours after shift check-out** (FR-PRIV-01).

---

## 5. NFR-PERF: Quantified Performance Targets

> **Normative Boundary:** The performance metrics below represent the **complete set of explicitly quantified performance targets** defined in SRS v2.0 §9–§10. General API latency or global throughput goals not in SRS v2.0 are documented under Open Items.

### Summary Table
| Requirement ID | Operation / Journey | Quantified SLA Target | Enforcement Metric |
|---|---|---|---|
| **NFR-PERF-01** | Geo Matching Spatial Search | **$< 500\text{ ms}$** | Spatial filter within 5 km / 10 km radius |
| **NFR-PERF-02** | SOS Emergency Alert Delivery | **$< 2\text{ seconds}$** | Transit time from SOS tap to Family / Admin push |
| **NFR-PERF-03** | Urgent Notification Fallback | **$\le 60\text{ seconds}$** | Fallback to SMS / ZNS if push unacknowledged |

### Detailed Specifications

#### NFR-PERF-01: Geo Matching Query Speed
* **Specification:** Candidate nurse discovery queries covering a 5 km (Round 1) or 10 km (Round 2) radius—filtering by practitioner tier, service capability, and availability—must return in **under 500 milliseconds** under standard production loads.
* **Implementation:** PostgreSQL spatial indexing (PostGIS `ST_DWithin` / `cube` + `earthdistance`).

#### NFR-PERF-02: SOS Emergency Alert Delivery
* **Specification:** Upon a practitioner or patient activating the SOS button, the alert payload (GPS coordinates, patient profile, recent vitals) must reach the Family's mobile device and the Admin Web Portal in **less than 2 seconds**.
* **Simultaneous Local Trigger:** The native device dialer for **115 Emergency Ambulance** must launch concurrently without blocking on network response.

#### NFR-PERF-03: Urgent Notification Fallback
* **Specification:** High-priority alerts (SOS escalation, shift cancellation within 2 hours, urgent dispatch) are transmitted via high-priority FCM. If the client device does not acknowledge receipt within **60 seconds** (or if FCM returns `InvalidToken`), an automated worker dispatches an SMS or Zalo ZNS fallback message.

---

## 6. NFR-PRIV: Privacy, Legal & Regulatory Compliance

### Summary Table
| Requirement ID | Regulatory Domain | Mandatory Compliance Standard | Governing Authority |
|---|---|---|---|
| **NFR-PRIV-01** | Sensitive Health Data Consent | Explicit consent, timestamped, with right to erasure | Decree 13/2023/ND-CP |
| **NFR-PRIV-02** | Medical Record Archival | Maximum retention lifespan of **24 months** | Decree 13 / Circulars |
| **NFR-PRIV-03** | Phone Number Privacy & Shielding | Virtual numbers / In-app VoIP only; content regex scanning | Law on Telecommunications |
| **NFR-PRIV-04** | License Scope Enforcement | Database-level lock on `is_invasive`; daily GPHN cron check | Law 15/2023/QH15 |

### Detailed Specifications

#### NFR-PRIV-01: Health-Data Consent & Data Subject Rights
* **Statutory Compliance:** Decree 13/2023/ND-CP on Personal Data Protection.
* **Mechanism:**
  * Explicit opt-in checkbox required prior to patient profile creation, capturing user ID, `consent_timestamp`, IP address, and device fingerprint.
  * Platform provides self-service or admin-assisted data erasure/anonymization workflows for historical accounts not bound by ongoing legal or financial dispute investigations.

#### NFR-PRIV-02: Medical Record Retention Period
* **Lifespan Limit:** Historical medical orders, vital sign logs, and clinical handover notes are retained in active storage for **at most 24 months** post shift completion, after which records are archived or anonymized.

#### NFR-PRIV-03: Contact-Detail Masking & Telecom Shielding
* **Privacy Standard:** Personal phone numbers of both customer and nurse remain completely shielded and are never revealed in plain text across frontends.
* **Content Filtering:** In-app messaging scans chat content in real time. If numerical phone patterns or external links are detected, warning dialogues are presented to the user and infraction incidents are logged.

#### NFR-PRIV-04: Credential Validity Enforcement
* **Statutory Compliance:** Law on Medical Examination and Treatment 15/2023/QH15 and Decree 96/2023/ND-CP.
* **Enforcement:**
  * Invasive procedures (`is_invasive = true`) are gated at API gateway and database levels: any shift acceptance attempt by a `TIER_1_BASIC` nurse returns `HTTP 403 Forbidden`.
  * The daily expiration scanner automatically revokes Tier 2 status upon GPHN expiry, re-dispatching booked invasive shifts to valid specialists.

---

## 7. Open Items Register (Decisions Pending)

The following quality attributes were part of the superseded hospital baseline but are **unspecified in SRS v2.0**. They are cataloged here as open items and will not be bound by arbitrary implementation assumptions without stakeholder sign-off:

| # | Unspecified Architecture Attribute | Current Baseline Status | Impacted Component / System |
|---|---|---|---|
| **1** | **General API Latency & Throughput** | *Open Item* | Target p95/p99 latency budgets for standard CRUD APIs (only Geo < 500ms and SOS < 2s are normative). |
| **2** | **System Load & Volume Capacity** | *Open Item* | Projected concurrent users, peak transactions per second (TPS), daily active bookings. |
| **3** | **Cryptographic Standards & Auth Tokens** | *Open Item* | Specific hashing algorithm (Argon2id vs. BCrypt), JWT expiration lifetimes, OTP digit length and attempt rate-limits. |
| **4** | **Data Residency & Infrastructure Hosting** | *Open Item* | Physical cloud hosting jurisdiction requirements (domestic Vietnam data center vs. AWS/GCP Singapore region under Decree 53/2022/ND-CP). |
| **5** | **Offline Mobile App Synchronization** | *Open Item* | Caching depth and offline queueing behavior for the Nurse Mobile App in cellular dead-zones. |
| **6** | **Automated CI/CD Quality Gates** | *Open Item* | Mandatory unit and integration test coverage thresholds (e.g., minimum 80% coverage). |
| **7** | **Disaster Recovery Cadence** | *Open Item* | Scheduled frequency of live failover simulation drills (RPO/RTO targets themselves are fixed). |

---

*Note: In the event of any discrepancy between this specification and the governing baseline, the **SRS HealthCareSystem On-Demand Nursing v2.0 (Updated, 28/10/2026)** prevails.*
