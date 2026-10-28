# Test Strategy Specification

> **Document Scope:** Full testing strategy for the HealthCareSystem On-Demand Nursing Marketplace — MVP milestone (SRS v2.0 §1.2, §4.0) and the Phase-2 expansion.
> **Governing Baseline:** *SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)* — status in the SRS: **APPROVED FOR DEVELOPMENT**. The SRS defines a marketplace connecting patients/families with retired medical staff and newly graduated nursing students. There are **no hospital tenants** in this model.
> **Authoritative Specification Hierarchy (in order of precedence in case of conflict):**
> 1. **SRS v2.0 (Updated, 28/10/2026)** — Functional Requirements (§4), SLA & configuration parameters (§5), database schema (§7), API list (§8), external integrations (§9), and the RTM with acceptance criteria (§10: CT-01–CT-27 → TC-xxx)
> 2. `docs/requirement/` — as revised per SRS v2.0
> 3. `docs/business_rule/` — as revised per SRS v2.0
> 4. `docs/user_stories/` — as revised per SRS v2.0
> 5. `docs/security/` — as revised per SRS v2.0
>
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version. Points the SRS leaves open, and places where SRS sections diverge from each other, are listed in Section 11 and are tested at mechanism level or tagged `OPEN` — never asserted with invented values.
> **Original Vietnamese Baseline:** Preserved in [`archive/test-strategy.vi.md`](archive/test-strategy.vi.md)

---

## 1. Objectives

1. **End-to-End Traceability by Code Identifier:** Every row of the SRS §10 RTM (CT-01–CT-27) maps to its FR/NFR codes, its TC-xxx test cases, concrete acceptance criteria, and at least one test tier in this strategy (Section 5). No "orphan" tests; no unvalidated acceptance criteria.
2. **Defect Interception at the Lowest-Cost Tier:** Prevent defects at the earliest and cheapest layer possible: schema invariants at the database tier, calculation rules at the unit tier, authorization and state rules at the API tier, time-based rules in job tests with a fake clock, and full user workflows at the E2E/UAT tier.
3. **Rigorous Defense of the Three High-Risk Domains:** Automated tests must block pull request merges unless green across the system's three highest-risk surfaces:
   - **Money Integrity:** Simulated-escrow ledger, 85/15 settlement, cash-order commission self-payment, deposit penalties, webhook idempotency (FR-PAY-01–FR-PAY-04, SRS §5, §9).
   - **Clinical & Legal Safety:** Backend hard-gating of invasive services by nurse tier (HTTP 403), prohibited-service blocking, two-layer prescription verification, emergency SOS protocol (FR-AUTH-02, FR-BOOK-02, FR-SHIFT-01, FR-SHIFT-05, service catalog §4.2).
   - **Identity, Access Control & Privacy:** Phone + OTP authentication, Admin 2FA, health-data consent under Decree 13/2023/ND-CP, and the medical-record access window that closes 12 hours after check-out (FR-AUTH-01–03, FR-PRIV-01).
4. **Transparent Handling of Open Items:** Every point the SRS leaves unspecified or internally divergent (Section 11) carries an explicit testing status — mechanism-level tests or an `OPEN` tag — never hardcoded expectations for unapproved values.

---

## 2. Testing Scope

### 2.1 In MVP Scope (SRS §1.2, §4.0)

- **Booking types:** Task-based single procedures and short-term shifts (4h / 8h / 12h / 24h), priced from `system_configs` (FR-BOOK-01).
- **Clients:** Patient Web (& mobile app surface), **Nurse Web Portal and Nurse Mobile App** (both are MVP scope in v2.0), Admin Web Portal.
- **Two matching mechanisms:** Radar Dispatch for urgent bookings and Job Board broadcast / direct invite for advance bookings (FR-BOOK-03).
- **Two payment methods:** `BANK_TRANSFER` (100% prepaid, held in the simulated-escrow ledger) and `CASH` (paid on site; the nurse self-pays the 15% commission via payment link) (FR-PAY-01, FR-PAY-02).
- **Upfront nurse deposit:** 300,000 VND, used **only** for SLA penalties (FR-PAY-03).
- **Execution & safety:** Dual-verification check-in (GPS + live selfie, anti-mock), shift logs, shift extension, check-out with mandatory minimal care report, SOS emergency protocol (FR-SHIFT-01–FR-SHIFT-05).
- **Post-shift:** Disputes within 24h of check-out, two-sided blind ratings and TrustScore, multi-channel notifications with SMS fallback, in-app masked chat/calls, Admin catalog/config/reconciliation (FR-DISP-01, FR-RATE-01, FR-NOTIF-01, FR-CHAT-01, FR-ADMIN-01).
- **Negative scope (explicitly tested):** Prohibited services (catalog Group 3) can never be booked; Tier-1 nurses can never accept invasive services on any path.
- **All NFRs of SRS §6** and all acceptance criteria of the SRS §10 RTM, except the rows the RTM itself assigns to Phase 2 or to document review (Section 5).

### 2.2 Out of Scope / Deferred Items

| Item | SRS Source | Testing Status | Rationale |
|---|---|---|---|
| **Long-term contract bidding & trial shifts** | FR-BOOK-04 | **Phase 2** — No functional tests in the MVP cycle; a negative test asserts contract bidding is not reachable in the MVP build. | RTM row CT-16 is assigned to Phase 2 by the SRS itself. |
| **Long-term contract lifecycle** (pause, mid-contract replacement, early termination) | FR-BOOK-05 | **Phase 2** — Deferred with FR-BOOK-04. | SRS §1.2, §4.0 phasing. |
| **Partial-settlement dispute adjudication** (`PARTIALLY_SETTLED`, `RESOLVED_PARTIAL`) | FR-DISP-02; §2.2 | **Phase 2** — The enum values exist in the MVP schema; MVP tests assert they are **unreachable** through MVP dispute flows. Full split-ratio tests are written in Phase 2. | SRS assigns adjudicated partial settlement to Phase 2 (CT-09). |
| **Recurring / subscription care packages** | Not in SRS v2.0 MVP scope | **Excluded** — No tests; revisit only when specified. | Not part of the approved MVP scope (§1.2, §4.0). |
| **Elder-Friendly UI for the Patient App** | NFR-UI-01 | **Phase 2** — MVP accessibility gates apply to the Nurse Web Portal and Nurse Mobile App only. | NFR-UI-01 phases the Patient App standard to Phase 2 (CT-24). |
| **Deep AI eKYC liveness** | NFR-SEC-01 | **Deferred** — MVP tests cover Live Camera capture + server timestamp/GPS watermark; specialist AI liveness is a commercial-phase upgrade. | NFR-SEC-01 explicitly accepts the MVP mechanism. |
| **Live (licensed-intermediary) escrow operation** | §1.3 *Simulated Escrow Wallet* | **Out of MVP scope** — All money tests run against the internal ledger + sandbox gateways (PayOS / VNPay / VietQR). | The SRS defines MVP escrow as simulated; commercial operation must delegate fund-holding to a State-Bank-licensed payment intermediary. |

