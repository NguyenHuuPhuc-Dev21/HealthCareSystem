# Functional Requirements Specification (FRS)
## HealthCareSystem — On-Demand Healthcare & Nursing Staffing Platform

| Metadata | Details |
|---|---|
| **Specification Baseline** | SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**: marketplace connecting Patients/Families with retired doctors/nurses and newly graduated nursing students. **No hospital tenants.** |
| **Confirmed Tech Stack** | React (Patient Web, Nurse Web Portal, Admin Web Portal), Nurse Mobile App, Node.js + TypeScript, PostgreSQL (16 tables), Private Object Storage (S3/MinIO, presigned URLs), FCM Push + SMS/Zalo ZNS fallback, PayOS / VNPay / VietQR sandbox payment gateway, Google Maps / Goong geocoding |
| **Document Status** | **Revised per SRS v2.0 — supersedes the hospital-baseline version.** All FRs below are taken from the SRS v2.0 functional requirement set (§4) and its state machines, configuration parameters and SLA policy (§2, §5). |
| **Legal References** | Law on Medical Examination and Treatment 15/2023/QH15; Decree 96/2023/ND-CP; Decree 13/2023/ND-CP on Personal Data Protection |

---

### Priority & Phase Conventions (SRS v2.0 §1.2, §4.0)

- **Mandatory (MVP)** — Core requirement of the MVP release (SRS label: *Bắt buộc*); the MVP cannot operate without it.
- **MVP** — Included in the MVP release (Phase 1).
- **Phase 2** — Deferred to the Phase 2 expansion release (long-term contracts, partial settlement adjudication, Elder-Friendly UI for the Patient App).

**MVP scope (Phase 1):** Task-based bookings and short-term shift bookings (4h/8h/12h/24h); Nurse Web Portal **and** Nurse Mobile App; two matching mechanisms (Radar Dispatch and Job Board); two payment methods (prepaid bank transfer held by the platform — Simulated Escrow — or on-site cash with the nurse self-paying the 15% commission); upfront nurse deposit of 300,000 VND used only for SLA penalties; automatic Tier demotion/promotion on GPHN expiry/renewal; dual-verified check-in; clinical shift logs; disputes and two-way ratings.

**Phase 2 scope:** Long-term weekly/monthly contracts (bidding & trial shifts), contract lifecycle management, partial settlement on dispute adjudication, Elder-Friendly UI extended to the Patient App.

---

## 1. System Actors & Product Surfaces (SRS v2.0 §2.1)

| Actor | Surface | Core Responsibilities |
|---|---|---|
| **Patient / Family (Customer)** | Patient Web & Mobile App | Phone + OTP authentication and CCCD eKYC (mandatory for home-care bookings); declare patient profiles and grant health-data processing consent; search nurse profiles, book, pay, accept work, raise disputes and rate. |
| **Nurse Tier 1 (TIER_1_BASIC)** | Nurse Web Portal & Nurse Mobile App | Fresh graduates with a formal degree, or practitioners without a valid GPHN (incl. expired-not-yet-renewed). Non-invasive services only. Register eKYC profile, declare availability, take jobs via Job Board, track income, self-pay the 15% cash-booking commission, withdraw earnings. Radar acceptance, anti-fraud check-in and shift logging are performed on the Mobile App. |
| **Nurse Tier 2 (TIER_2_SPECIALIST)** | Nurse Web Portal & Nurse Mobile App (Elder-Friendly UI) | Doctors/nurses with a valid, in-scope GPHN (including retired practitioners). Upload renewed GPHN on Nurse Web/App to be re-upgraded after Admin approval; verify medical orders on site; may reject a shift without penalty when the medical order is invalid. |
| **Medical Admin / Operator** | Admin Web Portal | Approve eKYC and verify GPHN validity/renewals to assign or change Tiers; manage the service catalog and `system_configs`; adjudicate disputes; reconcile revenue and commissions. Admin sign-in additionally requires mandatory 2FA. |

Authentication for Patient and Nurse accounts is by **phone number + OTP** (`POST /api/v1/auth/request-otp`, `POST /api/v1/auth/verify-otp` — see `docs/api/README.md`).

---

