# Phased Development & Engineering Checklist — Frontend / Backend

> **Specification Baseline:** SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**. Authoritative business rules are detailed in the SRS, `docs/requirement/`, and `docs/business_rule/`.
> **Team Roster:** 2 Frontend Engineers (FE-1, FE-2) + 3 Backend Engineers (BE-1, BE-2, BE-3).
> **Workflow Protocol:** Execute sequentially across Phases 0 → 8 without skipping. Check off items upon completion. A phase is considered complete only when **all items across all 5 roles and all Phase Exit Criteria are checked**. Within each phase: Backend finalizes API contracts first → Frontend builds in parallel with deterministic mocks → Full end-to-end integration occurs at phase conclusion on staging.
> **Vietnamese Version:** Preserved and synchronized in [`archive/development-checklist.vi.md`](archive/development-checklist.vi.md).

---

## 0. General Preparation (One-time, prior to Phase 0)

- [ ] Fill in real engineer names for the 5 roles: FE-1 = ………… · FE-2 = ………… · BE-1 = ………… · BE-2 = ………… · BE-3 = …………
- [ ] All 5 engineers have read and understood SRS v2.0 Updated (§4 FRs, §5 configs & SLA, §7 PostgreSQL schema, §8 API catalog).
- [ ] Agree on fixed operational ownership:
  - **FE-1:** Patient Web + Admin Web
  - **FE-2:** Nurse Web Portal + Nurse Mobile App
  - **BE-1:** Infrastructure, Core Platform, Identity & Auth
  - **BE-2:** Scheduling, Bookings, Matching & Shift Execution
  - **BE-3:** Payments, Wallets, Disputes, Notifications & Post-Shift
- [ ] Agree: Zero hardcoding — all business numbers must be loaded dynamically from `system_configs` (§5.1): platform commission 15%, nurse deposit 300,000 VND, night shift surcharge +20%, Lunar New Year (Tết) surcharge +300%, national holiday surcharge +200%, heavy-care patient surcharge +15%, payment hold timeout 15 min, settlement cooling window 24h, check-in radius ≤ 200 m, ICU travel support 50,000 VND, no-show penalty 50,000 VND.
- [ ] Agree: All monetary movements proceed strictly through the append-only `wallet_transactions` ledger with unique `idempotency_key`, `balance_before`, and `balance_after`. The nurse deposit is reserved **exclusively** for SLA penalties; it is **never** debited for cash-job commission.
- [ ] Agree: `nurse_profiles.profile_status` is the single source of truth for shift eligibility; tier gating is strictly enforced on the backend (returning **HTTP 403**).
- [ ] Agree: All temporal business deadlines must be registered with the shared job queue engine; spontaneous in-process `setTimeout` calls are strictly forbidden.
- [ ] Agree: Frontend surfaces never compute pricing, deadlines, or shift acceptance eligibility — all decisions and values are authoritative responses from the backend.
- [ ] Fill in target milestone calendar: Phase 0 …… → Phase 1 …… → Phase 2 …… → Phase 3 …… → Phase 4 …… → Phase 5 …… → Phase 6 …… → Phase 7 …… → Phase 8 ……

---

## Phase 0 — Shared Infrastructure Foundation

### FE-1 (Patient Web + Admin Web)
- [ ] Scaffold `apps/patient-web`: project setup, client routing, base layout.
- [ ] Scaffold `apps/admin-web`: project setup, client routing, base layout.
- [ ] Unified API client library: base URL `/api/v1`, Bearer token attachment, standardized error handling for HTTP 400/401/403.
- [ ] Shared design system UI component library: buttons, form inputs, data tables, status badges.

### FE-2 (Nurse Web + Nurse Mobile App)
- [ ] Scaffold `apps/nurse-web`: project setup, client routing, base layout.
- [ ] Scaffold `apps/nurse-app`: React Native / mobile setup, navigation, base layout.
- [ ] Elder-Friendly design token system: typography 16–18pt (Mobile) / 18–20px (Web), oversized touch targets $\ge 48 \times 48\text{ dp}$, WCAG 2.1 AA contrast ($\ge 4.5:1$).
- [ ] Unified API client library adhering to the standard agreed with FE-1.
- [ ] Smoke test mobile build deployment on a physical legacy Android device.

