# Functional Requirements Specification (FRS)
## HealthCareSystem — On-Demand Healthcare & Nursing Staffing Platform

| Metadata | Details |
|---|---|
| **Specification Baseline** | SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**: Marketplace connecting Patients/Families with retired doctors/nurses and newly graduated nursing students. **No hospital tenants.** |
| **Confirmed Tech Stack** | • **Web Frontends:** React (Patient Web, Nurse Web Portal, Admin Web Portal)<br>• **Mobile Frontend:** Nurse Mobile App (React Native)<br>• **Backend:** Node.js + TypeScript, Express/NestJS, PostgreSQL (16 core tables)<br>• **Storage & Media:** Private Object Storage (S3/MinIO) with 10-minute Presigned URLs<br>• **Messaging & Alerts:** FCM Push Notifications + SMS / Zalo ZNS fallback + WebSocket<br>• **Payment Gateways:** PayOS / VNPay / VietQR sandbox (Webhook HMAC-SHA256)<br>• **GIS & Maps:** Google Maps / Goong Geocoding API |
| **Document Status** | **Revised per SRS v2.0 — supersedes the hospital-baseline version.** All functional requirements below derive from the SRS v2.0 specification (§4), state machines (§2), configuration parameters (§5.1), and SLA policy (§5.2). |
| **Legal References** | • Law on Medical Examination and Treatment 15/2023/QH15<br>• Decree 96/2023/ND-CP (Healthcare implementation guidance)<br>• Decree 13/2023/ND-CP (Personal Data Protection) |

---