### 2.3 Guiding Principles for Open Items

- **Configuration-Driven Expectations:** Where the SRS fixes values in `system_configs` (§5.1), tests seed those exact values and read expectations from the seeded configuration where practical. The config-change acceptance test (TC-PRICE-01) proves that new bookings apply changed values with no restart/redeploy, and that already-created bookings keep their stored amounts.
- **SRS-Internal Divergences:** Where two SRS locations state different rules (Section 11), tests follow the detailed normative section (the FR text or the §5.2 SLA matrix) and the divergent RTM/§8 line is tagged `OPEN` until the SRS text is reconciled. The divergence is never resolved silently in test code.

---

## 3. Core Testing Principles

1. **Traceability by Code Identifier:** Test files and test cases incorporate SRS codes (e.g., `pricing-engine.test.ts` with case titles carrying `TC-PRICE-01`, `FR-BOOK-01`, `CT-05`). Every pull request enumerates the covered CT/TC/FR codes, matching the repository PR template.
2. **Governing Baseline Prevails:** If a test fails because the specification changed, the test is updated to align with SRS v2.0 — never modify a test to validate incorrect code behavior.
3. **Strict Synthetic Test Data:** Production patient or nurse data is strictly forbidden across all development, testing, and staging environments (Decree 13/2023/ND-CP; SRS §6 NFR-SEC-01 principles). Canonical fixtures are derived from the SRS's own worked examples (Section 7).
4. **Isolation & Repeatability:** Every test constructs its own minimal prerequisite data; no order-of-execution dependencies. Database tests execute sequentially against a dedicated test database, truncated between runs.
5. **Time as an Explicit Test Variable:** All temporal business logic (15-minute payment timeout, settlement at check-out +24h, record-access closure at +12h, 24-hour dispute and commission windows, 7-day rating visibility, 60-second push-acknowledgement fallback) is verified with a deterministic fake clock at ±1-minute boundaries — never with real-time sleeps.
6. **Negative & Adversarial Testing:** Every Must FR carries negative cases mirroring the RTM acceptance criteria: HTTP 403 tier-gate and deposit-gate rejections, HTTP 400 for a missing prescription image, HTTP 401 for a forged webhook signature, mock-GPS check-in blocked, over-balance withdrawal rejected.
7. **Shift-Left Security:** Tests are committed alongside feature implementation in the same PR. Pull requests modifying authentication/OTP, authorization, the tier gate, payments/wallets, or medical-record access must pass the security review gate (Tier 7).

---

## 4. Test Tiers & Execution Layers

```
                      ▲
                     / \
                    /   \     Tier 9: UAT & Operational Readiness
                   /-----\
                  /       \    Tier 8: Non-Functional Verification (SRS §6)
                 /---------\
                /           \   Tier 7: Security Testing (Tier Gate, IDOR, Fraud)
               /-------------\
              /               \  Tier 6: End-to-End Golden Journeys (Both Payment Methods)
             /-----------------\
            /                   \ Tier 5: Background Jobs & Timers (Fake Clock)
           /---------------------\
          /                       \ Tier 4: External Integrations & Contracts (Gateways, FCM, Maps)
         /-------------------------\
        /                           \ Tier 3: API Integration & Authorization
       /-----------------------------\
      /                               \ Tier 2: Business Logic Unit Tests (Pricing, Money, TrustScore)
     /---------------------------------\
    /                                   \ Tier 1: Database Constraint Verification (16 Tables)
   /=====================================\
```

### Tier 1 — Database Constraint Verification (`db/tests/`)

- **Objective:** Prove that non-negotiable invariants are enforced at the PostgreSQL schema layer (SRS §7, 16 tables) — the lowest-cost, most robust defense tier.
- **Schema census (TC-DB-01):** Exactly the 16 SRS tables exist; every foreign key declared in §7 resolves, including `nurse_credentials.reviewed_by → users.id` (the reviewing Admin).
- **Scope — each constraint class requires a positive test and a violation test:**

| Constraint Category | Representative Constraint | SRS Basis |
|---|---|---|
| **Wallet Ledger Idempotency** | `wallet_transactions.idempotency_key` is `UNIQUE`: replaying the same gateway webhook can only ever produce one `ESCROW_HOLD` row (DB-level backing for TC-PAY-02). | §7 table 9; §9 |
| **Schedule-Conflict Exclusion** | `EXCLUDE USING gist` over (nurse, active-booking time range): two overlapping `CONFIRMED`/`IN_PROGRESS` bookings for the same nurse are impossible at the schema layer. Availability/time-off and the 60-minute travel buffer are layered on top at Tier 2/3 (TC-MATCH-01). | §7 tables 6, 10; FR-SCHED-01, FR-BOOK-03 |
| **Three-Axis Status Enums** | `bookings.execution_status`, `payment_status`, `dispute_status` accept only the §2.2 enum values, and evolve independently (a dispute change never mutates the payment axis except through defined resolution effects). | §2.2 (CT-17, CT-18) |
| **Uniqueness** | `users.phone` UNIQUE; `bookings.booking_code` UNIQUE; `wallets.user_id` UNIQUE (one wallet per user); `shift_logs.booking_id` UNIQUE (one shift log per booking); `system_configs.config_key` is the primary key. | §7 tables 1, 6, 7, 8, 15 |
| **Business CHECKs** | `reviews.rating` between 1 and 5; monetary amounts ≥ 0 **except** `wallets.deposit_balance`, which may go negative only as recorded penalty debt (SLA penalty exceeding the deposit is booked as debt, §5.2 rows 7–8); `patient_profiles.weight_kg` > 0 when present. | §5.2; §7 tables 4, 8, 12 |
| **Append-Only Ledger** | `wallet_transactions` rejects `UPDATE`/`DELETE` at the permission/trigger level; corrections are compensating entries only. `balance_before`/`balance_after` chain consistently per wallet. | §7 table 9 |
| **Single Source of Truth** | Schema carries both `users.status` and `nurse_profiles.profile_status`; TC-DB-01 additionally asserts at Tier 3 that job-acceptance eligibility reads `profile_status` only. No trigger or view may silently substitute one for the other. | §7 tables 1–2; CT-20 |

- **Execution:** Automated CI job provisions PostgreSQL → applies all migrations from a clean database → runs `db/tests` (configured in `.github/workflows/ci.yml`).

---

### Tier 2 — Business Logic Unit Testing (`services/api/test/unit/`)

- **Objective:** Verify business rules implemented as deterministic calculation and decision functions, using data-driven boundary tests seeded from `system_configs` (§5.1).

#### Pricing Engine (FR-BOOK-01, CT-05)