### BE-1 (Platform & Infrastructure — Phase Lead)
- [ ] `core/database`: PostgreSQL connection pool setup (ADR-0002 SQL-first).
- [ ] `core/config`: Dynamic `system_configs` cache-backed reader (zero hardcoded values).
- [ ] `core/storage`: Private S3/MinIO bucket integration with 10-minute Presigned URL generator.
- [ ] Sequential SQL migrations provisioning the 16 core tables (§7).
- [ ] Seed data scripts: `system_configs` parameters (§5.1) + service catalog (§4.2).
- [ ] `packages/shared`: Shared status enums (3-axis booking states, profile lifecycle, wallet transaction types, config keys).

### BE-2
- [ ] `core/jobs`: Shared job queue engine with idempotency locks, dead-letter queue (DLQ), and backlog alerts.
- [ ] Docker Compose orchestration: PostgreSQL 16 + Redis (in collaboration with BE-1).

### BE-3
- [ ] `core/notifications`: Unified notification interface (FCM push + in-app + WebSocket) with deterministic mock for local testing.
- [ ] Urgent alert dispatcher with `priority = high` + 60-second unacknowledged delivery watcher.
- [ ] `core/audit`: Append-only `audit_logs` service (mutation/deletion locked at both application and database layers).
- [ ] CI pipeline green on empty PR: unit test runner + PostgreSQL migration/constraint tests + secret scanner.

### Phase 0 Exit Criteria
- [ ] Docker Compose successfully provisions and health-checks PostgreSQL and Redis.
- [ ] SQL migrations and seed datasets apply cleanly onto an empty database.
- [ ] `packages/shared` exports all required §2.2 / §2.3 domain enums.
- [ ] Automated CI pipeline passes cleanly on main branches.

---

## Phase 1 — AUTH: Identity, eKYC, Tiers & Privacy [MVP]

### FE-1
- [ ] Patient Web — Phone + OTP SMS authentication flow (`features/auth`).
- [ ] Patient Web — Patient profile creation + mandatory Decree-13 sensitive health data consent checkbox (`features/patient-profiles`).
- [ ] Patient Web — Customer CCCD identity document upload for eKYC.
- [ ] Admin Web — Nurse verification queue: review uploaded credentials, approve/reject, assign professional Tier (`features/nurse-verification`).

### FE-2
- [ ] Nurse Web + Mobile App — Phone + OTP SMS authentication flow.
- [ ] Nurse Web + Mobile App — eKYC onboarding wizard (`features/onboarding`): CCCD both sides, live portrait selfie, medical/nursing degree, GPHN (number, expiration date, clinical scope), retirement decision.
- [ ] Nurse Web + Mobile App — Credentials management screen + upload newly renewed GPHN upon expiration (`features/credentials`).
- [ ] Clear profile status display across all screens: Pending Verification / Active / Suspended / Banned.

### BE-1 (Phase Lead)
- [ ] `accounts-otp`: `POST /api/v1/auth/request-otp` (rate-limited issuance, zero OTP material logged).
- [ ] `accounts-otp`: `POST /api/v1/auth/verify-otp` (session token issued only upon valid code; Admin accounts require mandatory 2FA).
- [ ] `nurse-onboarding` (FR-AUTH-01): `POST /api/v1/auth/nurse-onboarding` — profile initialized to `PENDING_VERIFICATION`, files stored in private storage.
- [ ] `credential-review` (FR-AUTH-02): `PATCH /api/v1/admin/nurses/:id/verify` — records `reviewed_by`, assigns Tier (valid degree without GPHN → Tier 1; valid in-scope GPHN → Tier 2; retirement decision alone never yields Tier 2).
- [ ] `credential-review`: Admin approval of newly submitted GPHN via `PUT /api/v1/nurse/credentials/gphn` automatically restores Tier 2.

### BE-2
- [ ] `tier-lifecycle`: Daily scheduled job scanning GPHN expiry — demotes expired Tier 2 → Tier 1 while maintaining `ACTIVE` profile status.
- [ ] `tier-lifecycle`: Automatically cancels invasive `CONFIRMED` shifts scheduled after GPHN expiry without penalty and triggers re-dispatch.
- [ ] `patient-profiles` (FR-AUTH-03): Patient profile management + customer eKYC; blocks home-care booking creation when customer eKYC is not `VERIFIED`; blocks profile creation if consent is missing.

