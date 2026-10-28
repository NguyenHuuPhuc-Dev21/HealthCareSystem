# Security Policy Group 6 — Concurrency & Business Logic Integrity

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (§2.2/§2.3 state machines, FR-BOOK-03, FR-PAY-02, FR-SHIFT-01/04/05, NFR-SEC-01) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | Time-Sensitive State Transitions, Race Conditions, Distributed Job Queues, Concurrency Controls |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |
| **Core Vulnerability Target** | Race conditions (Time-of-Check to Time-of-Use / TOCTOU), double-claiming, double settlement, duplicate refunds, state machine bypass. |

---

## Concurrency & Business Logic Rules

### SEC-6.1 [P0] Server-Authoritative Temporal Windows
All time-sensitive business windows are computed strictly against synchronized server time and executed by the job queue; clients never supply or manipulate timestamps. The governing windows (values from `system_configs`, SRS §5.1) are:
- **15-Minute Payment Window** (`PAYMENT_TIMEOUT_MINUTES = 15`): unpaid `DRAFT` bookings auto-transition to `EXPIRED` (TC-STATE-01).
- **Radar Dispatch Rounds:** Round 1 (minutes 0–5) notifies eligible nurses within 5 km; Round 2 (minutes 5–15) expands to 10 km (FR-BOOK-03).
- **Matching Expiry:** a booking still unmatched 30 minutes before shift start (or 30 minutes after creation for urgent bookings) becomes `EXPIRED` with a 100% refund if prepaid (§5.2 row 9).
- **24-Hour Settlement Cooling** (`SETTLEMENT_COOLING_HOURS = 24`): automatic release after check-out if no dispute (SEC-6.4).
- **24-Hour Commission Deadline:** cash-job commission unpaid after 24 hours suspends the nurse (SEC-6.5).
- **12-Hour Record Window:** medical-record access auto-revokes 12 hours after check-out (SEC-2.4).
- **15-Minute Direct-Request Window:** a nurse invited directly from search (FR-SEARCH-01) has 15 minutes to respond before the booking broadcasts on the Job Board.
- **Blind Review Window:** two-way reviews stay hidden until both sides submit or 7 days pass (`reviews.is_visible`, FR-RATE-01).

### SEC-6.2 [P0] Atomic Job Claiming & Schedule-Conflict Prevention (NFR-SEC-01)
- **First-come claiming:** Both matching mechanisms resolve contention atomically — a Redis distributed lock or `SELECT … FOR UPDATE` on the booking row guarantees exactly one nurse wins a claim; all concurrent losers receive a clean "already taken" response (FR-BOOK-03). Claim eligibility (SEC-2.3: tier, `profile_status`, deposit ≥ 300,000 VND) is re-validated **inside** the same locked transaction, never checked-then-claimed in separate steps.
- **Schedule conflicts:** a nurse's effective availability = `nurse_availabilities` (recurring + time-off exceptions) minus `CONFIRMED`/`IN_PROGRESS` bookings, with a **60-minute travel buffer** between shifts (FR-SCHED-01). The overlap check runs inside the claim transaction and, where expressible, is backed by a database exclusion constraint (ADR-0002), so two overlapping confirmations cannot coexist even under concurrent claims.
- **Check-in integrity:** check-in validates mock-location flag, ≤ 200 m Haversine distance, and live selfie in one atomic transition to `IN_PROGRESS` (FR-SHIFT-01); a rejected check-in changes no state.

### SEC-6.3 [P0] Strict Backend State Machine Validation
- Transitions are validated against the three independent booking axes (SRS §2.2), the nurse-profile lifecycle (§2.3), and the wallet lifecycle (§2.3) before execution. The backend checks the current state of **every affected axis** before permitting a transition.
- **Prohibition of lifecycle jumps:** out-of-order transitions (e.g., `DRAFT` → `COMPLETED`, settlement while `dispute_status = OPEN`, check-out before check-in) are rejected with HTTP `400 Bad Request` and recorded as anomalous events.
- State changes with money attached additionally require the SEC-5.4 idempotency key, so a retried transition cannot double-execute its financial effect.

### SEC-6.4 [P0] Exactly-Once Settlement & the Dispute Race
- The 24-hour settlement worker must be exactly-once per booking: it claims the booking row (`SELECT … FOR UPDATE` or an atomic status-guarded update) and re-checks, inside the transaction, that `execution_status = COMPLETED`, the cooling period has elapsed, and `dispute_status = NONE`.
- **The dispute race is normative:** if a customer opens a dispute at hour 20 after check-out, the settlement job running at hour 24 must **not** release the funds (TC-DISP-01). Opening a dispute atomically freezes the escrow (`dispute_status = OPEN`) before any release can interleave.
- The same exactly-once discipline applies to refunds, penalty deductions, urgent-bonus credits, and the no-show voucher issuance — one business decision, one ledger effect (SEC-5.4/5.5).

### SEC-6.5 [P0] OTP & Commission Deadline Races
- **OTP consumption:** verification of a login OTP is an atomic compare-and-consume; parallel verify attempts with the same code can succeed at most once, and failed-attempt counting cannot be bypassed by concurrency (SEC-1.2).
- **Commission deadline race:** when the 24-hour suspension timer and an in-flight commission payment webhook target the same booking, ordering is defined: a webhook whose gateway timestamp falls within the deadline settles the booking (`SETTLED`) and must lift/never-apply the commission-related suspension; a suspension applied in error by this race is reversed automatically and audit-logged. Deposit balances are never touched by this flow (SEC-5.7).

### SEC-6.6 [P1] SOS Channel Abuse Management Without Blocking Emergency Access
- **Non-Negotiable Safety Constraint:** The platform must **never block, throttle, or delay** an SOS trigger from an in-progress shift (FR-SHIFT-05). The app immediately opens the 115 dialer; simultaneously the system pushes an alert with live GPS location and the latest vital signs to the family and the Admin Portal (delivery target < 2 seconds, TC-SOS-01), with SMS fallback if push is unacknowledged (FR-NOTIF-01).
- Rate limiting may apply only to duplicate *notification fan-out*, never to SOS intake or logging. Suspected false SOS activations are handled afterwards by Admin review and account measures — never by gating the SOS function itself.

### SEC-6.7 [P1] Hardened Background Job Infrastructure as an Attack Surface
- Background workers (payment-timeout expiry, matching rounds and expiry, GPHN-expiry tier demotion, settlement release, commission-deadline suspension, record-access revocation, notification fallback) are critical failure vectors.
- All workers must be idempotent and guarded by distributed locks (e.g., Redis lock) or row-level claims so horizontal scaling never double-executes a job; money-moving jobs additionally obey SEC-5.4.
- Worker crashes, stalled queues, or unhandled exceptions must raise immediate operational alerts: a silently failing worker could leave escrow unsettled, an expired booking un-refunded, or a nurse's record access un-revoked past its 12-hour window.