| Case | Input | Expected Result |
|---|---|---|
| **SRS worked example — night segment** | Weekday shift 20:00–06:00 at 50,000 VND/hour | Base 500,000; night segment 22:00–06:00 = 8h → night surcharge 20% × 400,000 = **80,000**; total **580,000** |
| **Night-window boundaries** | Shift ending exactly 22:00; shift starting exactly 06:00 | Zero night hours in both cases |
| | Shift 21:00–23:00 | Exactly 1 night hour surcharged |
| | Shift fully inside 22:00–06:00; shift crossing midnight | All hours surcharged; window evaluated per segment in local time |
| **Holiday surcharge on base (Tết)** | Base 500,000 on Tết Nguyên đán, `SURCHARGE_HOLIDAY_MAJOR = 3.00` | Surcharge = 300% × base = **1,500,000**; total **2,000,000** (§5.1 worked example) |
| **Holiday surcharge on base (other holiday)** | Base 500,000, `SURCHARGE_HOLIDAY_MINOR = 2.00` | Surcharge 1,000,000; total 1,500,000 |
| **Additive, never compounded** | Holiday shift that is also a night shift | Night surcharge (on the night-segment base) and holiday surcharge (on the base) are computed independently and **summed**; the holiday rate is never applied on top of the night surcharge |
| **Heavy-patient surcharge** | `weight_kg` = 79.9 vs 80.0; `mobility_status = BEDRIDDEN` at any weight | +15% of base applies at ≥ 80 kg or when bedridden; not at 79.9 kg mobile |
| **Config change without redeploy (TC-PRICE-01)** | Change `PLATFORM_COMMISSION_RATE` / `SURCHARGE_HOLIDAY_*` in `system_configs` | New bookings price with the new values immediately; amounts stored on existing bookings are unchanged |

#### Commission, Settlement & Cancellation Splits (FR-PAY-02, FR-PAY-03, §5.2)

| Rule | Mandatory Cases |
|---|---|
| **Transfer settlement split** | Booking total 500,000 VND settled → platform fee 75,000 (15%); **425,000 credited in full to the nurse's `available_balance`** (TC-SETTLE-01, TC-WALLET-01 worked figures). No amount is routed to or from `deposit_balance`. |
| **Cash commission base** | Commission = 15% of the **in-app booking price only**; any amount the customer pays above the in-app price is a tip and is excluded from the commission base (FR-PAY-01). |
| **Customer cancel Δt > 12h** | Refund 100%; no penalty (§5.2 row 1). Boundary: exactly 12h ± 1 min falls in the next band. |
| **Customer cancel 2h ≤ Δt ≤ 12h** | Refund 80%; nurse compensation 15%; platform 5% (row 2). Boundary at exactly 2h. |
| **Customer cancel Δt < 2h** | Refund 50%; nurse compensation 40%; platform 10% (row 3). |
| **Mid-shift stop by customer (row 4)** | Pay 100% of actual hours worked (minimum 1 hour); refund 100% of the unused portion (transfer orders); task-based service completed in full is paid in full even if finished early; **no penalty and no `PARTIALLY_SETTLED`**. (See the RTM divergence note in Section 11.) |
| **Medical force majeure (row 5)** | 100% refund of the unused amount; fixed `ICU_TRAVEL_SUPPORT = 50,000` paid to the nurse when the nurse already travelled. |
| **Nurse cancel > 12h (row 6)** | 0 VND penalty; TrustScore −5; booking returns to `MATCHING`. |
| **Nurse cancel ≤ 12h (row 7)** | Penalty = 20% of shift value deducted from `deposit_balance` (balance may go negative as debt); the full penalty converts to an **Urgent Bonus** on the booking for the replacement search; TrustScore −20. |
| **No-show (row 8)** | Nurse `BANNED` on the first no-show; `NO_SHOW_PENALTY = 50,000` deducted from deposit (or booked as debt); the full 50,000 becomes a customer voucher; transfer orders refunded 100%. |
| **Cash-order SLA penalties** | For CASH orders there is no customer refund (nothing was prepaid); nurse SLA penalties still deduct from `deposit_balance` only (FR-DISP-01, §5.2 applicability note). |

#### TrustScore Engine (FR-RATE-01, CT-12)

- Initial score 100 (range 0–100). Deductions: cancel > 12h −5; cancel ≤ 12h −20; upheld customer complaint −25.
- Recovery: each `SETTLED` shift rated ≥ 4 stars adds +2, capped at 100. **Worked case (TC-RATE-01): score 90 + one 5-star settled shift → 92.**
- Threshold: score < 60 triggers `SUSPENDED` (job effect asserted at Tier 5).
- Ratings are blind: a review stays `is_visible = false` until both sides have submitted or 7 days have passed since shift end.

#### Tier-Gate & Catalog Decision Functions (FR-AUTH-02, §4.2, CT-01, CT-03)

- Credentials = retirement decision only, no valid GPHN → `TIER_1_BASIC` (TC-AUTH-01).
- `TIER_1_BASIC` + service with `is_invasive = true` → deny on every decision path (matching filter, search, accept).
- Service with `is_prohibited = true` → deny for every tier; booking cannot be created.
- GPHN validity is evaluated against `gphn_expiry_date` and `scope_of_practice`, not against the retirement badge.

#### State-Machine Transition Tables (§2.2, §2.3)

- Every legal transition on the three booking axes is unit-tested; every illegal transition (e.g., `DRAFT → SETTLED`, settlement while `dispute_status = OPEN`) is rejected.
- Nurse profile lifecycle: `PENDING_VERIFICATION → ACTIVE ⇄ SUSPENDED → BANNED`, including the automatic suspension triggers (TrustScore < 60; `deposit_balance < 300,000` after a penalty; cash commission unpaid > 24h after check-out).

- **Coverage Gate:** Pricing, settlement/commission, wallet, tier-gate, and authorization modules are held to the strictest coverage bar in this strategy — **≥ 80% decision-branch coverage** in CI (Section 8).

---

### Tier 3 — API Integration & Authorization Testing

