# Operational Playbooks & Incident Runbooks

> **Specification Baseline:** SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version (the former F7/F8/BR-10/BR-23 playbooks belong to the retired hospital model and no longer apply)

This index lists the standard operating runbooks for the on-demand nursing marketplace. Each entry states the runbook's purpose, its trigger, and the key steps grounded in SRS v2.0; the linked file carries the full procedure. Money-affecting steps must always respect two invariants: the nurse deposit wallet is used **only** for SLA penalties (`PENALTY_DEDUCT`), never for commission; and no wallet balance changes without an append-only `wallet_transactions` entry protected by its `idempotency_key`.

---

## 1. `payment-webhook-failure.md` — Payment Webhook Failures & Escrow Locking

- **Purpose:** Restore correct escrow state when gateway webhooks fail, arrive duplicated, or are rejected, so prepaid (BANK_TRANSFER) bookings are neither double-credited nor stuck unpaid.
- **Trigger:** Webhook error-rate alert; bookings stuck in `DRAFT`/`UNPAID` past the 15-minute payment window despite a successful customer payment; signature-verification (HTTP 401) spikes.
- **Key steps:**
  1. Verify the HMAC-SHA256 signature path first — a mismatch must stay rejected (HTTP 401, no balance change); never bypass signature checks to "unblock" payments (SRS §9).
  2. For redelivered webhooks, confirm deduplication by `idempotency_key` (gateway transaction id, UNIQUE in `wallet_transactions`): a repeat delivery returns HTTP 200 and must not create a second `ESCROW_HOLD`.
  3. Reconcile affected bookings against the gateway statement; only bookings with a confirmed successful payment may move to `ESCROW_HELD` and enter Matching.
  4. Bookings that genuinely exceeded `PAYMENT_TIMEOUT_MINUTES = 15` without payment stay `EXPIRED`; do not resurrect them — the customer rebooks.

## 2. `settlement-job-monitoring.md` — 24h Settlement Job Monitoring

- **Purpose:** Guarantee the automatic settlement worker releases bank-transfer earnings exactly once, at the right time, and never for disputed bookings.
- **Trigger:** Daily operations check; alert on settlement-job failures, backlog growth, or bookings remaining `ESCROW_HELD` more than 24 hours after check-out.
- **Key steps:**
  1. Confirm the worker's eligibility rule per booking: customer early-confirmed completion, OR `checkout_time + SETTLEMENT_COOLING_HOURS (24)` reached with `dispute_status = NONE`.
  2. For any booking with `dispute_status = OPEN`/`UNDER_REVIEW`, verify the escrow freeze held — the job must skip it until an Admin resolution exists (FR-DISP-01).
  3. Verify the split on settled samples: 15% platform commission (`PLATFORM_COMMISSION_RATE`), 85% credited to the nurse's `available_balance`, one ledger entry per movement.
  4. Escalate any double-release or missed-release to the reconciliation runbook (§7) before manual correction; corrections are new compensating ledger entries, never edits to existing rows.

## 3. `cash-commission-overdue.md` — Cash-Booking Commission Collection

- **Purpose:** Track the nurse's self-payment of the 15% commission on CASH bookings and the resulting account suspensions.
- **Trigger:** Cash booking checked out more than 24 hours ago with no confirmed `COMMISSION_PAYMENT`; nurse reports being `SUSPENDED` after paying.
- **Key steps:**
  1. Confirm the commission was computed on the **in-app booking price** (tips paid outside the app price are never commissioned) and that a VietQR/Payment Link was generated via `POST /api/v1/bookings/:id/commission-payment-link`.
  2. Match incoming gateway payments to bookings by `idempotency_key`; on full receipt the booking becomes `SETTLED`.
  3. If the 24-hour deadline passed unpaid, verify the automatic `SUSPENDED` (no new jobs) was applied; lift it only after full payment is confirmed — never by deducting the deposit wallet or `available_balance` (both are prohibited for commission).
  4. Report chronic late payers to Admin for account review (TrustScore/profile actions remain an Admin decision per FR-ADMIN-01).

## 4. `dispute-handling.md` — Dispute Intake & Adjudication Support

- **Purpose:** Support Admin adjudication of shift disputes with complete, untampered evidence within the 24-hour dispute window.
- **Trigger:** `dispute_status` becomes `OPEN`; a party reports missing evidence; a disputed booking approaches its settlement deadline.
- **Key steps:**
  1. Confirm the escrow freeze engaged at `OPEN` (bank-transfer bookings) and note that cash bookings have no held funds — nurse-side compensation on `RESOLVED_CUSTOMER` comes from the deposit wallet (FR-DISP-01).
  2. Assemble the evidence pack: GPS/check-in logs and selfie record (`shift_logs`), clinical shift log, in-app chat/call logs (`conversations_messages`), and the medical-record access audit trail; if the nurse's 12-hour record-access window has closed, an Admin re-grant must be time-boxed and audit-logged (FR-PRIV-01).
  3. Record the resolution outcome exactly as decided (`RESOLVED_CUSTOMER` → 100% refund; `RESOLVED_NURSE` → 100% release; partial splits are Phase 2 — FR-DISP-02) and verify the resulting `payment_status` and any `PENALTY_DEDUCT`/TrustScore effects.
  4. Check downstream effects: SLA matrix penalties (Annex B of the FRS), voucher issuance for no-show cases, and rating visibility (`is_visible` after both sides submit or 7 days).