### BE-3
- [ ] `privacy-consent` (FR-PRIV-01): Consent event capture recording timestamp + client IP + device metadata.
- [ ] `privacy-consent`: Medical record access authorization policy — restricted to assigned nurse, valid from `CONFIRMED` until check-out +12h; time-boxed Admin temporary re-grant with audit log.
- [ ] `privacy-consent`: 24-month medical data retention enforcement; account deletion/anonymization request handler.
- [ ] Support BE-1: 10-minute Presigned URL minting pipeline for sensitive identity and credential documents.

### Phase 1 Exit Criteria
- [ ] A nurse completes full onboarding: registration → Admin credential review → Tier assignment on staging.
- [ ] Complete GPHN lifecycle executed: license expires → auto-demoted to Tier 1 → uploads renewed GPHN → Admin approves → re-promoted to Tier 2.
- [ ] Customer completes eKYC and successfully registers a patient profile with explicit Decree-13 consent.
- [ ] A profile in `PENDING_VERIFICATION` status never appears in search results or matching candidate pools and cannot accept shifts.

---

## Phase 2 — SCHED & SEARCH: Availability & Nurse Discovery [MVP]

### FE-1
- [ ] Patient Web — Nurse discovery screen: filters by service category, district/location, time slot, Tier, and gender.
- [ ] Patient Web — Nurse profile summary card: TrustScore, rating average, verified experience, and retired staff honor badge.

### FE-2
- [ ] Nurse Web + Mobile App — Availability calendar: configure recurring weekly working time slots.
- [ ] Nurse Web + Mobile App — Register time-off exceptions (single-day or date-range blockouts).
- [ ] Nurse Web + Mobile App — Visual calendar overlay displaying confirmed and in-progress shifts.

### BE-1
- [ ] Maintain cached `rating_avg` on nurse profiles aggregated from visible completed reviews only.
- [ ] Seed representative sample nurse profiles with diverse credentials and locations for search test suites.

### BE-2 (Phase Lead)
- [ ] `nurse-availabilities` (FR-SCHED-01): `PUT /api/v1/nurse/availabilities` — updates recurring windows and time-off exceptions in a single atomic transaction.
- [ ] `availability-engine`: Effective availability = declared schedule − confirmed/in-progress bookings − **60-minute travel buffer**.
- [ ] `availability-engine` serves as the single source of truth for both nurse search and automated matching (no divergent availability logic).

### BE-3
- [ ] `nurse-search`: `GET /api/v1/nurses/search` implementing all FR-SEARCH-01 query filters.
- [ ] `nurse-search`: Surfaces only `ACTIVE` nurses with `deposit_balance ≥ 300,000` VND and qualifying Tier for the requested service; consumes `availability-engine`.

### Phase 2 Exit Criteria
- [ ] A nurse with a `TIME_OFF_EXCEPTION` is strictly excluded from search results and candidate dispatch pools for that window.
- [ ] A nurse with < 60 minutes buffer between an existing confirmed shift and a requested shift is strictly excluded.
- [ ] Availability results match identically between customer search views and automated dispatch engine queries.

---

## Phase 3 — BOOK: Booking, Pricing, Prescription Gate & Matching [MVP]

### FE-1
- [ ] Patient Web — End-to-end booking flow: select service → choose patient profile → select time slot → confirm booking.
- [ ] Patient Web — Mandatory prescription photo upload interface when selecting invasive services (`is_invasive = true`).
- [ ] Patient Web — Transparent pricing breakdown card: base amount, night surcharge, holiday surcharge, heavy patient surcharge, platform fee, total amount.
- [ ] Patient Web — Payment method selector: Prepaid Bank Transfer (Escrow) vs On-site Cash.
- [ ] Patient Web — Pending payment countdown screen with real-time 15-minute expiration timer.
- [ ] Patient Web — Direct nurse invitation action from profile discovery screen.
- [ ] Patient Web — My Bookings dashboard presenting independent 3-axis status badges (`execution`, `payment`, `dispute`).

### FE-2
- [ ] Nurse Web + Mobile App — Job Board interface for advance bookings (> 6 hours).
- [ ] Nurse Web + Mobile App — Real-time Radar Dispatch modal for urgent bookings (≤ 6 hours) with countdown timer and Accept/Decline actions.
- [ ] Nurse Web + Mobile App — Direct booking invitation notification with 15-minute decision window.
- [ ] Nurse Web + Mobile App — Explicit gating warnings when ineligible to accept (deposit shortfall / wrong Tier / schedule conflict).