- **Endpoint Contract Verification:** Every endpoint in SRS §8 validates HTTP status codes, structured response schemas, and error hygiene (no stack traces, no health data in error bodies). Booking state transitions must conform to the §2.2 three-axis machine — illegal transitions are rejected at the API layer.
- **Tier Hard-Gate (TC-AUTH-03):** A `TIER_1_BASIC` nurse calling the accept endpoint for a booking whose service has `is_invasive = true` receives **HTTP 403 Forbidden** — on the Radar path, the Job Board path, and the direct-invite path alike. A booking for a prohibited service (`is_prohibited = true`) is rejected at creation for every role.
- **Prescription Gate (TC-BOOK-01):** Creating a booking with `is_invasive = true` without a prescription image returns **HTTP 400 Bad Request**; a prescription issued more than 7 days before the booking is likewise rejected (FR-BOOK-02, layer 1).
- **Deposit Gate (TC-WALLET-01):** A nurse with `deposit_balance < 300,000` attempting to accept a job (either matching mechanism) receives **HTTP 403** with a top-up instruction; at exactly 300,000 acceptance succeeds and there is **no cap on bookable shift value**.
- **Record-Access Window (TC-PRIV-01, FR-PRIV-01):** The assigned nurse can read the patient record and prescription images only while the booking is `CONFIRMED`/`IN_PROGRESS`; access closes **12 hours after check-out** — from that moment the same calls return **HTTP 403**. Any other nurse receives 403 at all times. An Admin re-grant for dispute handling is time-limited and writes an `audit_logs` entry (`VIEW_MEDICAL_RECORD`).
- **OTP Flows (SRS §8):** `POST /auth/request-otp` and `POST /auth/verify-otp` happy path issues a session; wrong code, expired code, and resend abuse are rejected. Numeric OTP parameters (validity window, attempt limits, lockout) are **not specified in SRS v2.0** — tests run at mechanism level with config-injected parameters and are tagged `OPEN` (Section 11). Admin Portal sign-in additionally enforces a **second factor (2FA)**; enforcement is tested, the factor mechanism is `OPEN` (Section 11).
- **Customer eKYC Gate (TC-KYC-01, FR-AUTH-03):** A customer without verified CCCD eKYC creating a home-care (`location_type = HOME`) booking is blocked until eKYC completes; a hospital-location booking requires phone verification only. Creating a patient profile without the Decree-13 health-data consent is rejected (TC-PRIV-01).
- **Withdrawal Guard (TC-WITHDRAW-01, FR-PAY-04):** Withdrawal amount greater than `available_balance` returns **HTTP 400**; a valid request creates exactly one `WITHDRAW_REQUESTED` ledger flow under row lock.
- **Chat Opening & Content Scanning (FR-CHAT-01):** The conversation for a booking is inaccessible before `CONFIRMED`; after `CONFIRMED` both parties can chat/call with real phone numbers never exposed; a message containing a phone number or external contact link triggers a sender warning and a stored log entry.
- **Cross-Layer Workflow Integration:** The primary flows (booking → payment → matching → check-in → check-out → settlement; dispute freeze and resolution; GPHN demote/re-upgrade) each have at least one API-level integration test covering the happy path and the highest-cost exception branch, for **both** payment methods.

---

### Tier 4 — External Integrations & Contract Testing (SRS §9)

| Partner Service | Testing Methodology | Mandatory Test Scenarios |
|---|---|---|
| **Payment Gateway (PayOS / VNPay / VietQR — sandbox)** | Gateway sandbox + mock webhook server | **Invalid HMAC-SHA256 signature → HTTP 401, wallet balances unchanged (TC-PAY-01).** The same webhook delivered **5 times with one `idempotency_key` → exactly one `ESCROW_HOLD` ledger entry**; replays return HTTP 200 as no-ops (TC-PAY-02). Out-of-order and late webhook delivery. Commission payment-link webhook for a CASH order confirms receipt of the full 15% → booking `SETTLED` (TC-SETTLE-02). Webhook processing never holds funds outside the internal ledger (simulated escrow, §1.3). |
| **Push Notifications (FCM) + SMS/ZNS Fallback** | Emulator/device farm + mock FCM and SMS gateways | New-shift and SOS alerts sent with `priority = high`; if an urgent alert is not acknowledged within **60 seconds**, the worker dispatches the SMS/ZNS fallback (TC-NFR-01, FR-NOTIF-01). Push payloads carry no clinical detail beyond need-to-know; lock-screen content is minimized. |
| **Maps & Geolocation (Google Maps / Goong + PostGIS)** | Mock provider + deterministic coordinate fixtures | Address → (lat, lng) geocoding at patient-profile creation; radius candidate queries at 5 km / 10 km return in **< 500 ms** on the standard fixture set (§9). Haversine check-in distance asserted at 199 m / 200 m / 201 m fixtures. |
| **Object Storage (S3 / MinIO, private)** | Bucket policy tests + signed-URL expiry tests | CCCD, GPHN, prescription, and selfie objects are never publicly readable; access is only via **presigned URLs valid 10 minutes** (NFR-SEC-01), issued after server-side authorization for that specific booking/profile. |

---

### Tier 5 — Background Jobs & Business Timers (Fake Clock)

All time-sensitive business logic executes through the shared job queue. Tests use a deterministic fake clock and assert both the state effect and the ledger/audit effect of each job; every job is proven **idempotent on re-run** (a duplicated run moves no money twice), and worker-crash simulations mid-run leave no partial money movement.

| Job / Timer | Trigger & Expected Effect | RTM Basis |
|---|---|---|
| **Payment timeout** | `DRAFT` booking unpaid for 15 minutes (`PAYMENT_TIMEOUT_MINUTES`) → `execution_status = EXPIRED`. | TC-STATE-01 |
| **Matching expiry** | Paid booking still unmatched 30 min before shift start (or 30 min after creation for urgent bookings) → `EXPIRED` + 100% refund (`payment_status = REFUNDED`). | §5.2 row 9; FR-BOOK-03 |
| **Radar radius expansion** | Radar booking unfilled after 5 minutes at 5 km → candidate radius expands to 10 km. | TC-MATCH-02 |
| **Direct-invite timeout** | Job Board direct invite unanswered for 15 minutes → booking is broadcast to all eligible nurses. | FR-BOOK-03 |
| **Settlement release (transfer)** | At `checkout_time + 24h` (`SETTLEMENT_COOLING_HOURS`) with `dispute_status = NONE` → release exactly 85% to the nurse's `available_balance`, retain 15% platform fee. Early customer confirmation settles immediately. | TC-SETTLE-01 |
| **Settlement freeze on dispute** | Dispute opened at hour 20 after check-out → the hour-24 settlement run must **not** release the disputed escrow. | TC-DISP-01 |
| **Cash-commission deadline** | CASH order: commission link issued at check-out; still unpaid at check-out +24h → nurse `SUSPENDED` (no new jobs) until the commission webhook confirms payment, which also flips the booking to `SETTLED`. Deposit and available balances are never used to cover the commission. | TC-SETTLE-02; FR-PAY-02 |
| **Record-access auto-close** | At `checkout_time + 12h` → the nurse's record/prescription access for that booking is revoked (403 thereafter). | FR-PRIV-01 |
| **GPHN expiry sweep (daily)** | `gphn_expiry_date` passed without an approved renewal → nurse auto-demoted `TIER_2_SPECIALIST → TIER_1_BASIC`, profile stays `ACTIVE`; invasive `CONFIRMED` bookings scheduled after the expiry date are auto-cancelled **without penalty** and re-dispatched. After Admin approves the new GPHN → auto re-upgrade to `TIER_2_SPECIALIST`. | TC-AUTH-02 |
| **TrustScore suspension** | Score dropping below 60 → profile `SUSPENDED`; recovery events (+2 per ≥4-star settled shift) recompute the score deterministically. | FR-RATE-01 |
| **Deposit-shortfall block** | A penalty deduction leaving `deposit_balance < 300,000` → nurse cannot accept new jobs until topped back up to 300,000. | FR-PAY-03 |
| **Rating-visibility release** | Reviews stay hidden until both sides submit, or 7 days after shift end → `is_visible` flips for both reviews. | FR-RATE-01 |
| **No-show escalation** | 30 minutes after shift start with no check-in and SOS Dispatch finding no replacement → nurse `BANNED`, 50,000 penalty → customer voucher, transfer order refunded 100%. | TC-CANCEL-01; §5.2 row 8 |
| **Push-fallback watcher** | Urgent push unacknowledged for 60 seconds → SMS/ZNS fallback dispatched exactly once. | TC-NFR-01 |