## 5. `sos-response.md` — Emergency (SOS) Response

- **Purpose:** Ensure the platform's support role in a medical emergency works — the app assists, it never replaces the 115 emergency call.
- **Trigger:** SOS alert received on the Admin Portal; alert delivery failure or delay beyond the < 2-second target (SRS §10, TC-SOS-01).
- **Key steps:**
  1. Confirm the on-site priority was followed: the nurse/person present calls **115** and starts first aid; the app only dials 115 on the device, sends alerts and logs (FR-SHIFT-05).
  2. Verify the alert reached the Family and Admin Portal (Push + SMS fallback) with GPS coordinates and the patient's latest vital signs; if Push was unacknowledged within 60 seconds, confirm SMS/Zalo ZNS fallback fired (FR-NOTIF-01).
  3. Open the incident record from `shift_logs.emergency_incident_log`; coordinate family/Admin follow-up and preserve all logs for later review.
  4. If the patient is transferred to ICU/emergency, apply SLA row 5 for the booking (100% refund of the unused amount; fixed 50,000 VND `ICU_TRAVEL_SUPPORT` if the nurse travelled).

## 6. `gphn-expiry-sweep.md` — GPHN Expiry Sweep & Tier Changes

- **Purpose:** Operate and verify the daily GPHN expiry job that demotes Tier 2 nurses and the re-upgrade path after renewal.
- **Trigger:** Daily job report; nurse reports an unexpected demotion; an invasive booking is found assigned to a Tier 1 nurse.
- **Key steps:**
  1. Review the sweep output: every nurse whose `gphn_expiry_date` has passed without an approved renewal must be demoted `TIER_2_SPECIALIST → TIER_1_BASIC` with the profile remaining `ACTIVE` (FR-AUTH-02).
  2. Verify already-`CONFIRMED` invasive bookings scheduled after the expiry date were auto-cancelled without penalty and re-dispatched; notify affected customers.
  3. For renewals: nurses upload the new GPHN via `PUT /api/v1/nurse/credentials/gphn`; after Admin approval (`PATCH /api/v1/admin/nurses/:id/verify`) the re-upgrade to `TIER_2_SPECIALIST` must be automatic — investigate any profile still Tier 1 with an approved, valid GPHN.
  4. Audit-log check: every approval/demotion must have a corresponding `audit_logs` entry (`APPROVE_GPHN`).

## 7. `deposit-and-wallet-reconciliation.md` — Deposit, Penalty & Wallet Reconciliation

- **Purpose:** Keep the three wallet compartments (`available_balance`, `escrow_locked_balance`, `deposit_balance`) provably consistent with the ledger, and enforce the deposit rules.
- **Trigger:** Daily reconciliation job; any mismatch between wallet balances and the sum of `wallet_transactions`; nurse locked out of jobs unexpectedly.
- **Key steps:**
  1. Recompute each wallet from the append-only ledger; investigate any wallet whose stored balance differs — corrections only via compensating entries.
  2. Verify deposit gates: nurses with `deposit_balance < 300,000 VND` (`MIN_NURSE_DEPOSIT`) after a `PENALTY_DEDUCT` must be blocked from new jobs until topped up; penalty shortfalls must appear as recorded debt offset against later income (FR-PAY-03).
  3. Verify no commission was ever taken from `deposit_balance`: cash commissions exist only as `COMMISSION_PAYMENT` transactions initiated by the nurse (see §3).
  4. Reconcile platform totals for the period — escrow received, commission earned (15%), amounts released, refunds, pending withdrawals (`WITHDRAW_REQUESTED`) — against the Admin financial report (FR-ADMIN-01).

## 8. `booking-expiry-noshow-dispatch.md` — Booking Expiry, Refunds & No-Show Dispatch

- **Purpose:** Handle the automated end-of-life paths for unmatched, unpaid and no-show bookings, including replacement dispatch.
- **Trigger:** Spike in `EXPIRED` bookings; a shift start passes with no check-in; customer reports a no-show.
- **Key steps:**
  1. Payment timeout: bookings unpaid after 15 minutes become `EXPIRED` with no penalty; matching expiry (no nurse 30 minutes before start) becomes `EXPIRED` with an automatic 100% refund if funds were held (`ESCROW_HELD → REFUNDED`) plus a customer apology notification (SLA row 9).
  2. Nurse late cancellation (≤ 12h): confirm the 20%-of-shift-value deposit penalty, −20 TrustScore, and that the penalty was added to the booking as an Urgent Bonus pushed into SOS Dispatch for a replacement (SLA row 7).
  3. No-show (30 minutes past start, no arrival): run SOS Dispatch for a replacement; if none is found, apply SLA row 8 — nurse `BANNED` from the first offence, 50,000 VND `NO_SHOW_PENALTY` deducted from the deposit (debt if insufficient) and converted in full into the customer's voucher, 100% refund for bank-transfer bookings.
  4. Sanity-check side effects: released nurse schedules, matching state returned correctly, and all state changes visible on the booking's three status axes.