## 2. Booking State Model — Three Independent Axes (SRS v2.0 §2.2)

Every booking carries three orthogonal status axes; no single combined status column is used.

| Axis | Field | Values |
|---|---|---|
| Execution | `execution_status` | `DRAFT` → `MATCHING` → `CONFIRMED` → `IN_PROGRESS` → `COMPLETED`; terminal branches `CANCELLED`, `EXPIRED` |
| Payment | `payment_status` | `UNPAID`, `ESCROW_HELD` (bank-transfer bookings only), `SETTLED`, `REFUNDED`, `PARTIALLY_SETTLED` (Phase 2, dispute adjudication only) |
| Dispute | `dispute_status` | `NONE`, `OPEN`, `UNDER_REVIEW`, `RESOLVED_CUSTOMER`, `RESOLVED_NURSE`, `RESOLVED_PARTIAL` (Phase 2) |

Key rules: a `DRAFT` booking is held for 15 minutes pending payment, then `EXPIRED`; a booking that cannot be matched before its start time also becomes `EXPIRED` with a 100% refund if prepaid. Cash bookings never pass through `ESCROW_HELD`: after check-out they remain `UNPAID` until the nurse's 15% commission payment is confirmed by webhook, then become `SETTLED`.

`nurse_profiles.profile_status` (`PENDING_VERIFICATION | ACTIVE | SUSPENDED | BANNED`) is the **single source of truth** for a nurse's eligibility to take jobs (SRS v2.0 §7).

---