---

### Tier 6 — End-to-End User Journey Testing (E2E)

- **Golden Journey A — `BANK_TRANSFER` (Playwright + Nurse App):** Patient registers with phone + OTP → completes CCCD eKYC (home care) → accepts Decree-13 health-data consent → creates a patient profile → books an invasive service with a prescription image uploaded → price breakdown shown from `system_configs` → pays 100% via the sandbox gateway → funds `ESCROW_HELD` → a Tier-2 nurse accepts via the Job Board → chat opens (numbers masked) → nurse checks in (GPS within 200 m + live selfie) → shift-log entries recorded → check-out with the mandatory minimal care report → patient confirms completion → settlement releases 85% to the nurse → both sides submit blind ratings.
- **Golden Journey B — `CASH`:** Booking created with `payment_method = CASH` → nurse accepts → check-in / shift / check-out as above → customer pays cash on site → the nurse opens the generated VietQR / payment link and self-pays the 15% commission → gateway webhook confirms → booking `SETTLED`. **Assertion:** the nurse's `deposit_balance` is byte-identical before and after the commission flow.
- **Mandatory Exception Journeys:** Customer cancellation in each §5.2 band (100% / 80-15-5 / 50-40-10); mid-shift stop paid by actual hours with no penalty; nurse late-cancel converting the 20% deposit penalty into an Urgent Bonus and re-matching; no-show → `BANNED` + 100% refund + 50,000 VND voucher; dispute opened at hour 20 freezing settlement, then Admin `RESOLVED_CUSTOMER` → full refund from escrow (TC-DISP-02) and `RESOLVED_NURSE` → full release; on-site invalid-prescription rejection with no penalty and no TrustScore deduction (TC-BOOK-02); SOS during a shift — the app opens the 115 dialer immediately **and** the alert reaches family/Admin in **< 2 seconds** (TC-SOS-01); GPHN expiry demotion and re-upgrade reflected in the nurse UI and in matching eligibility.
- **Nurse Mobile Execution:** Check-in anti-fraud on real devices (mock-location app installed → check-in blocked and `is_mock_location_detected` recorded, TC-SEC-01); gallery upload to the selfie step is impossible (live capture only).
- **Elder-Friendly & Accessibility Testing (Nurse surfaces — MVP obligation, NFR-UI-01):** Font 16–18 pt in the app / 18–20 px on web, WCAG 2.1 AA contrast ≥ 4.5:1, touch targets ≥ 48×48 dp, and the core flows (accept shift, write shift log, pay commission) completable in **≤ 3 actions**.

---

### Tier 7 — Security Testing (aligned to `docs/security/` as revised per SRS v2.0)

