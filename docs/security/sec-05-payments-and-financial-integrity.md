# Security Policy Group 5 — Payments, Escrow Ledger & Gateway Webhooks

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (FR-PAY-01…04, §2.3 wallet lifecycle, §5 SLA/configs, §9.1 gateway integration) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | Payment Gateway Integrations (PayOS / VNPay / VietQR, sandbox in MVP), Prepayment Holding (Escrow), Settlement, Cash-Job Commission, Nurse Deposits, Withdrawals, Reconciliation |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |
| **Compliance Scope** | PCI-DSS Scope Minimization (Zero Cardholder Data Environment) & Anti-Fraud Controls. In the MVP the escrow is a **simulated** internal ledger over a sandbox gateway (SRS §1.3, CT-06); commercial operation must route held funds through a State-Bank-licensed payment intermediary. |

---

## Payments & Financial Integrity Rules

### SEC-5.1 [P0] Zero Cardholder Data Environment (PCI Scope Minimization)
- The platform maintains a **zero cardholder data footprint**: all card/banking interaction happens inside the gateway's hosted checkout, redirect, or VietQR flow. Platform servers and databases store only gateway transaction references, amounts, and status.
- Logging, persisting, or transmitting Primary Account Numbers (PAN), CVV/CVC codes, or card expiration dates anywhere in platform infrastructure is strictly prohibited.
- Bank account details supplied for withdrawal payout (FR-PAY-04) are Class B data (SEC-3.1): masked on display, never written to logs.

### SEC-5.2 [P0] Server-Authoritative Financial Computation
- All amounts — booking total, night/holiday/heavy-patient surcharges, the 15% platform commission (`PLATFORM_COMMISSION_RATE = 0.15`), penalties, refunds — are computed **exclusively** by the backend from `service_categories` and `system_configs` (SRS §5.1). No business number is hard-coded (SEC-0.7).
- Any amount submitted by a client is an untrusted assertion, cross-checked against the server computation; a mismatch rejects the operation. This applies equally to the commission amount on a cash job: it is 15% of the **in-app booking price**, whatever the parties actually exchanged in cash (tips paid above the app price are outside commission scope — FR-PAY-01).

### SEC-5.3 [P0] Cryptographic Webhook Verification & Anti-Replay Safeguards
- Inbound payment notifications (`POST /api/v1/payments/escrow-webhook`, and commission-payment confirmations) are accepted **only** after HMAC-SHA256 signature verification recomputed from the raw payload plus the gateway secret (SRS §9.1). A signature mismatch is rejected with **HTTP `401`** and produces no state change (TC-PAY-01).
- Gateway secrets live in the centralized secret store (SEC-8.2), never in source code or client packages.
- Anti-replay: the gateway transaction reference doubles as the idempotency key (SEC-5.4); re-deliveries are acknowledged (HTTP `200`) without re-executing (TC-PAY-02). Timestamp-window validation of signed payloads is applied where the gateway supports it *(retained engineering standard — not specified in SRS v2.0)*.

### SEC-5.4 [P0] Idempotency Across All Financial Transactions
- Every wallet movement is recorded in `wallet_transactions` with a **unique `idempotency_key`** (UNIQUE constraint). Gateway webhooks use the gateway's transaction code as the key (SRS §9.1).
- Network retries, duplicate webhook deliveries, or repeated user clicks must result in **exactly one** financial execution: five deliveries of the same webhook create exactly one `ESCROW_HOLD` (TC-PAY-02).
- Refunds execute exactly once per authorized refund outcome (SLA matrix row or Admin dispute decision), enforced by the same unique-key mechanism plus the booking's `payment_status` state check (SEC-6.3).

### SEC-5.5 [P0] Immutable Append-Only Wallet Ledger
- `wallet_transactions` is an append-only ledger (SRS §7, table 9): each entry records `tx_type` (`TOPUP`, `ESCROW_HOLD`, `ESCROW_RELEASE`, `COMMISSION_PAYMENT`, `PENALTY_DEDUCT`, `URGENT_BONUS`, `REFUND`, `PARTIAL_SETTLE`, `WITHDRAW`), amount, `balance_before`, and `balance_after`.
- In-place `UPDATE` or `DELETE` of ledger rows is blocked at the database level (permissions/triggers). Corrections happen only via compensating entries that reference the original transaction, the policy justification (SLA row / dispute decision), and the authorizing actor.
- The three wallet compartments stay strictly separated (`available_balance`, `escrow_locked_balance`, `deposit_balance`); no code path may net them against each other implicitly.