## FR-AUTH — Authentication, eKYC & Profile Management

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-AUTH-01** | **Nurse eKYC registration & GPHN profile update.** Via Nurse Web Portal or Nurse Mobile App, the nurse submits phone number (OTP), both sides of CCCD, a live portrait photo, medical/nursing degree, GPHN (if any — with GPHN number, issue date, `gphn_expiry_date`, issuing authority, scope of practice) and retirement decision (supporting document only). New registrations are stored as `PENDING_VERIFICATION`; a renewed GPHN uploaded by an active nurse is stored as a `PENDING` credential until Admin review. No job-taking or Tier upgrade is enabled before Admin approval. | SRS §4.1 | Mandatory (MVP) |
| **FR-AUTH-02** | **GPHN verification & automatic Tier demotion/promotion.** Admin reviews credentials on the Admin Portal (`reviewed_by` references the Admin's `users.id`); a daily cron job checks GPHN expiry. (1) Valid degree but no GPHN → `TIER_1_BASIC` (only services with `is_invasive = false`). (2) Valid, in-scope GPHN → `TIER_2_SPECIALIST`. (3) A retirement decision only grants the "experienced retired specialist" badge — it never substitutes for a GPHN to unlock invasive services. (4) When a GPHN expires before renewal, the system automatically demotes the nurse from `TIER_2_SPECIALIST` to `TIER_1_BASIC` (profile stays `ACTIVE` for basic work); already-`CONFIRMED` invasive bookings scheduled after the expiry date are auto-cancelled without penalty and re-dispatched. As soon as the nurse uploads a new GPHN on Nurse Web/App and an Admin approves it, the system automatically re-upgrades the nurse to `TIER_2_SPECIALIST`. | SRS §4.1, §2.3 | Mandatory (MVP) |
| **FR-AUTH-03** | **Patient profile management & customer eKYC.** The customer declares patient information (full name, year of birth, weight, mobility status, medical history, infectious diseases, address coordinates) and uploads both sides of the account holder's CCCD plus a selfie. If the care location is a hospital, phone authentication is sufficient; if the location is a private home (home-care), the customer account must complete CCCD eKYC before a booking can be created. | SRS §4.1 | Mandatory (MVP) |
| **FR-PRIV-01** | **Health-data consent under Decree 13/2023/ND-CP.** The patient (or legal guardian) must tick the sensitive-personal-data processing consent; the system records `consent_timestamp` and IP/Device ID. Access rule: only the nurse in `CONFIRMED`/`IN_PROGRESS` state **of that exact booking** may view the patient record and medical-order images; the nurse's record access is **automatically closed 12 hours after check-out** (during the 24-hour dispute window, evidence is taken from system logs; an Admin may re-grant time-boxed access with an audit-log entry when handling a dispute). Medical records are retained for a maximum of 24 months for lookup/legal purposes; a "request deletion / anonymisation of personal data" function is provided per Decree 13/2023/ND-CP. | SRS §4.1 | Mandatory (MVP) |

---

## Service Catalog, Availability & Nurse Search

### Service catalog — three groups (SRS v2.0 §4.2)

| Group | `is_invasive` & Required Tier | Services |
|---|---|---|
| **Group 1 — Basic Care & Daily-Living Support (Non-Invasive)** | `is_invasive = false`; TIER_1_BASIC and TIER_2_SPECIALIST | Bedside/attendant care by shift (4h, 8h, 12h, 24h) at hospital or home; personal hygiene, bed bathing, diaper change, pressure-ulcer repositioning; oral feeding assistance, medication reminders per existing prescription; non-invasive vital-signs monitoring (electronic BP, temperature, SpO2, pulse); basic mobility support, walking assistance, companionship for the elderly. |
| **Group 2 — Conditional Invasive Nursing Procedures (per Medical Order)** | `is_invasive = true`; TIER_2_SPECIALIST with valid GPHN only + doctor's medical order mandatory | Subcutaneous/intramuscular injections (insulin, supplements, maintenance medication already prescribed and safely administered for the first dose at a medical facility); maintenance IV infusion (saline, Ringer Lactate, Glucose) strictly per medical order; dressing change, complex open-wound/post-surgical wound care, suture removal; care/cleaning/replacement of urinary catheter, feeding via pre-placed gastric tube; upper-airway suctioning with a personal suction device. |
| **Group 3 — Strictly Prohibited on the Platform** | Blocked at booking creation | Blood/plasma/blood-product transfusion at home; IV administration of antibiotics, contrast agents, chemotherapy chemicals or other high anaphylaxis-risk drugs not yet administered at a hospital; any minor surgery, abscess incision, emergency wound suturing, spinal anaesthesia/general anaesthesia at home; issuing new prescriptions or altering a doctor's treatment regimen. |

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-SCHED-01** | **Nurse availability & time-off management.** On Nurse Web or Mobile App the nurse configures recurring weekly availability windows and registers exceptional time-off blocks, stored in `nurse_availabilities`. The system cross-checks this table together with `CONFIRMED`/`IN_PROGRESS` bookings (adding a 60-minute travel buffer between two shifts) to determine true availability. This is a mandatory input to the Matching Engine and to customer search filters. | SRS §4.2 | Mandatory (MVP) |
| **FR-SEARCH-01** | **Nurse search & profile viewing before booking.** The customer filters by service type, geography, required time window, tier (Tier 1 / Tier 2) and nurse gender. The system returns nurses who are `ACTIVE`, available in the requested window and of sufficient tier, displayed as profile cards (full name, avatar, tier, years of experience, retired doctor/nurse badge, `rating_avg` and reviews from previous shifts) so the customer can pick a nurse or send a direct booking request. | SRS §4.2 | MVP |

---

## FR-BOOK — Booking, Medical-Order Control & Matching

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-BOOK-01** | **Task-based / shift-based booking & parameterised pricing.** Input: patient profile, service, start/end time, location, medical-order image (if `is_invasive = true`). Price is computed exclusively from `system_configs`: **Total = Base Price + Night surcharge (+20% applied only to the hours falling inside 22:00–06:00) + Holiday surcharge (+300% of base for Tết Nguyên đán, +200% of base for other public holidays) + Heavy-patient surcharge (+15% when weight ≥ 80 kg or bedridden)**. Surcharges are additive on the base price, never compounded. Worked example from the SRS: shift 20:00–06:00 on a normal day at 50,000 VND/hour → base 500,000 VND; night hours 22:00–06:00 = 8 hours → night surcharge 80,000 VND; total 580,000 VND. Output: booking created with `execution_status = DRAFT`, `payment_status = UNPAID`, held 15 minutes for payment. The booking records `payment_method (BANK_TRANSFER \| CASH)` at creation (see FR-PAY-01). | SRS §4.3, §5.1 | Mandatory (MVP) |
| **FR-BOOK-02** | **Two-layer medical-order control.** Layer 1 (at booking creation): for `is_invasive = true` services, uploading a medical-order/prescription image is mandatory (patient name, drug name/dosage, doctor's signature/stamp, prescription date ≤ 7 days) together with the order issue date. Layer 2 (before accepting): the Tier 2 nurse reviews the attached order image in the app before tapping "Accept". Layer 3 (on site, at check-in): the nurse compares the original paper order and the actual medication; if the order is forged, expired, altered or the medication does not match, the nurse taps "Reject shift — invalid medical order" with photo evidence → the booking is cancelled immediately, the nurse is **not penalised** and receives travel-cost compensation. | SRS §4.3 | Mandatory (MVP) |
| **FR-BOOK-03** | **Two separate matching mechanisms.** *Mechanism A — Radar Dispatch:* for task-based or urgent bookings (starting within ≤ 6 hours). Round 1 (minutes 0–5): notify tier-eligible, available nurses within a 5 km radius. Round 2 (minutes 5–15): if unclaimed, expand the radius to 10 km. A Redis lock / `SELECT FOR UPDATE` assigns the booking to the first nurse who accepts. *Mechanism B — Job Board:* for bookings made > 6 hours ahead; the job is posted on the "Job Board" tab of eligible nurses; a customer may also direct a request to one nurse chosen via FR-SEARCH-01 (that nurse has 15 minutes to respond before the job is broadcast). *Eligibility gate for both mechanisms:* the nurse must have `deposit_balance ≥ 300,000 VND` (upfront deposit topped up). *Timeout:* if no nurse has accepted 30 minutes before shift start (or after 30 minutes for urgent bookings), the booking becomes `EXPIRED` and any prepaid amount is refunded 100% (`payment_status = REFUNDED`). | SRS §4.3 | MVP |
| **FR-BOOK-04** | **Long-term contract bidding & trial shift.** For weekly–monthly engagements: the customer posts a requirement → nurses apply → the customer books one trial shift (4h/8h) before approving the main contract. | SRS §4.3 | Phase 2 |
| **FR-BOOK-05** | **Long-term contract lifecycle management.** Pause contract (e.g. patient temporarily hospitalised for emergency care); mid-contract nurse replacement (settle completed shifts for the outgoing nurse, dispatch a replacement for the remainder); early termination (recompute shifts actually performed and refund the unused balance of the current payment period per SLA). | SRS §4.3 | Phase 2 |

---

## FR-SHIFT — Shift Execution, Anti-Fraud & Emergency Protocol

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-SHIFT-01** | **Dual-verified check-in with GPS/selfie anti-fraud.** Input: device GPS coordinates + live face photo at the appointment location. Process: (1) reject immediately if the OS reports the mock-location flag (`isFromMockProvider` / `isSimulatedBySoftware`); (2) Haversine distance to the booking coordinates must be ≤ 200 m (`CHECKIN_MAX_RADIUS_METERS`); (3) selfie must be captured via the in-app camera (gallery upload blocked), with basic liveness action or a server timestamp + GPS watermark, and is sent to the customer for visual confirmation. Output: `execution_status` → `IN_PROGRESS`. | SRS §4.4 | MVP |
| **FR-SHIFT-02** | **Real-time clinical shift log & start-of-shift discrepancy report.** Within the first 30 minutes after check-in the nurse confirms the patient's condition; if the customer mis-declared bedridden/infectious status, the nurse may request a surcharge update or reject the shift without penalty. Throughout the shift the nurse records vital signs (pulse, temperature, blood pressure, SpO2) and care activities into `shift_logs`, synchronised via WebSocket. | SRS §4.4 | Mandatory (MVP) |
| **FR-SHIFT-03** | **Shift extension (overtime).** Up to 30 minutes before shift end, the customer may extend in 1-hour multiples. If the nurse has no conflicting next shift and agrees, the customer pays the extension fee additionally into escrow (bank-transfer flow). API: `POST /api/v1/bookings/:id/extend`. | SRS §4.4 | MVP |
| **FR-SHIFT-04** | **Check-out & shift report submission.** Input: actual end time confirmed by the nurse plus a minimum completed care log (end-of-shift vital signs, list of tasks performed, handover notes). Process: the system records `checkout_time`, moves `execution_status` → `COMPLETED`, and starts both the 24-hour dispute window and the 12-hour medical-record access closure timer (FR-PRIV-01). For task-based services, completing all task items earns the full service price even if the shift ends earlier than scheduled. Output: booking proceeds to settlement per FR-PAY-02; two-way rating opens (FR-RATE-01). API: `POST /api/v1/bookings/:id/check-out`. | SRS §4.4 | Mandatory (MVP) |
| **FR-SHIFT-05** | **Medical emergency (SOS) protocol.** When the patient shows critical signs (apnoea, cyanosis, anaphylaxis, stroke) during a shift: Step 1 (on site — absolute priority): the nurse/person present calls emergency **115** immediately and performs basic first aid within their professional scope; the app's SOS screen opens the 115 dialler at once. Step 2 (system support): the app simultaneously sends an emergency alert (Push + SMS fallback) with GPS coordinates and the patient's latest vital signs to the Family and the Admin Portal for coordination. The system only logs and notifies — it never replaces the 115 emergency call. | SRS §4.4 | Mandatory (MVP) |

---

## FR-PAY — Payments, Simulated Escrow Wallet, Upfront Deposit & Withdrawals

Payment model summary (SRS §4.5, §2.3): every booking declares `payment_method` at creation. **BANK_TRANSFER** — the customer prepays 100% through the sandbox gateway (PayOS / VNPay / VietQR); the webhook (HMAC-SHA256 verified, idempotency-key deduplicated) locks the money in the internal ledger as `ESCROW_HELD`. **CASH** — the customer pays the nurse 100% in cash at the end of the shift; the platform holds nothing; any amount the customer gives beyond the in-app price is a tip and is not commissioned; the nurse then self-pays the 15% commission to the platform (FR-PAY-02). The deposit wallet is **never** used to deduct the cash-booking commission.

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-PAY-01** | **Two payment methods: prepaid transfer held by the platform & on-site cash.** Method 1 — Bank transfer (prepaid, platform-held): customer pays 100% of the booking price via the sandbox gateway before the shift; the digitally signed webhook records the funds into the booking's escrow ledger (`ESCROW_HELD`); on shift completion and expiry of the dispute window, settlement follows FR-PAY-02. Method 2 — Cash (paid on site): customer pays 100% cash directly to the nurse at shift end; the system records shift revenue at the in-app displayed price; tips above the in-app price are not commissioned; after shift end the nurse self-transfers the 15% commission to the system (FR-PAY-02) — the commission is never deducted from the deposit wallet. Every booking must record `payment_method (BANK_TRANSFER \| CASH)` from the creation step. | SRS §4.5 | Mandatory (MVP) |
| **FR-PAY-02** | **Automatic 24-hour settlement & nurse self-payment of the 15% commission.** Standard acceptance deadline: exactly 24 hours (`SETTLEMENT_COOLING_HOURS = 24`) from `checkout_time`. *Bank-transfer bookings:* if the customer taps "Confirm completion" early, OR after 24 hours with `dispute_status = NONE`, a worker automatically deducts the 15% platform commission (`PLATFORM_COMMISSION_RATE = 0.15`) and credits the remaining 85% of the remuneration to the nurse's `available_balance` (`payment_status` → `SETTLED`). *Cash bookings:* immediately at check-out (`COMPLETED`) the system computes the 15% commission on the in-app booking price and generates a VietQR code / Payment Link on Nurse Web & Mobile App (`POST /api/v1/bookings/:id/commission-payment-link`); the nurse self-transfers the 15% commission to the system within 24 hours (never deducted from `deposit_balance` or `available_balance`); when the gateway webhook confirms receipt of the full 15%, the booking becomes `SETTLED`. If the commission is still unpaid after 24 hours, the nurse is suspended from taking new jobs (`SUSPENDED`) until it is paid in full. | SRS §4.5 | Mandatory (MVP) |
| **FR-PAY-03** | **Nurse deposit wallet — used only for SLA penalties.** Mandatory upfront deposit: the nurse must top up the full deposit norm of 300,000 VND (`MIN_NURSE_DEPOSIT`) into `deposit_balance` **before** being allowed to take jobs. No progressive deduction from income applies, and job value is not capped by the deposit balance. Sole permitted use: `deposit_balance` is debited only for SLA violation penalties (late cancellation, no-show, procedure violations upheld on dispute — transaction type `PENALTY_DEDUCT`); if the balance is insufficient, the shortfall is recorded as debt and offset against later income. The system never uses `deposit_balance` to collect the 15% cash-booking commission. When penalties bring `deposit_balance` below 300,000 VND, the nurse is suspended from new jobs until topped back up. The deposit may be withdrawn in full only when the nurse ends the cooperation and closes the account after 7 days with no open dispute (SRS §2.3). | SRS §4.5, §2.3 | MVP |
| **FR-PAY-04** | **Income management & bank withdrawal.** On Nurse Web or Mobile App the nurse views weekly/monthly income charts and balance-change history, and creates a withdrawal request (amount ≤ `available_balance`, beneficiary bank account details). Process: ACID transaction + row lock, debit `available_balance`, create a `WITHDRAW_REQUESTED` record for Admin or payout-gateway approval and transfer (`WITHDRAWN` on completion). API: `POST /api/v1/wallets/withdraw`. | SRS §4.5 | MVP |

**Wallet lifecycle (SRS §2.3):** `TOPUP / PAYMENT → ESCROW_LOCKED → AVAILABLE_BALANCE → WITHDRAW_REQUESTED → WITHDRAWN`. `ESCROW_LOCKED` is recorded as soon as the gateway webhook succeeds (bank-transfer bookings only). All balance movements are written to the append-only `wallet_transactions` ledger with a UNIQUE `idempotency_key`; the cash-commission self-payment is recorded as transaction type `COMMISSION_PAYMENT`, strictly separate from `PENALTY_DEDUCT`.

**Nurse profile lifecycle (SRS §2.3):** `PENDING_VERIFICATION → ACTIVE ⇄ SUSPENDED → BANNED`. `SUSPENDED` is triggered automatically when TrustScore < 60, when `deposit_balance < 300,000 VND` after a penalty, or when a cash booking's 15% commission is unpaid more than 24 hours after check-out; it is lifted when the nurse tops up the deposit / pays the outstanding commission in full / completes retraining with Admin review. `BANNED` applies on no-show, forged degrees/GPHN, or serious professional-ethics violations.

---

## FR-DISP / FR-RATE / FR-NOTIF / FR-CHAT — Disputes, Ratings, Notifications & Communication

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-DISP-01** | **Shift dispute workflow.** Both the customer and the nurse may open a dispute from `IN_PROGRESS` until 24 hours after check-out, selecting a reason (left early, care-procedure violation, poor attitude, customer mis-declared patient condition, …) with a detailed description and up to 5 evidence photos/videos. Process: `dispute_status` → `OPEN` and the escrowed funds are frozen immediately (the automatic settlement job is stopped); Admin takes the case (`UNDER_REVIEW`) and cross-checks GPS logs, check-in/out times, the clinical shift log and in-app chat history. Outcomes: `RESOLVED_CUSTOMER` → 100% refund to the customer (`REFUNDED`), TrustScore deduction and deposit penalty for the nurse; `RESOLVED_NURSE` → 100% of remuneration released to the nurse (`SETTLED`). For cash bookings (no held funds): if the nurse is at fault (`RESOLVED_CUSTOMER`), the penalty/compensation to the customer is deducted from the nurse's deposit wallet (`deposit_balance`). | SRS §4.6 | Mandatory (MVP) |
| **FR-DISP-02** | **Partial settlement adjudication.** Where both parties share responsibility (or a shift was half-performed before an objective incident), the Admin enters a split ratio (e.g. refund 40% to the customer, release 60% to the nurse) → `payment_status` → `PARTIALLY_SETTLED`. This is the **only** origin of `PARTIALLY_SETTLED`; it never arises from ordinary early shift endings (see SLA row 4, Annex B). | SRS §4.6, §2.2 | Phase 2 |
| **FR-RATE-01** | **Two-way rating & TrustScore.** Immediately after the shift ends (`execution_status = COMPLETED`, without waiting for money settlement), the customer rates the nurse (1–5 stars + comment) and the nurse rates the customer's cooperation (1–5 stars + note). Ratings from both sides stay hidden until both sides have submitted or 7 days have passed since shift end (`reviews.is_visible`), to prevent retaliatory ratings. TrustScore (0–100, default 100): −5 for cancelling a shift > 12h ahead, −20 for cancelling ≤ 12h ahead, −25 for a violation upheld on dispute; recovery +2 for each completed shift (`SETTLED`) rated ≥ 4 stars, capped at 100. TrustScore < 60 → profile automatically `SUSPENDED`. API: `POST /api/v1/bookings/:id/reviews`. | SRS §4.6 | MVP |
| **FR-NOTIF-01** | **Multi-channel notifications & SMS fallback.** Primary channels: Push Notification (Firebase Cloud Messaging) + In-app Notification Center + WebSocket real-time. SMS fallback (SMS / Zalo ZNS to the registered phone number) applies automatically to urgent events — SOS alerts, last-minute shift cancellations needing urgent re-dispatch, and new-job alerts for older nurses who are offline or whose device has not acknowledged a Push within 60 seconds. | SRS §4.6 | MVP |
| **FR-CHAT-01** | **In-app chat & calling with masked phone numbers.** The only contact channel between customer and nurse is in-app chat/calling, opened once the booking is `CONFIRMED`; both parties' real phone numbers are fully masked. The system scans message content: when a phone number or external contact link is detected, it shows a violation warning to the sender and writes a log. The full chat history and call logs (`conversations_messages`) are retained as evidence for dispute handling. | SRS §4.6, §3 (RISK-06) | MVP |

---

## FR-ADMIN — Platform Administration

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-ADMIN-01** | **Service catalog, configuration & reconciliation reporting.** Catalog & config management: Admin adds/edits/hides services (including toggling `is_invasive`) and updates `system_configs` parameters without code changes. User management: search, view details, lock/unlock (`ACTIVE` / `SUSPENDED` / `BANNED`) customer and nurse accounts. Financial reporting & reconciliation: export reports of total escrow receipts, total platform commission (15%), total amounts released, total refunds, and the list of pending withdrawal requests. Credential review and dispute adjudication are covered by FR-AUTH-02 and FR-DISP-01. | SRS §4.6 | MVP |

---

## Annex A — System Configuration Parameters (SRS v2.0 §5.1)

All monetary and timing constants live in the `system_configs` table; nothing is hard-coded in source code.

| Config Key | Value | Unit | Business Rule |
|---|---|---|---|
| `PLATFORM_COMMISSION_RATE` | 0.15 | Ratio (15%) | Platform commission. Bank transfer: deduct 15%, release 85% to the nurse. Cash: nurse self-transfers 15% to the system. |
| `MIN_NURSE_DEPOSIT` | 300000 | VND | Nurse deposit norm; used **only** for SLA penalty deductions, never for commission. |
| `SURCHARGE_NIGHT_SHIFT` | 0.20 | Ratio (+20%) | Night surcharge for working hours inside 22:00–06:00. |
| `SURCHARGE_HOLIDAY_MAJOR` | 3.00 | Ratio (+300%) | Tết Nguyên đán: surcharge = 300% × booking base price (e.g. base 500,000 VND → surcharge 1,500,000 VND, total 2,000,000 VND). |
| `SURCHARGE_HOLIDAY_MINOR` | 2.00 | Ratio (+200%) | Other statutory public holidays: surcharge = 200% × booking base price. |
| `SURCHARGE_HEAVY_PATIENT` | 0.15 | Ratio (+15%) | Special-care surcharge when `weight_kg >= 80` OR `mobility_status = BEDRIDDEN`. |
| `PAYMENT_TIMEOUT_MINUTES` | 15 | Minutes | Booking hold pending payment; on timeout the booking becomes `EXPIRED`. |
| `SETTLEMENT_COOLING_HOURS` | 24 | Hours | Acceptance/dispute window after check-out before automatic release. |
| `CHECKIN_MAX_RADIUS_METERS` | 200 | Metres | Maximum GPS distance allowed for check-in at the appointment location. |
| `ICU_TRAVEL_SUPPORT` | 50000 | VND | Fixed travel support for the nurse when a shift is cancelled because the patient is transferred to emergency/ICU and the nurse has already travelled. |
| `NO_SHOW_PENALTY` | 50000 | VND | Fine for a no-show nurse when no replacement is found; the full amount becomes a voucher for the customer. |

## Annex B — Cancellation, Timeout & Compensation SLA Matrix (SRS v2.0 §5.2)

*Applicability by payment method: the refund percentages below apply to bank-transfer bookings (the customer has prepaid into the system). For cash bookings the customer has not paid, so no refund arises; nurse SLA penalties are still deducted from the deposit wallet as specified (the deposit wallet is used only for penalties, never for the 15% commission); customer cancellation fees on cash bookings are not collected through the system — the booking is released and recorded in the customer's cancellation history.*

| # | Scenario | Trigger | Penalty / Refund | System Handling |
|---|---|---|---|---|
| 1 | Customer cancels early | Δt > 12h before shift start | 0% penalty / 100% refund | Refund 100% to customer (`REFUNDED`); release the nurse's schedule. |
| 2 | Customer cancels near-term | 2h ≤ Δt ≤ 12h before start | 20% penalty / 80% refund | Refund 80%; credit 15% to the nurse's income wallet (schedule-holding compensation); platform keeps 5%. |
| 3 | Customer cancels last-minute | Δt < 2h before start (not yet checked in) | 50% penalty / 50% refund | Refund 50%; credit 40% to the nurse's wallet (travel & lost-shift compensation); platform keeps 10%. |
| 4 | Customer stops the shift AFTER check-in | Booking `IN_PROGRESS`, customer ends early (not the nurse's fault) | Pay actual hours worked / no penalty | Pay 100% for hours actually served (minimum 1 hour); for task-based services, full service price when all task items are completed even if finished early. Refund 100% of the unused time portion (bank-transfer bookings only). Early ending is **not** treated as a cancellation and never produces `PARTIALLY_SETTLED`. |
| 5 | Customer cancels for medical force majeure | Patient transferred to ICU emergency or deceased (with confirmation documents) | 100% penalty waiver / 100% refund | Refund 100% of the unused amount to the family; fixed 50,000 VND travel support (`ICU_TRAVEL_SUPPORT`) paid from the operations fund if the nurse has travelled. |
| 6 | Nurse cancels early | Δt > 12h before shift start | 0 VND / −5 TrustScore | No deposit deduction; −5 TrustScore; booking returns to `MATCHING` to find a replacement. |
| 7 | Nurse cancels late | Δt ≤ 12h before shift start | 20% of shift value / −20 TrustScore | Deduct 20% of the shift value from the deposit wallet (negative balance recorded as debt if insufficient); the full penalty becomes an "Urgent Bonus" added to the booking and pushed into SOS Dispatch to find a replacement. |
| 8 | Nurse no-show & no replacement found | 30 minutes past shift start with no nurse arrival AND SOS Dispatch finds no replacement | Nurse account **BANNED** / 100% refund (transfer bookings) + 50,000 VND voucher for the customer | Nurse permanently banned from the first no-show. Fine of 50,000 VND (`NO_SHOW_PENALTY`) deducted from the deposit wallet (debt recorded if insufficient); the full fine becomes a 50,000 VND apology voucher for the customer. Customer is refunded 100% of the booking amount (`REFUNDED` — bank-transfer bookings only) plus the voucher. |
| 9 | Payment timeout / matching expiry | Customer has not paid after 15 minutes; OR no nurse has accepted by 30 minutes before shift start | No penalty / 100% refund if paid | `execution_status` → `EXPIRED`; if funds were collected (`ESCROW_HELD`), automatically refund 100% (`REFUNDED`) and send an apology notification to the customer. |

---

*Note: In the event of any discrepancy between this specification and the governing baseline, the **SRS HealthCareSystem On-Demand Nursing v2.0 (Updated, 28/10/2026)** prevails. Points the SRS does not specify are recorded in `docs/business_rule/open-decisions-register.md` and must not be implemented with invented defaults.*