- **Continuous CI Automated Security Suite:** Authorization/IDOR matrix (Tier 3); tier-gate bypass attempts (forged tier claims, calling accept APIs directly, replaying another nurse's session); illegal state-transition attempts; webhook forgery (401) and replay (idempotency); concurrent-accept race — two nurses accepting the same Radar booking simultaneously yields **exactly one** winner (Redis lock / `SELECT … FOR UPDATE`, NFR-SEC-01); concurrent webhook + settlement races move money exactly once; git secret scanning and dependency vulnerability scanning. Security failures block merging.
- **Anti-Fraud Testing:** Mock-location check-in blocked with the warning flag persisted to `shift_logs` (TC-SEC-01); selfie gallery upload blocked; server timestamp + GPS watermark verified on the stored selfie; chat content scanning detects phone numbers and external contact links, warns the sender, and logs the event (platform-leakage control, RISK-06 / FR-CHAT-01).
- **Privacy & Decree 13/2023 Verification:** Profile cannot be saved without consent (TC-PRIV-01); record access after the 12-hour window returns 403; `audit_logs` entries exist for `VIEW_MEDICAL_RECORD`, `APPROVE_GPHN`, `RESOLVE_DISPUTE`, `UPDATE_CONFIG`, `DELETE_PATIENT_DATA`; a data deletion/anonymization request is executed and verified; medical records are retained at most 24 months per FR-PRIV-01.
- **Presigned-URL Security:** URLs expire after **10 minutes**; a URL minted for one booking grants no access to another booking's objects; direct bucket URLs are denied.
- **Security Review PR Gate:** Pull requests touching authentication/OTP, authorization, the tier gate, payments/wallets, or medical records require a designated security reviewer's approval plus negative test cases in the same PR.
- **Independent Penetration Testing:** Mandatory third-party penetration test before MVP go-live and after major architectural changes: OWASP Top 10 and OWASP API Security Top 10, with emphasis on wallet race conditions, OTP brute force, tier-gate bypass, and record-access window bypass.

---

### Tier 8 — Non-Functional & Quality Attribute Testing (SRS §6)

| NFR | Testing Methodology | Quality Target & Reference Basis |
|---|---|---|
| **NFR-UI-01 Elder-Friendly (Nurse)** | Automated accessibility checks (axe-core) + manual audit on the Nurse Web Portal and Nurse Mobile App. | Font 16–18 pt (app) / 18–20 px (web); WCAG 2.1 AA contrast ≥ 4.5:1; touch targets ≥ 48×48 dp; core flows ≤ 3 actions. Patient App standard is Phase 2 — excluded from the MVP gate. |
| **NFR-COMP-01 Legacy Devices & Browsers** | Device/browser matrix testing in CI and on physical low-end devices. | Nurse app runs on **Android 8.0 (API 26)+** and **iOS 13+**; install size **< 50 MB** asserted in CI; Patient Web, Nurse Web Portal, and Admin Portal responsive on the last 2 versions of Chrome, Safari, Edge, Firefox (TC-NFR-01). |
| **NFR-AVAIL-01 Availability & DR** | Uptime monitoring on staging/production; scheduled backup & PITR restore drills on synthetic replicas; maintenance-window compliance check. | Uptime ≥ **99.5%**; no planned maintenance in the 19:00–21:00 shift-handover window; daily snapshots + PITR with **RPO ≤ 1h for wallet transactions / ≤ 24h for logs, RTO ≤ 4h**. |
| **NFR-SEC-01 Security & Integrity** | Consolidated under Tiers 4 and 7: presigned-URL expiry, ACID + row-lock / Redis-lock behavior under concurrency, anti-mock-location enforcement. | Presigned URLs valid **10 minutes**; no double-accept and no double-settlement under race tests. |
| **Performance (SRS §9 figures)** | Load testing on a production-like staging environment with the Section 7 fixture volumes. | Radius candidate search **< 500 ms**; SOS alert fan-out **< 2 seconds** (TC-SOS-01). Broader API latency/volume targets are **not numerically specified in SRS v2.0** — load tests run at mechanism level until targets are set (Section 11). |

---

### Tier 9 — User Acceptance Testing (UAT) & MVP Operational Readiness

- UAT scenarios are constructed directly from the SRS §10 acceptance criteria and the FR specifications, executed by the Product Owner and Admin operators on a production-like staging environment populated with the synthetic canonical fixtures (Section 7) — including the SRS worked money examples.
- **Operational Simulation Drills:** Live SOS incident (115-first protocol, alert fan-out, incident log closure); no-show with SOS Dispatch replacement search; dispute freeze at hour 20 and Admin resolution; a GPHN expiry sweep day (demotion, invasive-booking re-dispatch, re-upgrade after approval); cash-commission overdue suspension and recovery after payment; PITR restore drill against the NFR-AVAIL-01 targets.
- Formal go/no-go sign-off is governed by the exit criteria in Section 8.

---

## 5. RTM Traceability Matrix (from SRS §10)

Every CT row of the SRS §10 RTM appears below with its TC group and the test tier(s) that execute it. All MVP rows must be implemented as executable tests before the MVP exit gate; rows the SRS assigns to Phase 2 or to document review are handled as marked.

| CT Group | SRS Requirement | TC IDs | Acceptance Focus (per SRS §10) | Test Tiers |
|---|---|---|---|---|
| **CT-01, CT-03** | FR-AUTH-02; Service Catalog §4.2 | TC-AUTH-01 / 02 / 03 | Retirement decision only → `TIER_1_BASIC`; GPHN expiry → auto-demote, approved renewal → auto re-upgrade; Tier-1 accepting an `is_invasive = true` booking → **HTTP 403**; `is_prohibited = true` service cannot create a booking. | Tier 1, 2, 3, 5 |
| **CT-02** | FR-BOOK-02 | TC-BOOK-01 / 02 | Invasive booking without a prescription image → **HTTP 400**; Tier-2 on-site rejection for an invalid prescription within the first 30 minutes → booking `CANCELLED`, no deposit deduction, no TrustScore deduction. | Tier 2, 3, 6 |
| **CT-04** | FR-PRIV-01; FR-SHIFT-05 | TC-PRIV-01 / TC-SOS-01 | No Decree-13 consent → patient profile cannot be saved; after the access window the former nurse's record view → **HTTP 403**; SOS tap opens the 115 dialer immediately **and** alerts family/Admin in **< 2 seconds**. | Tier 3, 5, 6, 7 |
| **CT-05, CT-17** | FR-BOOK-01; FR-PAY-02 | TC-PRICE-01 / TC-SETTLE-01 / 02 | Changing `PLATFORM_COMMISSION_RATE` / `SURCHARGE_HOLIDAY_*` in `system_configs` reprices new bookings with no restart; transfer order settles at exactly +24h with an exact 85/15 split; CASH order generates a commission QR at check-out (deposit untouched) and flips to `SETTLED` when the 15% payment webhook confirms. | Tier 2, 4, 5 |
| **CT-06, CT-27** | FR-PAY-01; §9 | TC-PAY-01 / 02 | Forged webhook (bad HMAC-SHA256) → **HTTP 401**, balances unchanged; the same webhook replayed 5 times with one `idempotency_key` → exactly **one** `ESCROW_HOLD`. | Tier 1, 4, 7 |
| **CT-07** | FR-PAY-03 | TC-WALLET-01 | Deposit < 300,000 → accept blocked (**HTTP 403**); after topping up to 300,000 the nurse accepts jobs of any value; a settled 500,000 transfer booking credits exactly **425,000** to `available_balance`; `deposit_balance` is debited only by `PENALTY_DEDUCT`, never by cash commission. | Tier 1, 2, 3 |
| **CT-08, CT-18** | §2.2; §5.2 | TC-STATE-01 / TC-CANCEL-01 | Unpaid booking auto-`EXPIRED` after 15 minutes; mid-shift customer stop is settled per **§5.2 row 4** (see Section 11 divergence); no-show with no replacement → 100% refund + apology voucher + nurse `BANNED`. | Tier 2, 5, 6 |
| **CT-09, CT-11** | FR-DISP-01 (FR-DISP-02 = Phase 2) | TC-DISP-01 / 02 | Dispute opened at hour 20 → the hour-24 settlement job must not release the escrow; Admin `RESOLVED_CUSTOMER` → funds move from `escrow_locked_balance` back to the customer as a refund. | Tier 3, 5 |
| **CT-10, CT-22** | FR-SCHED-01; FR-BOOK-03 | TC-MATCH-01 / 02 | Nurse with a `TIME_OFF_EXCEPTION`, or with a `CONFIRMED` booking leaving < 60 minutes gap, never appears in matching candidates; Radar booking unfilled after 5 minutes at 5 km → radius expands to 10 km. | Tier 1, 2, 5 |
| **CT-12, CT-13, CT-14, CT-15** | FR-RATE-01; FR-SEARCH-01; FR-AUTH-03; FR-PAY-04 | TC-RATE-01 / TC-KYC-01 / TC-WITHDRAW-01 | TrustScore 90 + one 5-star settled shift → **92**; customer without CCCD eKYC is blocked from home-care booking until verified; withdrawal above `available_balance` → **HTTP 400**. | Tier 2, 3 |
| **CT-19, CT-20** | §7 schema (16 tables); §2.3 | TC-DB-01 | Schema census: 16 tables present; `nurse_credentials.reviewed_by` FK targets `users.id`; `nurse_profiles.profile_status` is the only field the APIs use to decide job-acceptance eligibility. | Tier 1, 3 |
| **CT-21** | FR-SHIFT-01; NFR-SEC-01 | TC-SEC-01 | Device with a mock-location flag (`isFromMockProvider = true`) attempts check-in → check-in blocked and the warning flag persisted to `shift_logs`. | Tier 3, 6, 7 |
| **CT-16** | FR-BOOK-04; FR-BOOK-05 | — (Phase 2) | Long-term contract features are verified in the Phase-2 cycle using the same traceability method; in MVP only the negative reachability test runs. | Deferred (Tier 6 negative only) |
| **CT-23** | NFR-COMP-01; NFR-AVAIL-01; FR-NOTIF-01 | TC-NFR-01 | Nurse app runs on Android 8.0 / iOS 13; Nurse Web Portal renders responsively on desktop and mobile browsers; urgent push unacknowledged after 60 seconds → SMS fallback sent. | Tier 4, 8 |
| **CT-24, CT-25, CT-26** | NFR-UI-01; §1.2 & §4.0; §0 | Document review | MVP / Phase-2 phasing is stated in SRS §1.2 and §4.0; document control (approval table, revision history, references) is complete in SRS §0; Elder-Friendly for the Patient App is phased to Phase 2 in NFR-UI-01. Verified by document inspection, not code tests. | Review |

---

## 6. Functional Requirements (FR) Coverage Matrix

| FR Group (SRS §4) | Primary Test Tiers | Critical Testing Focus |
|---|---|---|
| **AUTH** — FR-AUTH-01/02/03, FR-PRIV-01 | Tier 1, 2, 3, 5, 7 | Phone + OTP sign-in; nurse eKYC and credential review with `reviewed_by`; tier assignment and GPHN demote/re-upgrade; customer eKYC for home care; Decree-13 consent capture; 12-hour record-access closure. |
| **SCHED / SEARCH** — FR-SCHED-01, FR-SEARCH-01 | Tier 1, 2, 3 | Recurring availability + time-off exceptions; 60-minute travel buffer; search filters by service, area, time window, tier, gender; only `ACTIVE` profiles with matching availability and sufficient deposit are surfaced for dispatch. |
| **BOOK** — FR-BOOK-01/02/03 (MVP); FR-BOOK-04/05 (Phase 2) | Tier 2, 3, 5, 6 | Config-driven pricing with segment night surcharge and additive holiday surcharges; prescription gate (image + ≤ 7-day issue date); Radar vs Job Board mechanics; deposit gate on both mechanisms; payment-timeout and matching-expiry handling. |
| **SHIFT** — FR-SHIFT-01–05 | Tier 3, 5, 6, 7 | Anti-mock GPS + ≤ 200 m + live-selfie check-in; 30-minute initial condition/mismatch report; realtime shift logs; 1-hour-block extensions with next-shift conflict check; check-out gating on the minimal care report; SOS 115-first protocol. |
| **PAY** — FR-PAY-01–04 | Tier 1, 2, 4, 5, 7 | Two payment methods kept strictly distinct; HMAC + idempotency on every webhook; 24h settlement at 85/15; cash commission self-payment within 24h of check-out (deposit never used); deposit penalties only; withdrawal guards. |
| **DISP** — FR-DISP-01 (MVP); FR-DISP-02 (Phase 2) | Tier 3, 5, 6 | Dispute window from `IN_PROGRESS` to check-out +24h; ≤ 5 evidence files; escrow freeze on `OPEN`; `RESOLVED_CUSTOMER` / `RESOLVED_NURSE` money effects; for CASH orders, upheld customer disputes deduct compensation from the violating nurse's deposit. |
| **RATE** — FR-RATE-01 | Tier 2, 5 | Ratings open at `COMPLETED`; blind visibility (`is_visible`, both-submitted or 7 days); TrustScore arithmetic and the < 60 suspension threshold. |
| **NOTIF** — FR-NOTIF-01 | Tier 4, 5, 8 | FCM high-priority push + in-app center + WebSocket; SMS/ZNS fallback after 60 s unacknowledged urgent alerts. |
| **CHAT** — FR-CHAT-01 | Tier 3, 7 | Opens only after `CONFIRMED`; phone numbers masked end-to-end; content scanning warns and logs; history retained as dispute evidence. |
| **ADMIN** — FR-ADMIN-01 | Tier 3 | Catalog and `is_invasive` flag management; `system_configs` editing without code changes (audit-logged); user lock/unlock (`ACTIVE`/`SUSPENDED`/`BANNED`); finance reconciliation reports (escrow totals, 15% commission totals, payouts, refunds, pending withdrawals). |

---

## 7. Test Data Architecture

- **Synthetic-Only Rule:** All fixtures are synthetic. Cloning or importing production data into any non-production environment is strictly prohibited.
- **Canonical Fixtures — the SRS's own worked examples** (one shared set across all tiers; maintaining divergent reference numbers is prohibited):
  - *Pricing fixture:* weekday shift 20:00–06:00 at 50,000 VND/hour → base 500,000 + night surcharge 80,000 = **total 580,000 VND**.
  - *Holiday fixture:* base 500,000 VND on Tết → holiday surcharge 1,500,000 → **total 2,000,000 VND**.
  - *Settlement fixture:* transfer booking of 500,000 VND settling → **425,000 VND** to the nurse's `available_balance`, 75,000 VND platform fee.
  - *Deposit fixture:* nurse at 299,999 VND deposit (acceptance blocked) vs exactly 300,000 VND (acceptance allowed, any shift value).
  - *TrustScore fixture:* nurse at 90 → **92** after one 5-star settled shift; nurse at 61 receiving a −5 event → 56 → suspension path.
- **Mandatory Boundary Fixtures:**
  - Timestamps at 15 minutes, 2h, 12h, 24h, and 7 days, each ± 1 minute; GPHN expiry dates yesterday / today / tomorrow.
  - GPS coordinates at 199 m / 200 m / 201 m from the booking location; a mock-location device profile.
  - Patient weights 79.9 kg / 80.0 kg; mobility `BEDRIDDEN` vs `NORMAL`.
  - Wallet balances at 0, at penalty-exceeding-deposit (debt) values, and at exact gate thresholds.
- **Configuration Fixtures:** `system_configs` seeded with the exact SRS §5.1 values (`PLATFORM_COMMISSION_RATE 0.15`, `MIN_NURSE_DEPOSIT 300000`, `SURCHARGE_NIGHT_SHIFT 0.20`, `SURCHARGE_HOLIDAY_MAJOR 3.00`, `SURCHARGE_HOLIDAY_MINOR 2.00`, `SURCHARGE_HEAVY_PATIENT 0.15`, `PAYMENT_TIMEOUT_MINUTES 15`, `SETTLEMENT_COOLING_HOURS 24`, `CHECKIN_MAX_RADIUS_METERS 200`, `ICU_TRAVEL_SUPPORT 50000`, `NO_SHOW_PENALTY 50000`), plus a mutated-config variant used only by TC-PRICE-01. The service catalog fixture contains services from all three groups of §4.2 (non-invasive, conditional invasive, prohibited).
- **Per-Test Factories (`db/tests/src/fixtures.ts`):** Lightweight factories generating users per role/tier/profile-status, patient profiles (hospital vs home location, consent states), bookings in targeted three-axis states, and wallets with targeted balances.

---

## 8. Environments, CI Pipelines & Quality Gates

### Deployment Environment Stages
`Local Workstation` (Docker Compose: PostgreSQL + Redis) → `CI Runner` (GitHub Actions) → `Staging Environment` (production-parity configuration, synthetic data only, sandbox payment gateways) → `Production Environment`.

### Mandatory CI Quality Gates (Every PR — `.github/workflows/ci.yml`)
1. **Compilation & Unit Suite:** Type checking and unit test suites must be 100% green.
2. **Database Verification Job:** Applies all migrations against a clean PostgreSQL instance and executes `db/tests` — must be 100% green.
3. **Automated Security Scanners:** Commit secret scanning and dependency vulnerability scanning — any critical/high finding blocks the build.
4. **Branch Coverage Threshold (strictest bar):** **≥ 80% decision-branch coverage** across the money modules (pricing, settlement, commission, wallet), authorization, and the tier gate. Other modules are measured and reported; the bar applies where money, access, or clinical safety is decided.
5. **Security Gate:** Pull requests touching authentication/OTP, authorization, the tier gate, financial logic, or medical-record access mandate explicit approval from a designated security reviewer.

### Test Entry Criteria
- The FR and its RTM acceptance criteria are unambiguous in SRS v2.0 (items listed in Section 11 enter as mechanism-level tests or `OPEN` tags only).
- Target test environment and prerequisite synthetic fixtures are fully provisioned.

### Test Exit Criteria (MVP Go-Live Sign-Off)
- All MVP test cases in the Section 5 RTM matrix pass (CT-16 deferred to Phase 2 and CT-24/25/26 verified by document review, as the SRS itself prescribes).
- Zero open defects of Blocker or Critical severity.
- Independent third-party penetration testing is complete with all Critical and High vulnerabilities remediated.
- PITR restore drill validates the NFR-AVAIL-01 targets (RPO ≤ 1h wallet / ≤ 24h logs; RTO ≤ 4h).
- UAT sign-off executed by the Product Owner and QA/Test Lead against the SRS §10 acceptance criteria.
- All Tier 9 operational simulation drills executed successfully.

### Defect Triage & Management
Defect severity is triaged by business impact: money precision, clinical/legal safety (tier gate, prescription, SOS), and health-data privacy constitute the highest severity. Every filed defect cites its CT/TC/FR identifier. Any defect escaping to staging or production is converted into a mandatory regression test at the lowest tier capable of catching it.

---

## 9. Roles & Responsibilities

| Project Role | Core Testing Responsibilities |
|---|---|
| **Software Engineers** | Author unit, database-constraint, API-integration, and job tests in tandem with feature code in the same PR; maintain green builds; update tests when the SRS is formally revised. |
| **QA / Test Engineers (QA Lead)** | Own the E2E suites, UAT scenario definitions, and the Section 5 traceability matrix; audit CT/TC coverage at every milestone. |
| **Product Owner** | Own the SRS baseline; resolve Section 11 open items; sign off the MVP go/no-go gate. |
| **Security Reviewer** | Review and sign off PRs touching high-risk domains; schedule penetration testing; verify Tier 7 suites stay green. |
| **Medical & Legal Advisor** | Verify the service catalog classification (§4.2), prescription-verification rules, and Decree-13 consent/retention behavior reflected in tests. |
| **Admin Operations** | Execute UAT and the Tier 9 operational drills (SOS, no-show dispatch, dispute handling, GPHN sweep). |

---

## 10. Test Implementation Roadmap

1. **Phase 1 — Schema & Database Foundation:** Migrations for the 16 SRS tables; TC-DB-01 census; wallet idempotency and schedule-conflict exclusion suites; canonical fixtures (Section 7).
2. **Phase 2 — Pricing, Money & Access Rules:** Tier 2 suites for the pricing engine, settlement/cancellation splits, TrustScore, and the tier-gate decision functions; Tier 3 authorization matrix including the 403 gates and the record-access window; OTP flow tests.
3. **Phase 3 — Jobs, Timers & Gateway Contracts:** Tier 5 fake-clock suites for every timer in the Tier 5 table; Tier 4 webhook contract tests (HMAC, replay, commission confirmation) and FCM→SMS fallback tests.
4. **Phase 4 — Client Journeys:** Tier 6 golden journeys for both payment methods and the mandatory exception journeys; nurse device-matrix and elder-friendly checks (NFR-UI-01, NFR-COMP-01).
5. **Phase 5 — MVP Hardening & Readiness:** Penetration testing, PITR drill, Tier 9 operational drills, UAT sign-off against the exit criteria.

---

## 11. Open Items & SRS Divergences Affecting Tests

| # | Item | Testing Impact | Current Interim Handling |
|---|---|---|---|
| 1 | **Mid-shift stop rule:** SRS §5.2 row 4 states pay for actual hours worked, **no penalty**, and no `PARTIALLY_SETTLED`; the §10 RTM line for TC-CANCEL-01 instead mentions a 30% penalty on the remaining hours. The two texts conflict. | The monetary assertion for the mid-shift stop case cannot satisfy both texts. | Tests follow **§5.2 row 4** (the detailed SLA matrix, consistent with the round-2 team decision recorded in SRS §0.2). The RTM line is tagged `OPEN` pending an SRS text correction. |
| 2 | **Rating opening moment:** FR-RATE-01 and §2.3 state ratings open at `COMPLETED`; the §8 API list describes the reviews endpoint as "after the shift is SETTLED". | One boundary test for when the reviews endpoint starts accepting submissions. | Tests follow **FR-RATE-01** (open at `COMPLETED`, blind via `is_visible`). §8 wording tagged `OPEN`. |
| 3 | **Record-access closure moment:** FR-PRIV-01 closes access **12h after check-out**; TC-PRIV-01 phrases the 403 check at `SETTLED` (which occurs at +24h). | Timing assertion for the access-revocation job. | Tests assert 403 from **+12h** per FR-PRIV-01; the `SETTLED` check is then automatically satisfied. RTM phrasing tagged `OPEN`. |
| 4 | **OTP parameters** (code length, validity window, max attempts, lockout, resend cooldown) are not specified in SRS v2.0. | No numeric assertions are possible for OTP expiry/lockout. | Mechanism-level tests with config-injected parameters; numeric assertions `OPEN` until the SRS or security docs specify values. |
| 5 | **Admin 2FA mechanism** (factor type, enrolment, recovery) is required for Admin accounts but is not detailed in the SRS FRs. | Only the enforcement property (second factor required) can be tested. | Test enforcement at Tier 3; mechanism-specific tests `OPEN`. |
| 6 | **Travel compensation for on-site invalid-prescription rejection** (FR-BOOK-02, RISK-01) is stated qualitatively ("travel support") with no config value; `ICU_TRAVEL_SUPPORT = 50,000` is scoped by §5.2 row 5 to the ICU scenario. | The amount credited in TC-BOOK-02 cannot be asserted. | Tests assert: no penalty, no TrustScore deduction, and that a travel-support credit occurs; the amount assertion is `OPEN`. |
| 7 | **Holiday calendar source:** §5.1 fixes the holiday *rates*; which concrete dates count as "other public holidays" (`SURCHARGE_HOLIDAY_MINOR`) follows the official state holiday calendar and is not enumerated in the SRS. | Pricing tests need a defined holiday-date set. | Tests inject a holiday-date fixture; ownership of the production calendar (Admin configuration) is `OPEN`. |
| 8 | **Volume & latency targets:** SRS specifies radius search < 500 ms, SOS alert < 2 s, and uptime ≥ 99.5%, but no request-volume model or general API latency targets. | Load-test pass/fail thresholds beyond the specified figures cannot be set. | Load tests verify the specified figures; broader performance targets `OPEN`. |
| 9 | **`PARTIALLY_SETTLED` / `RESOLVED_PARTIAL`** exist as enum values in the MVP schema (§2.2) while adjudication is Phase 2 (FR-DISP-02). | Reachability expectations differ between schema tests and flow tests. | Tier 1 accepts the enum values; Tier 3/5/6 assert they are **unreachable** via MVP flows; split-adjudication tests deferred to Phase 2. |

---

*Core Guiding Principle: Testing strictly adheres to the governing SRS v2.0 baseline. Points the SRS leaves open are tested at the mechanism level or tracked with explicit `OPEN` flags — never allow an unspecified value to masquerade as verified truth simply because an automated test is green.*