### SEC-5.6 [P0] Escrow Holding & Settlement Accounting (Bank-Transfer Bookings)
- On successful prepayment, the booking's funds are locked as `ESCROW_HELD` against that booking (SRS §2.2) — held funds are attributable per booking, never pooled anonymously.
- Release happens only via FR-PAY-02: customer early confirmation, **or** automatic settlement exactly 24 hours after `checkout_time` (`SETTLEMENT_COOLING_HOURS = 24`) when `dispute_status = NONE` — deducting the 15% commission and crediting 85% to the nurse's `available_balance`. A dispute opened at any point before release freezes the funds (SEC-6.4).
- Refunds follow the SRS §5.2 SLA matrix exactly (100% / 80% / 50% tiers, force-majeure 100%, no-match expiry 100%) and are executed from the held funds of that booking; partial settlement (`PARTIALLY_SETTLED`) exists only after an Admin dispute decision and only in Phase 2 (FR-DISP-02).

### SEC-5.7 [P0] Deposit Integrity (Nurse Deposit Wallet)
- The deposit is an **upfront** deposit: `deposit_balance ≥ 300,000 VND` (`MIN_NURSE_DEPOSIT`) is required before a nurse can claim any job; there is no progressive deduction from earnings and no job-value cap (FR-PAY-03).
- `deposit_balance` may be debited **only** by `PENALTY_DEDUCT` for SLA penalties (late cancellation 20% of job value; no-show 50,000 VND `NO_SHOW_PENALTY`, converted into the customer's apology voucher). If a penalty exceeds the deposit, the balance may go negative as recorded debt, recovered from future earnings, and the nurse is `SUSPENDED` from claiming until topped back up to 300,000 VND.
- **Absolute prohibition:** the deposit must never be used to collect the 15% commission of a cash job, nor netted against `available_balance` for that purpose (FR-PAY-02/03, TC-WALLET-01).
- Deposit funds are withdrawable only in full, when the nurse ends cooperation and closes the account, after 7 dispute-free days (SRS §2.3).

### SEC-5.8 [P0] Cash-Job Commission Flow
- Cash bookings never enter escrow: the customer pays the nurse 100% in cash at shift end, and the booking's `payment_status` stays `UNPAID` until the commission is received.
- At check-out the system computes 15% of the in-app price and issues a VietQR / payment link (`POST /api/v1/bookings/:id/commission-payment-link`) on the Nurse Web Portal and Mobile App. The nurse self-transfers the commission; receipt is confirmed by gateway webhook (SEC-5.3) and recorded as a `COMMISSION_PAYMENT` transaction, moving the booking to `SETTLED`.
- If the commission is not received within **24 hours** of check-out, the nurse's `profile_status` becomes `SUSPENDED` (no new jobs) until paid (FR-PAY-02, SRS §2.3). The commission deadline race (payment in flight vs. suspension timer) is governed by SEC-6.5.
- For cash jobs there is no customer refund path (no funds were held); if a dispute is resolved against the nurse (`RESOLVED_CUSTOMER`), the customer compensation is deducted from the nurse's deposit as an SLA penalty (FR-DISP-01) — still never as a commission collection.

### SEC-5.9 [P0] Withdrawal Integrity & Segregation of Duties
- Withdrawals (`POST /api/v1/wallets/withdraw`) execute under an ACID transaction with row locking on the wallet: the amount must be `≤ available_balance` at lock time, otherwise the request is rejected (HTTP `400`, TC-WITHDRAW-01). The flow is `WITHDRAW_REQUESTED` → Admin/gateway payout approval → `WITHDRAWN` (FR-PAY-04).
- Only `available_balance` is withdrawable in normal operation; `escrow_locked_balance` and `deposit_balance` are never withdrawable through this endpoint (deposit release follows SEC-5.7 only).
- The Admin approving a withdrawal or resolving a money-moving dispute is recorded (`resolved_by`, `audit_logs`) and cannot be the same unattributed system action that created the request *(segregation-of-duties detail is a retained engineering standard — not specified in SRS v2.0)*.

### SEC-5.10 [P1] Reconciliation & Financial Reporting
- Admin reporting (FR-ADMIN-01) must be able to produce, per period: total escrow held, total platform commission (15%), total payouts, total refunds, and the list of pending withdrawals — all derivable from the append-only ledger alone.
- An automated scheduled reconciliation compares the internal ledger against gateway settlement records; discrepancies (missing holds, unrecorded refunds, fee variance) raise critical alerts, write an audit record, and freeze the affected balance pending finance review *(retained engineering standard — not specified in SRS v2.0; daily cadence recommended)*.