### BE-1
- [ ] `prescription-gate` (FR-BOOK-02) Layer 1: Invasive services strictly require prescription image and issue date $\le 7$ days; rejects with HTTP 400 if missing.
- [ ] `prescription-gate` Layer 2: Tier 2 nurse is granted authorized read access to review the prescription image prior to shift acceptance.

### BE-2 (Phase Lead)
- [ ] `pricing-engine` (FR-BOOK-01): Price calculation = base price + segment-based night surcharge (22:00–06:00, +20%) + holiday surcharges (+300% Tết / +200% holiday) + heavy patient surcharge (+15%); all surcharges calculate strictly on base price without compounding.
- [ ] `pricing-engine`: Boundary test suite passing all SRS worked examples (night shift 580,000 VND; Tết shift 500,000 VND → 2,000,000 VND).
- [ ] `pricing-engine`: Persists authoritative price snapshot onto booking record (`base_amount`, `surcharge_amount`, `platform_fee`, `total_amount`).
- [ ] `bookings`: `POST /api/v1/bookings` — validates Decree-13 consent, customer eKYC, prescription gate, blocks prohibited services (Group 3), stores `payment_method`, initializes `DRAFT` booking with 15-minute payment hold.
- [ ] `matching-radar` (FR-BOOK-03): Urgent bookings $\le 6\text{h}$ — broadcasts 5 km radius for minutes 0–5, expands to 10 km thereafter.
- [ ] `matching-radar`: Concurrency control — first accept wins enforced via Redis Distributed Lock / `SELECT … FOR UPDATE`.
- [ ] `matching-radar`: Backend re-validates `profile_status = ACTIVE`, Tier qualification, `deposit_balance ≥ 300,000` VND, and effective availability at the exact moment of acceptance.

### BE-3
- [ ] `job-board`: Advance bookings $> 6\text{h}$ published to Job Board for eligible nurses.
- [ ] `job-board`: Direct nurse invitation — falls back to broad dispatch if unanswered after 15 minutes.
- [ ] `booking-expiry`: Expiration worker — unpaid booking transitions to `EXPIRED` at 15 minutes.
- [ ] `booking-expiry`: Unmatched booking within 30 minutes of scheduled start transitions to `EXPIRED` + triggers 100% refund if funds are `ESCROW_HELD`.
- [ ] `gateway-webhooks` (minimal scope): Bank transfer webhook processes payment to `ESCROW_HELD` to activate the matching engine.

### Phase 3 Exit Criteria
- [ ] Both matching mechanisms (Radar Dispatch and Job Board) successfully pair a shift on staging.
- [ ] An unpaid booking transitions to `EXPIRED` exactly after 15 minutes.
- [ ] A paid booking with no matched nurse expires 30 minutes before shift start and triggers a 100% escrow refund.
- [ ] Prohibited services (Group 3) cannot be created under any circumstances, including via Admin endpoints.

---

## Phase 4 — SHIFT: Shift Execution, Anti-Fraud Check-In & SOS [MVP]

### FE-1
- [ ] Patient Web — Real-time shift tracking: live status, check-in selfie photo for visual identity verification.
- [ ] Patient Web — Real-time vital signs and clinical care log viewer.
- [ ] Patient Web — Shift extension request: select 1-hour increments, top up escrow for bank-transfer bookings.
- [ ] Patient Web — Real-time emergency SOS broadcast banner for active family bookings.

### FE-2 (Frontend Lead)
- [ ] Nurse Mobile App — Dual check-in: mock location detection blocked, direct hardware camera selfie capture, photo gallery upload disabled.
- [ ] Nurse Mobile App — Initial 30-minute patient assessment report + condition mismatch reporting flow.
- [ ] Nurse Mobile App — Clinical care logging: vital signs chart, completed nursing activities, clinical notes.
- [ ] Nurse Mobile App — Approve or decline patient-requested shift extensions.
- [ ] Nurse Mobile App — On-site invalid prescription rejection flow with mandatory photo evidence.
- [ ] Nurse Mobile App — Dedicated SOS emergency button: immediately opens device 115 emergency dialer with zero network latency.
- [ ] Nurse Web + Mobile App — Check-out flow enforcing submission of mandatory minimal clinical care report.

### BE-1
- [ ] `shift-extend` (FR-SHIFT-03): `POST /api/v1/bookings/:id/extend` — 1-hour increments, validates nurse schedule conflicts, requires nurse approval.
- [ ] `prescription-rejection`: `POST /api/v1/bookings/:id/reject-invalid-prescription` — mandatory evidence photo, transitions to `CANCELLED`, zero penalty, zero TrustScore deduction.