## Table of Contents
1. [Scope & Priority Conventions](#1-scope--priority-conventions)
2. [System Actors & Product Surfaces](#2-system-actors--product-surfaces)
3. [Booking State Model (Three Independent Axes)](#3-booking-state-model-three-independent-axes)
4. [Service Catalog & Practitioner Tiers](#4-service-catalog--practitioner-tiers)
5. [FR-AUTH & FR-PRIV: Authentication, eKYC & Privacy](#5-fr-auth--fr-priv-authentication-ekyc--privacy)
6. [FR-SCHED & FR-SEARCH: Availability & Nurse Discovery](#6-fr-sched--fr-search-availability--nurse-discovery)
7. [FR-BOOK: Booking, Medical-Order Control & Matching](#7-fr-book-booking-medical-order-control--matching)
8. [FR-SHIFT: Shift Execution, Anti-Fraud & Emergency SOS](#8-fr-shift-shift-execution-anti-fraud--emergency-sos)
9. [FR-PAY: Payments, Escrow Wallet, Deposit & Withdrawals](#9-fr-pay-payments-escrow-wallet-deposit--withdrawals)
10. [FR-DISP, FR-RATE, FR-NOTIF & FR-CHAT: Operations & Communication](#10-fr-disp-fr-rate-fr-notif--fr-chat-operations--communication)
11. [FR-ADMIN: Platform Administration & Reporting](#11-fr-admin-platform-administration--reporting)
12. [Annex A: System Configuration Parameters (`system_configs`)](#annex-a-system-configuration-parameters-system_configs)
13. [Annex B: Cancellation, Timeout & Compensation SLA Matrix](#annex-b-cancellation-timeout--compensation-sla-matrix)

---

## 1. Scope & Priority Conventions

### Priority Definitions (SRS v2.0 §1.2, §4.0)
* **`Mandatory (MVP)`**: Core, non-negotiable functionality (SRS label: *Bắt buộc*). The platform cannot operate legally or commercially without it.
* **`MVP`**: Required for the standard Phase 1 MVP release.
* **`Phase 2`**: Deferred to the subsequent expansion phase (e.g., long-term contracts, partial settlement adjudication, Elder-Friendly Patient App).

### Phase Boundaries
* **MVP Scope (Phase 1):**
  * Task-based and short-term shift bookings (4h, 8h, 12h, 24h).
  * Dual nurse surfaces: Nurse Web Portal & Nurse Mobile App.
  * Dual matching mechanisms: Radar Dispatch (urgent / short-notice) and Job Board (advance).
  * Dual payment methods: Prepaid bank transfer held by platform (Simulated Escrow) and on-site cash (nurse self-pays 15% platform commission).
  * Upfront nurse deposit of 300,000 VND (reserved exclusively for SLA violation penalties).
  * Automatic Tier demotion/promotion tied to GPHN expiry/renewal.
  * Dual-verified check-in (Anti-mock GPS + live in-app camera selfie).
  * Real-time clinical shift logging and SOS emergency escalation.
  * Two-way blind ratings and dispute resolution.
* **Phase 2 Scope:**
  * Long-term weekly/monthly recurring contracts (bidding, trial shifts, mid-contract nurse replacement).
  * Partial settlement adjudication (`PARTIALLY_SETTLED`).
  * Elder-Friendly UI mode extended to the Patient Mobile App.

---

## 2. System Actors & Product Surfaces

```
+--------------------------------------------------------------------------------+
|                               PLATFORM ACTORS                                  |
+----------------------+--------------------------+------------------------------+
| Patient / Family     | Nurse Tier 1 & Tier 2    | Medical Admin / Operator     |
| (Customer)           | (Practitioners)          | (Platform Backoffice)        |
| - Patient Web        | - Nurse Web Portal       | - Admin Web Portal           |
| - Patient Mobile App | - Nurse Mobile App       | (Enforced 2FA)               |
+----------------------+--------------------------+------------------------------+
```

| Actor | Product Surface | Core Responsibilities & Permissions |
|---|---|---|
| **Patient / Family**<br>*(Customer)* | • Patient Web<br>• Patient Mobile App | • Authenticate via Phone + SMS OTP.<br>• Undergo CCCD eKYC (mandatory for home-care bookings).<br>• Create and manage patient profiles; provide sensitive health data consent (Decree 13).<br>• Search nurse profiles, book, pay, accept work, raise disputes and rate. |
| **Nurse Tier 1**<br>*(TIER_1_BASIC)* | • Nurse Web Portal<br>• Nurse Mobile App | • Target: Fresh nursing graduates or practitioners without an active GPHN.<br>• Eligible strictly for **non-invasive** services (`is_invasive = false`).<br>• Complete phone OTP registration, CCCD eKYC, and degree verification.<br>• Manage weekly availability; accept shifts via Job Board; perform check-in and shift logs on Mobile App.<br>• Maintain 300,000 VND deposit; self-transfer 15% commission on cash bookings; withdraw income. |
| **Nurse Tier 2**<br>*(TIER_2_SPECIALIST)* | • Nurse Web Portal<br>• Nurse Mobile App<br>*(Elder-Friendly UI)* | • Target: Licensed doctors/nurses with valid, active GPHN (including retired personnel).<br>• Authorized for **both invasive and non-invasive** services per medical orders.<br>• Upload GPHN credentials; enjoy automated re-promotion upon license renewal.<br>• Review doctor prescriptions before accepting; verify paper orders on-site; refuse invalid orders without penalty.<br>• Supported by Elder-Friendly high-contrast, large-font UI on Web and Mobile. |
| **Medical Admin / Operator**<br>*(Backoffice)* | • Admin Web Portal<br>*(Mandatory 2FA)* | • Review nurse credentials (degree, GPHN, retirement papers) and manage Tier assignments.<br>• Manage service catalog, base prices, and dynamic `system_configs` parameters.<br>• Adjudicate customer-nurse disputes and examine audit logs.<br>• Reconcile platform escrow ledgers, commissions, penalties, and approve withdrawal requests. |

> **Authentication Standard:** Patient and Nurse accounts authenticate strictly via **Phone Number + OTP** (`/api/v1/auth/request-otp`, `/api/v1/auth/verify-otp`). Admin accounts authenticate via username/password with mandatory hardware/app 2FA.

---

## 3. Booking State Model (Three Independent Axes)

Every booking is governed by **three orthogonal status dimensions**. A single booking never compresses execution, financial status, and disputes into a single enum.

```
       [Execution Axis]                   [Payment Axis]                  [Dispute Axis]
            DRAFT                            UNPAID                            NONE
              |                                |                                 |
              v                                v                                 v
          MATCHING                     ESCROW_HELD (Bank)                      OPEN
              |                                |                                 |
              v                                v                                 v
          CONFIRMED                         SETTLED                        UNDER_REVIEW
              |                                |                                 |
              v                                v                                 v
         IN_PROGRESS                    PARTIALLY_SETTLED                  RESOLVED_...
              |                           (Phase 2 Only)
              v
          COMPLETED
   (Terminal: CANCELLED, EXPIRED)
```

### State Axis Definitions

| Axis | Database Column | Possible Values | State Transitions & Rules |
|---|---|---|---|
| **Execution** | `bookings.execution_status` | `DRAFT`<br>`MATCHING`<br>`CONFIRMED`<br>`IN_PROGRESS`<br>`COMPLETED`<br>`CANCELLED`<br>`EXPIRED` | • `DRAFT`: Held for 15 minutes awaiting payment; auto-expires to `EXPIRED` if unpaid.<br>• `MATCHING`: Dispatched via Radar or posted to Job Board.<br>• `CONFIRMED`: A nurse accepted the shift.<br>• `IN_PROGRESS`: Nurse completed dual-verified check-in on-site.<br>• `COMPLETED`: Nurse completed check-out and submitted shift summary.<br>• `EXPIRED`: Unmatched 30 mins prior to shift start (triggers 100% refund). |
| **Payment** | `bookings.payment_status` | `UNPAID`<br>`ESCROW_HELD`<br>`SETTLED`<br>`REFUNDED`<br>`PARTIALLY_SETTLED` | • `UNPAID`: Initial state for all bookings. Cash bookings remain `UNPAID` after completion until the nurse self-pays the 15% commission.<br>• `ESCROW_HELD`: Bank-transfer bookings after gateway webhook confirmation.<br>• `SETTLED`: Released 85% to nurse wallet (bank) OR nurse paid 15% commission (cash).<br>• `REFUNDED`: 100% or partial refund returned to customer via gateway.<br>• `PARTIALLY_SETTLED`: Phase 2 only — split adjudication upon dispute resolution. |
| **Dispute** | `bookings.dispute_status` | `NONE`<br>`OPEN`<br>`UNDER_REVIEW`<br>`RESOLVED_CUSTOMER`<br>`RESOLVED_NURSE`<br>`RESOLVED_PARTIAL` | • `NONE`: Default operational state.<br>• `OPEN`: Opened by customer or nurse during shift or within 24h post check-out. Escrow release is instantly frozen.<br>• `UNDER_REVIEW`: Admin accepted the dispute case for investigation.<br>• `RESOLVED_*`: Final administrative determination. |

> **Nurse Eligibility Source of Truth:** `nurse_profiles.profile_status` (`PENDING_VERIFICATION | ACTIVE | SUSPENDED | BANNED`) is the single governing authority controlling whether a nurse may view or accept jobs.

---

## 4. Service Catalog & Practitioner Tiers

Services are structured into three distinct clinical and regulatory tiers per Law 15/2023/QH15 and Decree 96/2023/ND-CP:

| Service Group | Invasive Flag & Tier Requirement | Allowed Clinical Procedures | Platform Enforcement |
|---|---|---|---|
| **Group 1: Basic Care & Daily Living Support** | • `is_invasive = false`<br>• **Tier 1 (Basic)** & **Tier 2 (Specialist)** | • Shift-based attendant care (4h, 8h, 12h, 24h) at home or hospital.<br>• Personal hygiene, bed bathing, diaper changing, repositioning.<br>• Oral feeding support, medication administration reminders per prescription.<br>• Non-invasive vital sign monitoring (BP, SpO2, Pulse, Temp).<br>• Mobility assistance, gentle exercise, elderly companionship. | Available to all `ACTIVE` nurses. No prescription upload required. |
| **Group 2: Conditional Invasive Procedures** | • `is_invasive = true`<br>• **Tier 2 (Specialist)** only<br>• Active GPHN mandatory<br>• Doctor's prescription required | • Subcutaneous / intramuscular injections (insulin, maintenance drugs safely initiated at hospital).<br>• Maintenance IV infusions (saline, Ringer, Glucose) strictly per prescription.<br>• Wound dressing, post-surgical care, suture removal.<br>• Urinary catheter care/replacement; gastric tube feeding.<br>• Upper airway suctioning with personal suction equipment. | System enforces mandatory medical-order image upload (≤ 7 days old). Tier 1 nurses blocked at database level (`403 Forbidden`). |
| **Group 3: Strictly Prohibited Procedures** | • `is_prohibited = true`<br>• **Strictly Blocked** | • Blood, plasma, or blood-product transfusions at home.<br>• IV administration of antibiotics, contrast agents, chemotherapy, or drugs with high anaphylaxis risk not pre-tested in hospital.<br>• Minor surgeries, abscess incisions, emergency suturing, anesthesia.<br>• Issuing new prescriptions or altering doctor regimens. | Prohibited from the service catalog. Keyword filter rejects custom requests. |

---

## 5. FR-AUTH & FR-PRIV: Authentication, eKYC & Privacy

### Summary Table
| Requirement ID | Module Title | Target Surface | Priority |
|---|---|---|---|
| **FR-AUTH-01** | Nurse eKYC Registration & GPHN Profile Update | Nurse Web / Mobile App | Mandatory (MVP) |
| **FR-AUTH-02** | GPHN Verification & Automated Tier Demotion/Promotion | Admin Web Portal, System Worker | Mandatory (MVP) |
| **FR-AUTH-03** | Patient Profile Management & Customer eKYC | Patient Web / Mobile App | Mandatory (MVP) |
| **FR-PRIV-01** | Health-Data Consent & Access Lifecycle (Decree 13) | Patient & Nurse Surfaces | Mandatory (MVP) |

### Detailed Specifications

#### FR-AUTH-01: Nurse eKYC Registration & GPHN Profile Update
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.1
* **Objective:** Allow prospective nurses to register and submit credentials, and active nurses to upload license renewals.
* **Workflow & Business Rules:**
  1. The nurse authenticates using Phone Number + SMS OTP.
  2. The nurse submits mandatory identity documents: both sides of CCCD and a live portrait photo.
  3. The nurse submits professional credentials:
     * Medical/Nursing Diploma (mandatory for all).
     * Practicing Certificate (GPHN - optional for Tier 1, mandatory for Tier 2): Certificate number, issue date, expiration date (`gphn_expiry_date`), issuing authority, and authorized scope.
     * Retirement Decision: Optional supporting document to receive the "Experienced Retired Specialist" badge.
  4. System marks initial profile as `PENDING_VERIFICATION`. The nurse cannot view contact details or accept shifts until approved by an Admin.
  5. Active nurses uploading a renewed GPHN have their credential marked `PENDING` without disrupting their current Tier 1 basic care operations.

#### FR-AUTH-02: GPHN Verification & Automated Tier Demotion/Promotion
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.1, §2.3
* **Objective:** Automate compliance with practicing license validity and tier enforcement.
* **Workflow & Business Rules:**
  1. **Admin Review:** Admin verifies credentials on Admin Portal; recording `reviewed_by = admin.id` and timestamp.
     * Approved Diploma only $\rightarrow$ `TIER_1_BASIC`.
     * Approved Valid GPHN $\rightarrow$ `TIER_2_SPECIALIST`.
     * Retirement decision awards a cosmetic badge only; it *never* bypasses the requirement for a valid GPHN for invasive procedures.
  2. **Automated Expiry Demotion:** A daily cron job scans `gphn_expiry_date`. When expired:
     * System automatically demotes practitioner from `TIER_2_SPECIALIST` to `TIER_1_BASIC`.
     * Profile status remains `ACTIVE` for non-invasive services.
     * Future `CONFIRMED` invasive bookings scheduled past the expiry date are auto-cancelled without penalty and re-dispatched to replacement Tier 2 nurses.
  3. **Automated Re-Promotion:** Upon Admin approval of a renewed GPHN, the system automatically re-promotes the nurse to `TIER_2_SPECIALIST`.

#### FR-AUTH-03: Patient Profile Management & Customer eKYC
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.1
* **Objective:** Capture necessary clinical context and establish customer accountability.
* **Workflow & Business Rules:**
  1. Customer creates patient profiles: Full name, birth year, weight (kg), mobility status (`WALKING`, `LIMITED`, `BEDRIDDEN`), medical history, infectious disease flags, and home address coordinates.
  2. **Location-based eKYC Gate:**
     * **Hospital Care:** Phone + OTP authentication is sufficient.
     * **Home-Care Visit:** Customer must complete CCCD eKYC (both sides of CCCD + live selfie) before being allowed to create a booking, preventing predatory/unsafe home dispatch.

#### FR-PRIV-01: Health-Data Consent & Access Lifecycle (Decree 13/2023/ND-CP)
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.1, §6
* **Objective:** Ensure compliance with statutory personal and medical data protection regulations.
* **Workflow & Business Rules:**
  1. **Explicit Consent:** Patient or legal guardian must check an explicit sensitive health data processing consent box prior to booking creation; system logs `consent_timestamp`, IP, and Device ID.
  2. **Time-Boxed Access Control:** Only the nurse assigned to a `CONFIRMED` or `IN_PROGRESS` booking has access to view patient records and medical order images.
  3. **12-Hour Access Cutoff:** Access is **automatically revoked 12 hours after shift check-out** (`checkout_time`). During the remaining 24-hour dispute window, evidence is extracted from encrypted logs. Admin may grant temporary access only under a logged audit event.
  4. **Retention & Erasure:** Medical records are retained for a maximum of 24 months for clinical/legal audit. Customers may invoke a "Request Data Erasure/Anonymization" function under Decree 13.

---

## 6. FR-SCHED & FR-SEARCH: Availability & Nurse Discovery

### Summary Table
| Requirement ID | Module Title | Target Surface | Priority |
|---|---|---|---|
| **FR-SCHED-01** | Nurse Availability & Exception Management | Nurse Web / Mobile App | Mandatory (MVP) |
| **FR-SEARCH-01** | Nurse Search & Profile Discovery | Patient Web / Mobile App | MVP |

### Detailed Specifications

#### FR-SCHED-01: Nurse Availability & Exception Management
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.2
* **Objective:** Provide accurate scheduling data for search filters and dispatch matching algorithms.
* **Workflow & Business Rules:**
  1. Nurse registers recurring weekly availability blocks (e.g., Mon/Wed/Fri 08:00–16:00) and declares date-specific blackout dates in `nurse_availabilities`.
  2. **Automated Buffer Enforcement:** The Matching Engine computes true availability by checking existing `CONFIRMED` and `IN_PROGRESS` shifts and enforcing a mandatory **60-minute travel buffer** between consecutive shifts.
  3. Bookings cannot be dispatched to or accepted by nurses whose schedule violates the travel buffer.

#### FR-SEARCH-01: Nurse Search & Profile Discovery
* **Priority:** `MVP` | **Source:** SRS §4.2
* **Objective:** Enable patients to discover suitable, verified nurses for direct booking.
* **Workflow & Business Rules:**
  1. Filter criteria: Service category, geographic location/distance, required time slot, practitioner tier (Tier 1 vs. Tier 2), and gender.
  2. Search results display `ACTIVE` and available nurses as profile cards: Full name, avatar, tier badge, years of experience, retired doctor/nurse recognition, average rating (`rating_avg`), and verified reviews from past shifts.
  3. Patients may initiate a direct booking request to a specific nurse or broadcast to the open platform.

---

## 7. FR-BOOK: Booking, Medical-Order Control & Matching

### Summary Table
| Requirement ID | Module Title | Target Surface | Priority |
|---|---|---|---|
| **FR-BOOK-01** | Shift Booking & Parameterized Pricing Engine | Patient Web / Mobile App | Mandatory (MVP) |
| **FR-BOOK-02** | Three-Layer Medical-Order Control Protocol | All Surfaces | Mandatory (MVP) |
| **FR-BOOK-03** | Dual Matching Engine (Radar Dispatch & Job Board) | Backend / All Surfaces | MVP |
| **FR-BOOK-04** | Long-Term Contract Bidding & Trial Shift | Patient & Nurse Surfaces | Phase 2 |
| **FR-BOOK-05** | Long-Term Contract Lifecycle Management | All Surfaces | Phase 2 |

### Detailed Specifications

#### FR-BOOK-01: Shift Booking & Parameterized Pricing Engine
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.3, §5.1
* **Objective:** Compute transparent, predictable pricing driven by dynamic system configurations.
* **Pricing Formula:**
  $$\text{Total Price} = \text{Base Price} + \text{Night Surcharge} + \text{Holiday Surcharge} + \text{Heavy Patient Surcharge}$$
  * *Night Surcharge:* +20% (`SURCHARGE_NIGHT_SHIFT`) applied **strictly to hours between 22:00 and 06:00**.
  * *Holiday Surcharge:* +300% (`SURCHARGE_HOLIDAY_MAJOR`) for Tết Nguyên Đán; +200% (`SURCHARGE_HOLIDAY_MINOR`) for other statutory public holidays. Surcharges apply additively to the base price.
  * *Heavy Patient Surcharge:* +15% (`SURCHARGE_HEAVY_PATIENT`) when patient `weight_kg >= 80` or `mobility_status = 'BEDRIDDEN'`.
* **Worked Example (from SRS):**
  * Shift from 20:00 to 06:00 (10 hours) at 50,000 VND/hour $\rightarrow$ Base Price = 500,000 VND.
  * Night hours (22:00–06:00) = 8 hours $\rightarrow$ Night Surcharge = $8 \times 50,000 \times 20\% = 80,000\text{ VND}$.
  * Total Shift Price = 580,000 VND.
* **Post-Creation Lifecycle:**
  * Created booking initialized to `execution_status = DRAFT`, `payment_status = UNPAID`.
  * Booking is held for 15 minutes (`PAYMENT_TIMEOUT_MINUTES`). If unpaid, it moves to `EXPIRED`.
  * Customer explicitly selects payment method (`BANK_TRANSFER` or `CASH`) at booking creation.

#### FR-BOOK-02: Three-Layer Medical-Order Control Protocol
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.3
* **Objective:** Prevent unlawful or hazardous invasive care delivery without physician oversight.
* **Enforcement Layers:**
  1. **Layer 1 (Customer Booking):** When selecting an `is_invasive = true` service, uploading a clear photo of the doctor's prescription/medical order is mandatory. Prescription date must be within 7 days; doctor's stamp/signature and clinic name must be legible.
  2. **Layer 2 (Nurse Pre-Acceptance):** The candidate Tier 2 nurse must inspect the prescription image directly in the app before tapping "Accept Shift".
  3. **Layer 3 (On-Site Verification at Check-In):** Upon arrival, the nurse inspects the original paper prescription and physical medication packaging. If forged, altered, expired, or mismatched:
     * Nurse taps "Reject Shift — Invalid Medical Order" with mandatory photo evidence.
     * Shift is immediately aborted without penalty to the nurse.
     * Nurse receives 50,000 VND travel support from the platform operations fund.

#### FR-BOOK-03: Dual Matching Engine (Radar Dispatch & Job Board)
* **Priority:** `MVP` | **Source:** SRS §4.3
* **Objective:** Optimize fulfillment speed for both urgent emergencies and planned future shifts.

```
                                  BOOKING MATCHING ROUTING
                                             |
                  +--------------------------+--------------------------+
                  |                                                     |
        Lead Time <= 6 Hours                                  Lead Time > 6 Hours
                  |                                                     |
                  v                                                     v
          [RADAR DISPATCH]                                         [JOB BOARD]
       • Min 0-5:  5 km Radius                               • Open broadcast to qualified
       • Min 5-15: 10 km Radius                                nurses in district.
       • First to accept wins.                               • Direct request: 15m nurse window.
```

* **Mechanism A: Radar Dispatch (Urgent / Short-Notice $\le$ 6 Hours):**
  * *Round 1 (0–5 minutes):* Real-time push broadcast to qualified, available nurses within a **5 km radius**.
  * *Round 2 (5–15 minutes):* Radius automatically expands to **10 km radius**.
  * Concurrency control: Atomic assignment via Redis Distributed Lock / `SELECT FOR UPDATE` ensures first-to-accept wins without double booking.
* **Mechanism B: Job Board (Advance Bookings > 6 Hours):**
  * Posted to the active "Job Board" feed for eligible nurses.
  * Direct bookings provide the chosen nurse a 15-minute exclusive reservation window before broadcasting.
* **Universal Eligibility Gate:** Nurses must have `deposit_balance >= 300,000 VND` to receive dispatch alerts or accept jobs.
* **Matching Expiry:** If unclaimed 30 minutes before start time (or after 30 mins for urgent bookings), `execution_status` moves to `EXPIRED`, and prepaid funds are refunded 100%.

#### FR-BOOK-04 & FR-BOOK-05: Long-Term Contract Management (Phase 2)
* **FR-BOOK-04 (Bidding & Trial Shift):** Families post monthly recurring schedules $\rightarrow$ nurses apply with quotes $\rightarrow$ family books a mandatory 4h/8h trial shift before signing the full contract.
* **FR-BOOK-05 (Contract Lifecycle):** Supports temporary contract pausing (e.g., patient hospitalized), mid-contract nurse replacement with prorated settlement, and early contract termination with SLA refunds.

---

## 8. FR-SHIFT: Shift Execution, Anti-Fraud & Emergency SOS

### Summary Table
| Requirement ID | Module Title | Target Surface | Priority |
|---|---|---|---|
| **FR-SHIFT-01** | Dual-Verified Check-In (GPS & Selfie Anti-Fraud) | Nurse Mobile App | MVP |
| **FR-SHIFT-02** | Real-Time Clinical Shift Log & Condition Discrepancy | Nurse Mobile App | Mandatory (MVP) |
| **FR-SHIFT-03** | In-Session Shift Extension (Overtime) | Patient & Nurse Surfaces | MVP |
| **FR-SHIFT-04** | Check-Out & Care Summary Submission | Nurse Mobile App | Mandatory (MVP) |
| **FR-SHIFT-05** | Emergency Critical Care (SOS) Protocol | Nurse Mobile App & Admin | Mandatory (MVP) |

### Detailed Specifications

#### FR-SHIFT-01: Dual-Verified Check-In (GPS & Selfie Anti-Fraud)
* **Priority:** `MVP` | **Source:** SRS §4.4
* **Objective:** Prevent ghost check-ins and identity swapping on home visits.
* **Verification Workflow:**
  1. **Anti-Mock GPS Check:** Mobile OS mock-location flags (`isFromMockProvider` on Android / `isSimulatedBySoftware` on iOS) are evaluated. Mocking attempts immediately abort check-in and log a security alert.
  2. **Geofence Enforcement:** Nurse device GPS coordinates must be within **200 meters** (`CHECKIN_MAX_RADIUS_METERS`) of the booking coordinates via Haversine calculation.
  3. **Live Camera Selfie:** Nurse captures a live portrait photo via the in-app camera (gallery uploads strictly disabled). The image is watermarked with server timestamp and GPS coordinates, and forwarded to the customer app.
  4. Upon verification, `execution_status` updates to `IN_PROGRESS`.

#### FR-SHIFT-02: Real-Time Clinical Shift Log & Condition Discrepancy
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.4
* **Objective:** Maintain continuous medical accountability during shift execution.
* **Workflow & Business Rules:**
  1. **Discrepancy Reporting (First 30 Minutes):** If the patient's actual condition diverges significantly from declarations (e.g., unannounced bedridden state, undisclosed contagious infection, aggressive environment), the nurse can request a surcharge update or cancel the shift without penalty.
  2. **Continuous Clinical Log:** Throughout the shift, the nurse logs vital signs (Pulse, Temperature, Blood Pressure, SpO2) and performed nursing actions into `shift_logs`, synchronized in real time via WebSockets.

#### FR-SHIFT-03: In-Session Shift Extension (Overtime)
* **Priority:** `MVP` | **Source:** SRS §4.4
* **Objective:** Allow families to extend shifts when care requirements exceed scheduled hours.
* **Workflow & Business Rules:**
  1. Permitted up to 30 minutes prior to scheduled shift end time.
  2. Extended in 1-hour increments (`POST /api/v1/bookings/:id/extend`).
  3. Allowed only if the nurse confirms availability and has no conflicting subsequent booking.
  4. Extension fees are escrowed immediately for bank-transfer bookings or added to the final cash bill.

#### FR-SHIFT-04: Check-Out & Care Summary Submission
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.4
* **Objective:** Formally conclude the shift and trigger financial and dispute workflows.
* **Workflow & Business Rules:**
  1. Nurse logs final vital signs, care summary notes, and handover observations before submitting check-out (`POST /api/v1/bookings/:id/check-out`).
  2. System records `checkout_time` and transitions `execution_status` $\rightarrow$ `COMPLETED`.
  3. Task-based bookings receive 100% full service price upon completion of all checklist tasks, regardless of early completion.
  4. Triggers two automatic timers:
     * Starts the **24-hour settlement & dispute cooling window** (`SETTLEMENT_COOLING_HOURS = 24`).
     * Starts the **12-hour health record access cutoff timer** (FR-PRIV-01).

#### FR-SHIFT-05: Emergency Critical Care (SOS) Protocol
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.4
* **Objective:** Protect patient life during sudden acute clinical deterioration (apnea, stroke, anaphylaxis).
* **Two-Step Protocol:**
  1. **Step 1 (Immediate On-Site Action - Absolute Priority):**
     * Nurse or caregiver immediately dials **115 Emergency Ambulance** and initiates BLS (Basic Life Support) within professional scope.
     * The app SOS screen immediately launches the phone's native emergency 115 dialer.
  2. **Step 2 (Simultaneous Platform Broadcast):**
     * The platform automatically fires emergency push notifications and SMS alerts with GPS coordinates and latest vital signs to the Family and Admin Portal.
     * The platform acts strictly as an informational and coordination broadcast; it never replaces emergency medical services (115).

---

## 9. FR-PAY: Payments, Escrow Wallet, Deposit & Withdrawals

### Core Financial Architecture (SRS §4.5, §2.3)
The platform operates a **Simulated Escrow Ledger** with strictly separated balances:
* `available_balance`: Earned remuneration available for bank withdrawal.
* `deposit_balance`: Mandatory 300,000 VND security deposit; used **strictly and exclusively for SLA penalties**. It is **never** debited for commissions.
* `escrow_balance`: In-flight funds held by the platform pending shift completion.

```
+------------------------------------------------------------------------------------------------+
|                                    PAYMENT METHOD WORKFLOWS                                    |
+------------------------------------------------------------------------------------------------+
| [BANK TRANSFER]                                                                                |
| Customer prepays 100% -> Gateway Webhook (HMAC) -> Funds locked in ESCROW_HELD                 |
| Shift Completed -> 24h Cooling Window -> Worker deducts 15% Platform Commission                |
| -> 85% credited to Nurse available_balance -> SETTLED.                                         |
+------------------------------------------------------------------------------------------------+
| [CASH ON SITE]                                                                                 |
| Customer pays 100% Cash to Nurse at check-out (Platform holds 0 VND). Tips are uncommissioned. |
| Shift Completed -> System generates 15% Commission VietQR -> Nurse self-pays within 24h        |
| -> Gateway confirms payment -> SETTLED. (If unpaid after 24h -> Nurse SUSPENDED).             |
+------------------------------------------------------------------------------------------------+
```

### Summary Table
| Requirement ID | Module Title | Target Surface | Priority |
|---|---|---|---|
| **FR-PAY-01** | Dual Payment Model (Prepaid Escrow vs. On-Site Cash) | All Surfaces | Mandatory (MVP) |
| **FR-PAY-02** | Automated 24h Settlement & Commission Self-Transfer | Backend / Nurse App | Mandatory (MVP) |
| **FR-PAY-03** | Nurse Deposit Wallet (Exclusive Penalty Isolation) | Nurse App / Admin Portal | MVP |
| **FR-PAY-04** | Earnings Management & Bank Account Withdrawals | Nurse App / Admin Portal | MVP |

### Detailed Specifications

#### FR-PAY-01: Dual Payment Model (Prepaid Escrow vs. On-Site Cash)
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.5
* **Payment Method 1: Bank Transfer (Prepaid Escrow):**
  * Customer prepays 100% via sandbox gateway (PayOS / VNPay / VietQR).
  * Gateway webhook verified via HMAC-SHA256 signature with idempotency check.
  * Status set to `ESCROW_HELD`. Funds remain locked until check-out and dispute window expiry.
* **Payment Method 2: Cash (Paid Directly On-Site):**
  * Customer pays 100% of shift price in cash directly to the nurse at check-out.
  * Tips above the in-app price belong 100% to the nurse and are not subject to commission.
  * System records shift at in-app price. Platform never touches customer cash.
  * Mandatory declaration of `payment_method` (`BANK_TRANSFER` | `CASH`) at booking creation.

#### FR-PAY-02: Automated 24h Settlement & Commission Self-Transfer
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.5
* **Settlement Cooling Period:** Exactly 24 hours (`SETTLEMENT_COOLING_HOURS = 24`) post check-out.
* **Bank-Transfer Settlement:**
  * If customer clicks "Confirm Completion" early, or upon 24h timer expiration with `dispute_status = 'NONE'`:
  * Automated worker deducts 15% commission (`PLATFORM_COMMISSION_RATE = 0.15`).
  * Credits remaining 85% to nurse's `available_balance` (`payment_status` $\rightarrow$ `SETTLED`).
* **Cash Commission Self-Payment:**
  * At check-out, system calculates 15% commission on the official in-app booking price.
  * Mobile app displays a VietQR payment code / payment link (`POST /api/v1/bookings/:id/commission-payment-link`).
  * Nurse must self-transfer the 15% commission to the platform within 24 hours.
  * Commission is **never deducted from `deposit_balance`**.
  * Upon webhook payment confirmation, booking transitions to `SETTLED`.
  * If unpaid after 24 hours, nurse profile is automatically set to `SUSPENDED` until paid in full.

#### FR-PAY-03: Nurse Deposit Wallet (Exclusive Penalty Isolation)
* **Priority:** `MVP` | **Source:** SRS §4.5, §2.3
* **Rules & Constraints:**
  1. Nurse must maintain an upfront deposit norm of **300,000 VND** (`MIN_NURSE_DEPOSIT`) in `deposit_balance` before being permitted to accept shifts.
  2. **Sole Permitted Usage:** Dedicated exclusively to SLA violation penalties (late cancellation, no-show, confirmed dispute infractions) under transaction type `PENALTY_DEDUCT`.
  3. Never used to offset booking values, cash commissions, or operational fees.
  4. If penalties reduce `deposit_balance` below 300,000 VND, the nurse is immediately `SUSPENDED` from accepting new jobs until topped back up.
  5. Deposit is fully refundable only upon voluntary account termination, following a 7-day dispute-free waiting period.

#### FR-PAY-04: Earnings Management & Bank Account Withdrawals
* **Priority:** `MVP` | **Source:** SRS §4.5
* **Workflow & Business Rules:**
  1. Nurse views weekly/monthly earnings charts and itemized transaction ledger.
  2. Nurse submits a withdrawal request (`POST /api/v1/wallets/withdraw`) for an amount $\le$ `available_balance`.
  3. Database initiates an ACID transaction with row-level locking (`FOR UPDATE`), debits `available_balance`, and writes a `WITHDRAW_REQUESTED` record.
  4. Admin reviews and disburses funds via banking gateway $\rightarrow$ status updates to `WITHDRAWN`.

---

## 10. FR-DISP, FR-RATE, FR-NOTIF & FR-CHAT: Operations & Communication

### Summary Table
| Requirement ID | Module Title | Target Surface | Priority |
|---|---|---|---|
| **FR-DISP-01** | Shift Dispute Resolution Workflow | All Surfaces / Admin | Mandatory (MVP) |
| **FR-DISP-02** | Partial Settlement Adjudication | Admin Web Portal | Phase 2 |
| **FR-RATE-01** | Two-Way Blind Rating & TrustScore System | Patient & Nurse Surfaces | MVP |
| **FR-NOTIF-01** | Multi-Channel Notifications & SMS Fallback | All Surfaces / Backend | MVP |
| **FR-CHAT-01** | In-App Masked Chat & Telecom Shielding | Patient & Nurse Mobile | MVP |

### Detailed Specifications

#### FR-DISP-01: Shift Dispute Resolution Workflow
* **Priority:** `Mandatory (MVP)` | **Source:** SRS §4.6
* **Dispute Submission:** Customer or nurse can open a dispute from `IN_PROGRESS` up to 24 hours post check-out. Categories: premature abandonment, clinical protocol violation, unprofessional conduct, false clinical declarations. Allows up to 5 attached photos/videos.
* **Escrow Freeze:** Setting `dispute_status` $\rightarrow$ `OPEN` immediately halts automated settlement timers.
* **Adjudication Outcomes:**
  * `RESOLVED_CUSTOMER`: 100% refund to customer (`REFUNDED`), TrustScore penalty (−25) and deposit deduction for nurse. (For cash bookings, compensation is deducted from nurse's deposit wallet).
  * `RESOLVED_NURSE`: Full 85% remuneration released to nurse wallet (`SETTLED`).

#### FR-DISP-02: Partial Settlement Adjudication (Phase 2)
* **Priority:** `Phase 2` | **Source:** SRS §4.6, §2.2
* Applied when both parties share fault or an unforeseen event terminates a shift halfway. Admin inputs a split percentage (e.g., 40% refund / 60% nurse pay) $\rightarrow$ updates `payment_status` to `PARTIALLY_SETTLED`.

#### FR-RATE-01: Two-Way Blind Rating & TrustScore System
* **Priority:** `MVP` | **Source:** SRS §4.6
* **Blind Rating:** Post check-out, both parties submit a 1–5 star rating and review. Ratings remain hidden until both parties submit or 7 days elapse (`reviews.is_visible = true`), eliminating retaliatory scoring.
* **TrustScore Mechanics (Range 0–100, Base 100):**
  * Penalty: Cancel shift > 12h ahead: **−5 pts**.
  * Penalty: Cancel shift $\le$ 12h ahead: **−20 pts**.
  * Penalty: Violation upheld in dispute: **−25 pts**.
  * Recovery: +2 pts for each completed shift rated $\ge$ 4 stars (capped at 100).
  * Automatic Sanction: TrustScore < 60 automatically sets profile status to `SUSPENDED`.

#### FR-NOTIF-01: Multi-Channel Notifications & SMS Fallback
* **Priority:** `MVP` | **Source:** SRS §4.6, §9
* Primary channels: FCM Push Notifications + WebSockets + In-App Notification Center.
* **SMS Fallback:** If FCM reports failure, or an urgent alert (SOS, cancellation within 2 hours, new urgent job) is unacknowledged by a nurse device within **60 seconds**, an SMS / Zalo ZNS fallback is dispatched automatically.

#### FR-CHAT-01: In-App Masked Chat & Telecom Shielding
* **Priority:** `MVP` | **Source:** SRS §4.6, §3
* Contact between parties opens upon booking status `CONFIRMED`. Real phone numbers are masked.
* System scans message payloads using regex for external phone numbers, social media links, or off-platform payment solicitations, issuing warnings and logging infractions for administrative review.

---

## 11. FR-ADMIN: Platform Administration & Reporting

#### FR-ADMIN-01: Service Catalog, Configurations & Reconciliation
* **Priority:** `MVP` | **Source:** SRS §4.6
* **Service & Config Management:** Admin can modify base prices, toggle `is_invasive` flags, and adjust parameters in `system_configs` in real time without code deployment.
* **User & Staff Governance:** Search, audit, suspend, or ban accounts based on TrustScore or clinical safety concerns.
* **Financial Ledger & Reconciliation:** Export audit trails of total escrow receipts, platform commissions (15%), disbursements, refunds, and outstanding nurse debts.

---

## Annex A: System Configuration Parameters (`system_configs`)

All platform monetary norms, time windows, and surcharge percentages reside in the `system_configs` table:

| Parameter Key | Value | Unit | Category | Business Logic & Impact |
|---|---|---|---|---|
| `PLATFORM_COMMISSION_RATE` | `0.15` | Ratio (15%) | Financial | Platform take-rate. Bank bookings: 15% withheld, 85% paid to nurse. Cash bookings: Nurse self-pays 15% to platform. |
| `MIN_NURSE_DEPOSIT` | `300000` | VND | Security Deposit | Mandatory upfront deposit balance required before receiving or accepting shift assignments. Dedicated exclusively to penalties. |
| `SURCHARGE_NIGHT_SHIFT` | `0.20` | Ratio (+20%) | Surcharge | Multiplied against base hourly rate for hours worked between 22:00 and 06:00. |
| `SURCHARGE_HOLIDAY_MAJOR` | `3.00` | Ratio (+300%) | Surcharge | Tết Nguyên Đán holiday rate: Surcharge = 300% of base booking value. |
| `SURCHARGE_HOLIDAY_MINOR` | `2.00` | Ratio (+200%) | Surcharge | Statutory public holidays: Surcharge = 200% of base booking value. |
| `SURCHARGE_HEAVY_PATIENT` | `0.15` | Ratio (+15%) | Surcharge | Applied when patient `weight_kg >= 80` or `mobility_status = 'BEDRIDDEN'`. |
| `PAYMENT_TIMEOUT_MINUTES` | `15` | Minutes | Booking Timeout | Window allowed for customer payment before a `DRAFT` booking transitions to `EXPIRED`. |
| `SETTLEMENT_COOLING_HOURS` | `24` | Hours | Settlement SLA | Dispute submission and cooling window after shift check-out before funds auto-release. |
| `CHECKIN_MAX_RADIUS_METERS` | `200` | Meters | Anti-Fraud GPS | Maximum acceptable Haversine distance between nurse check-in GPS and booking coordinates. |
| `ICU_TRAVEL_SUPPORT` | `50000` | VND | Operational Subsidy | Travel allowance paid to nurse if customer cancels due to emergency ICU transfer after nurse travelled. |
| `NO_SHOW_PENALTY` | `50000` | VND | Penalty & Voucher | Surcharge levied on no-show nurse; converted directly into an apology voucher for the customer. |

---

## Annex B: Cancellation, Timeout & Compensation SLA Matrix

> **Payment Method Applicability:**
> * **Bank Transfer:** Refund percentages are credited back to customer account via gateway.
> * **Cash Bookings:** Customer has not prepaid; hence no refund applies. Nurse penalties are deducted from `deposit_balance`. Customer last-minute cancellation fees on cash bookings are not collected via platform, but recorded in customer profile history.

| # | Cancellation / Timeout Scenario | Trigger Timing | Penalty & Financial Distribution | System Action & State Handling |
|---|---|---|---|---|
| **1** | **Customer cancels early** | $\Delta t > 12\text{ hours}$ before shift start | • 0% penalty.<br>• 100% refund to customer. | Booking transitions to `CANCELLED`. Escrow refunded 100% (`REFUNDED`). Nurse schedule released. |
| **2** | **Customer cancels near-term** | $2\text{ hours} \le \Delta t \le 12\text{ hours}$ before start | • 20% cancellation fee.<br>• 80% refund to customer.<br>• Nurse gets 15% (holding compensation).<br>• Platform retains 5%. | Escrow split: 80% refunded to customer, 15% credited to nurse `available_balance`, 5% to platform commission. |
| **3** | **Customer cancels last-minute** | $\Delta t < 2\text{ hours}$ before start (not checked in) | • 50% cancellation fee.<br>• 50% refund to customer.<br>• Nurse gets 40% (travel & lost shift).<br>• Platform retains 10%. | Escrow split: 50% refunded to customer, 40% credited to nurse `available_balance`, 10% to platform revenue. |
| **4** | **Customer stops shift after check-in** | Booking `IN_PROGRESS`, ended early by customer | • Pro-rated actual hours worked.<br>• No early-termination penalty. | Pay 100% for completed hours (min. 1 hour). Task-based jobs receive 100% price if checklist completed. Remaining unused funds refunded. Does **not** produce `PARTIALLY_SETTLED`. |
| **5** | **Medical Force Majeure cancellation** | Patient admitted to ICU emergency or deceased | • 100% fee waiver.<br>• 100% refund to family.<br>• Nurse receives 50,000 VND subsidy. | Family receives 100% refund upon uploading medical proof. Nurse receives 50,000 VND (`ICU_TRAVEL_SUPPORT`) from operations fund if already in transit. |
| **6** | **Nurse cancels early** | $\Delta t > 12\text{ hours}$ before shift start | • 0 VND financial fine.<br>• **−5 TrustScore** penalty. | Booking returns to `MATCHING` status for immediate re-dispatch. Nurse schedule marked unassigned. |
| **7** | **Nurse cancels late** | $\Delta t \le 12\text{ hours}$ before shift start | • Fine = 20% of shift value.<br>• **−20 TrustScore** penalty. | 20% fine deducted from nurse `deposit_balance` (debt recorded if insufficient). Converted to an "Urgent Bonus" added to shift to attract fast replacement. |
| **8** | **Nurse no-show (no replacement found)** | 30 mins post shift start; nurse absent, dispatch fails | • Nurse permanently **BANNED**.<br>• 50,000 VND fine from deposit.<br>• Customer gets 100% refund + 50k voucher. | Nurse account permanently banned on 1st offense. 50,000 VND (`NO_SHOW_PENALTY`) debited from deposit and issued as a voucher to customer along with 100% refund. |
| **9** | **Payment timeout / Matching expiry** | Customer uncompleted payment after 15m; or unmatched 30m prior to start | • 0% penalty.<br>• 100% refund if paid. | `execution_status` updates to `EXPIRED`. Any collected escrow is automatically refunded 100% (`REFUNDED`) with an apology push notification. |

---

*Note: In the event of any discrepancy between this specification and the governing baseline, the **SRS HealthCareSystem On-Demand Nursing v2.0 (Updated, 28/10/2026)** prevails. Items not detailed in the SRS are cataloged in `docs/business_rule/open-decisions-register.md`.*