### BE-2 (Phase Lead)
- [ ] `check-in` (FR-SHIFT-01): `POST /api/v1/bookings/:id/check-in` — blocks OS mock locations.
- [ ] `check-in`: Haversine distance verification $\le 200\text{ m}$ against booking location coordinates.
- [ ] `check-in`: Server-stamped timestamp and GPS coordinates embedded on live selfie → transitions `execution_status` to `IN_PROGRESS`.
- [ ] `shift-logs` (FR-SHIFT-02): Structured clinical logging + initial condition mismatch flow (surcharge addition request or no-penalty cancellation).
- [ ] `shift-logs`: Real-time shift log synchronization via WebSocket.
- [ ] `check-out` (FR-SHIFT-04): `POST /api/v1/bookings/:id/check-out` — strictly blocks check-out if minimal care report is absent (final vitals, care activities, handover notes).
- [ ] `check-out`: Records `checkout_time`, starts 24h dispute/settlement countdown and 12h medical record access closure timer, opens two-way ratings.
- [ ] `check-out`: Fully completed task-based bookings receive 100% compensation regardless of early completion.

### BE-3
- [ ] `sos` (FR-SHIFT-05): Dispatches concurrent high-priority FCM push + SMS fallback containing GPS coordinates and latest vital signs to family and Admin ($< 2\text{ seconds}$).
- [ ] `sos`: Persists emergency incident report into `shift_logs.emergency_incident_log`.
- [ ] Real-time WebSocket gateway infrastructure shared with BE-2 for clinical shift logging.

### Phase 4 Exit Criteria
- [ ] Full shift lifecycle executed on physical hardware: check-in → logging → extension → check-out + report.
- [ ] Invalid prescription on-site rejection branch executes successfully without penalty.
- [ ] Emergency SOS alert reaches family and Admin within $< 2\text{ seconds}$ during testing.
- [ ] Anti-fraud check-in verified on physical device: fake GPS apps and gallery uploads are strictly blocked.

---

## Phase 5 — PAY: Wallets, Escrow, Settlement, Deposit & Withdrawals [MVP]

### FE-1
- [ ] Patient Web — Prepaid bank transfer flow: displays VietQR/checkout link with 15-minute countdown.
- [ ] Patient Web — Platform escrow holding indicator for prepaid bookings.
- [ ] Patient Web — Transparent refund tracking view mapped to §5.2 SLA cancellation matrix scenarios.

### FE-2
- [ ] Nurse Web + Mobile App — Wallet dashboard displaying 3 strictly segregated balances: Available (`available_balance`), Escrow Locked (`escrow_locked_balance`), Deposit (`deposit_balance`).
- [ ] Nurse Web + Mobile App — Deposit top-up flow maintaining the 300,000 VND requirement.
- [ ] Nurse Web + Mobile App — Cash booking 15% platform commission payment: generates VietQR link, 24h countdown, overdue suspension warning banner.
- [ ] Nurse Web + Mobile App — Earnings withdrawal request interface.
- [ ] Nurse Web + Mobile App — Immutable wallet transaction ledger history.

### BE-1
- [ ] `cancellation-policy`: Implements the §5.2 SLA matrix as a centralized data-driven policy engine — 9 scenarios, each with dedicated unit tests.
- [ ] `cancellation-policy`: Cancellation $> 12\text{h}$ gives 100% customer refund · $2–12\text{h}$ levies 20% cancellation fee (15% nurse / 5% platform) · $< 2\text{h}$ levies 50% cancellation fee (40% nurse / 10% platform).
- [ ] `cancellation-policy`: Mid-session stop after check-in billed by actual completed hours (minimum 1h), zero early cancellation fee.
- [ ] `cancellation-policy`: Force majeure ICU hospitalization or death waives all fees + provides 50,000 VND travel support if nurse departed.
- [ ] `cancellation-policy`: Nurse cancellation $\le 12\text{h}$ deducts 20% shift value from deposit into Urgent Bonus for replacement nurse + −20 TrustScore; cancellation $> 12\text{h}$ deducts −5 TrustScore.
- [ ] `cancellation-policy`: Nurse no-show results in permanent account ban (`BANNED`) + 50,000 VND deposit penalty converted to customer apology voucher.

### BE-2
- [ ] `deposits` (FR-PAY-03): Upfront 300,000 VND deposit gate required to accept shifts; zero progressive accumulation, zero shift value cap.
- [ ] `deposits`: SLA penalty deductions exceeding balance are booked as debt (negative balance), blocking new shift acceptance until replenished.
- [ ] `deposits`: Full deposit refund permitted only upon account closure after 7 dispute-free days.
- [ ] `cash-commission`: `POST /api/v1/bookings/:id/commission-payment-link` — generates VietQR link for exactly 15% of in-app booking price for cash orders.
- [ ] `cash-commission`: Gateway webhook confirms payment → transitions booking `payment_status` to `SETTLED`; unpaid after 24h → nurse transitions to `SUSPENDED`.
- [ ] `cash-commission`: Absolute invariant — cash commission is **never** deducted from `deposit_balance` or `available_balance`.

### BE-3 (Phase Lead)
- [ ] `wallets-ledger`: Strict separation of 3 ledger balances in `wallets` table.
- [ ] `wallets-ledger`: Append-only `wallet_transactions` table; every entry records unique `idempotency_key`, `balance_before`, and `balance_after`; zero UPDATE/DELETE grants.
- [ ] `wallets-ledger`: All balance adjustments execute inside ACID transactions with row-level locks (`SELECT … FOR UPDATE`) or Redis locks.
- [ ] `gateway-webhooks` (FR-PAY-01): `POST /api/v1/payments/escrow-webhook` — verifies raw HMAC-SHA256 signature first; invalid signature returns HTTP 401 with zero state mutation.
- [ ] `gateway-webhooks`: Replayed webhooks handled idempotently (HTTP 200, no duplicate ledger entry).
- [ ] `settlements` (FR-PAY-02): Bank-transfer bookings — customer early confirmation **or** check-out +24h with `dispute_status = NONE` → deducts 15% platform fee, credits 85% to nurse `available_balance`.
- [ ] `settlements`: Active dispute (`OPEN`) atomically freezes settlement payout.
- [ ] `withdrawals` (FR-PAY-04): `POST /api/v1/wallets/withdraw` — amount exceeding `available_balance` returns HTTP 400; initializes `WITHDRAW_REQUESTED` approval flow.

### Phase 5 Exit Criteria
- [ ] A 500,000 VND bank-transfer shift settles with exactly 425,000 VND credited to nurse and 75,000 VND platform fee.
- [ ] Cash-job commission payment leaves `deposit_balance` completely unaffected.
- [ ] Duplicate gateway webhook delivery creates exactly one transaction record in the ledger.
- [ ] Both payment methods complete full lifecycles on staging with zero ledger discrepancy.
- [ ] Refunds apply strictly to bank-transfer orders (cash orders were never prepaid to the platform).

---

## Phase 6 — DISP, RATE, NOTIF, CHAT [MVP]

### FE-1
- [ ] Patient Web — File customer dispute with up to 5 evidence file attachments.
- [ ] Patient Web — Post-shift nurse rating and review form.
- [ ] Patient Web — In-app notification center.
- [ ] Shared in-app chat component (FE-1 leads development; FE-2 integrates for nurse surfaces).

### FE-2
- [ ] Nurse Web + Mobile App — Dispute notification and rebuttal submission interface.
- [ ] Nurse Web + Mobile App — Post-shift customer rating form.
- [ ] Nurse Web + Mobile App — In-app chat interface with customer (reusing FE-1 component).
- [ ] Nurse Web + Mobile App — Personal TrustScore dashboard: current score, deduction/recovery history, suspension warning near 60.

### BE-1
- [ ] `reviews-trustscore` (FR-RATE-01): `POST /api/v1/bookings/:id/reviews` — opens immediately upon `COMPLETED` execution status, independent of financial settlement.
- [ ] `reviews-trustscore`: Blind reviews (`is_visible = false`) until both parties submit or 7 days elapse — flipped by scheduled background job.
- [ ] `reviews-trustscore`: TrustScore adjustments: −5 cancellation $> 12\text{h}$, −20 cancellation $\le 12\text{h}$, −25 upheld customer complaint, +2 recovery per $\ge 4$-star shift (capped at 100).
- [ ] `reviews-trustscore`: TrustScore dropping below 60 automatically transitions nurse to `SUSPENDED`.

### BE-2
- [ ] `chat` (FR-CHAT-01): In-app messaging and call logs on `conversations_messages`, activated once booking reaches `CONFIRMED`.
- [ ] `chat`: Masked identity — real phone numbers never exposed in any UI component or API response.
- [ ] `chat`: Automated content regex scanning for phone numbers or external payment links; issues warning and logs security event.
- [ ] `chat`: Conversation history permanently retained as dispute evidence (no hard deletion); chat closes upon shift completion; Admin access audit-logged.

### BE-3 (Phase Lead)
- [ ] `disputes` (FR-DISP-01): `POST /api/v1/bookings/:id/disputes` — window open from `IN_PROGRESS` until check-out +24h; maximum 5 evidence files.
- [ ] `disputes`: Filing a dispute atomically freezes the scheduled settlement job for that booking.
- [ ] `disputes`: `PATCH /api/v1/admin/disputes/:id/resolve` — MVP outcomes: 100% customer refund or 100% nurse settlement release.
- [ ] `disputes`: Upheld dispute on cash booking deducts compensation from violating nurse's deposit.
- [ ] `notifications` (FR-NOTIF-01): Concurrent high-priority FCM push + in-app notification center + real-time WebSocket.
- [ ] `notifications`: Automatic SMS/ZNS fallback triggered when urgent notification remains unacknowledged after 60 seconds.

### Phase 6 Exit Criteria
- [ ] A dispute filed at hour 20 post-check-out successfully freezes settlement release scheduled for hour 24.
- [ ] Two-way blind rating lifecycle verified: reviews become visible only when both submit or 7 days elapse.
- [ ] SMS fallback notification fires reliably when FCM push delivery is unacknowledged after 60 seconds.
- [ ] In-app chat is strictly disabled prior to `CONFIRMED` status.

---

## Phase 7 — ADMIN: Catalog, Configuration & Reconciliation [MVP]

### FE-1 (Phase Lead)
- [ ] Admin Web — Service catalog management: create/edit services, configure invasive flag (`is_invasive`), prohibited flag (`is_prohibited`), required Tier.
- [ ] Admin Web — Dynamic `system_configs` parameter editor.
- [ ] Admin Web — User management: search, profile details, suspend/ban/reactivate customer and nurse accounts.
- [ ] Admin Web — Dispute investigation and adjudication console.
- [ ] Admin Web — Financial reconciliation dashboard and report export.
- [ ] Enforce mandatory 2FA authentication for all Admin Web Portal sessions.

### FE-2
- [ ] Support FE-1 with Admin Web credential review and dispute evidence queues.
- [ ] Conduct comprehensive accessibility audit across all nurse surfaces against Elder-Friendly criteria prior to UAT.

### BE-1 (Phase Lead)
- [ ] `admin-catalog` (FR-ADMIN-01): Service catalog CRUD supporting `is_invasive`, `is_prohibited`, `required_tier`.
- [ ] `admin-configs`: Dynamic configuration updates (§5.1) without code redeployment; every mutation writes an `audit_logs` record with `updated_by`.

### BE-2
- [ ] `admin-users`: User search and management; account locking/unlocking across `ACTIVE`, `SUSPENDED`, `BANNED`, strictly respecting `profile_status` as the sole authority for shift eligibility.

### BE-3
- [ ] `admin-finance` (CT-15): Reconciliation engine: total escrow held, total 15% platform commission, total payouts, total refunds, pending withdrawal requests.

### Phase 7 Exit Criteria
- [ ] Full operational day simulated exclusively via Admin Portal: verify nurse, resolve dispute, update config, export financial reconciliation.
- [ ] Zero manual database modifications required throughout operational simulation.
- [ ] Every Admin action generates a corresponding immutable record in `audit_logs`.

---

## Phase 8 — Hardening & MVP Readiness

### FE-1
- [ ] Cross-browser responsive audit for Patient Web and Admin Web across latest 2 versions of Chrome, Safari, Edge, Firefox.
- [ ] Remediate all customer-facing and backoffice UAT defects.

### FE-2
- [ ] Physical device compatibility verification on legacy hardware: Android 8.0 (API 26) and iOS 13.0.
- [ ] Confirm Nurse Mobile App production release binary footprint remains $< 50\text{ MB}$.
- [ ] Final Elder-Friendly UX audit and resolution of all nurse-facing UAT defects.

### BE-1
- [ ] Identity security hardening: rate-limiting against OTP brute-force, medical record access expiration enforcement, tier-gate bypass tests.
- [ ] Remediate all penetration testing findings within identity and profile domains.

### BE-2
- [ ] Concurrency and race condition testing on matching engine and background job queues.
- [ ] Disaster recovery drill: daily backup snapshot + PITR verification — RPO $\le 1\text{h}$ (wallets) / $\le 24\text{h}$ (logs), RTO $\le 4\text{h}$.
- [ ] Verify maintenance embargo: zero scheduled migrations or downtime during shift handover window 19:00–21:00.

### BE-3
- [ ] Financial concurrency verification: wallet race conditions, gateway webhook deduplication under high load.
- [ ] Operational monitoring and alerting: job queue backlog, webhook failures, unacknowledged SOS events, overdue cash commissions.
- [ ] Author standard incident runbooks in `docs/runbooks/`.
- [ ] Remediate all penetration testing findings within financial and ledger domains.

### Phase 8 Exit Criteria (Go-Live)
- [ ] All SRS v2.0 RTM matrix test suites passing (100% green).
- [ ] Zero unresolved Blocker or Critical defects.
- [ ] Independent penetration test completed with all Critical and High vulnerabilities remediated.
- [ ] Operational readiness drill successfully executed.
- [ ] Official MVP Go-Live Authorization signed off by Product Owner and QA Lead.

---

## Scope Excluded from MVP (Confirmed by Team)

- [ ] Long-term contract bidding and trial shifts (FR-BOOK-04) — Deferred to Product Phase 2.
- [ ] Long-term contract lifecycle: pause, mid-term replacement, early termination (FR-BOOK-05) — Phase 2.
- [ ] Pro-rata dispute adjudication producing `PARTIALLY_SETTLED` status (FR-DISP-02) — Phase 2 (enum exists in schema, but no MVP flow produces it).
- [ ] `partial-settlement` backend module — Not built in MVP.
- [ ] `contract-bidding` and `contract-lifecycle` backend modules — Not built in MVP.
- [ ] Periodic care packages or recurring subscription models — Out of scope.
- [ ] Elder-Friendly UI mode for Patient Mobile App — Deferred to Phase 2 (MVP mandatory only for nurse surfaces).
- [ ] Advanced biometric AI liveness detection for eKYC — Deferred to commercial scaling (MVP uses direct camera capture with server timestamp/GPS watermark).
- [ ] Licensed payment intermediary escrow integration — MVP uses platform simulated escrow (internal ledger + sandbox gateways); never marketed as licensed escrow.

---

## Pull Request Checklist (Mandatory for all phases)

- [ ] PR description specifies touched FR / CT / TC codes, development phase, and module.
- [ ] Zero hardcoded business values from §5.1; no status enums defined outside `packages/shared`.
- [ ] New/modified routes have backend authorization checks (including negative test suites: wrong Tier / wrong owner / expired access window → HTTP 403).
- [ ] Financial modifications: append-only ledger entries with `idempotency_key`; zero UPDATE/DELETE on `wallet_transactions`; deposit never used for commission; automated decisions emit `audit_logs`.
- [ ] Timers registered with the shared job queue engine, covered by fake-clock tests, and safe to re-run (idempotent).
- [ ] All module tests pass cleanly; financial, authorization, and tier-gate modules maintain $\ge 80\%$ decision-branch test coverage.
- [ ] Automated CI pipeline green: unit tests, PostgreSQL migration and schema constraint tests, secret scanning.
- [ ] PRs modifying authentication/OTP, authorization, tier-gate, financial logic, or medical records require sign-off from a security reviewer.
- [ ] Documentation updated in the same PR: module `README.md`, `docs/api/<module>.api.md` (if API contracts changed), and ADRs (if new technical decisions were introduced).

---

## Team Coordination Cadence in Each Phase

- [ ] **Phase Kick-off:** Backend module owner publishes API contract (`/api/v1/…`, sample requests/responses, domain error codes) in `docs/api/<module>.api.md` alongside sample mock data.
- [ ] **Mid-Phase:** Frontend builds views using mocks conforming to published contracts; Backend implements business logic and automated test suites per Test Strategy.
- [ ] **Contract Evolution:** Any unavoidable API contract modification must be communicated to Frontend team on the same business day.
- [ ] **Phase Conclusion:** Full end-to-end integration between Frontend and Backend on staging environment, execute Phase Exit Criteria, all 5 engineers formally sign off before proceeding to the next phase.
- [ ] **Blocker Protocol:** If any engineer is blocked by another for $> 1\text{ business day}$, escalate immediately during daily standup; never modify another domain's module without direct alignment with its owner.
