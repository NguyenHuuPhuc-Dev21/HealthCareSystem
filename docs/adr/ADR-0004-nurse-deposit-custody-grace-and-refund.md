# ADR-0004 — Nurse deposit: custody, progressive funding and refund

- **Status:** Proposed (FE-2 / Phúc, 16/11/2026) — becomes Accepted when the PO and BE-3 (money owner) approve the MR. Items marked *(OD-14…OD-16)* stay open until decided.
- **Date:** 2026-11-16
- **Related:** FR-PAY-03, FR-BOOK-03, FR-DISP-01, BR-04 §2.2, BR-12 §2.3, BR-18, SRS §2.3, §5.1, §5.2; migration `0008_nurse_deposit_grace_refund.sql`

## Context

The team confirmed on 16/11/2026 that the nurse deposit stays at **300,000 VND** (`MIN_NURSE_DEPOSIT`) as fixed by SRS v2.0. The deposit is the only way the platform can collect SLA penalties on **cash** bookings, where the platform never holds the customer's money. Without it, a penalised nurse could abandon the account and re-register.

A review raised three weaknesses in the current specification:

1. **Legal custody.** The platform itself holding users' money can be treated as an unlicensed payment intermediary under Vietnamese law (Decree 52/2024/NĐ-CP on non-cash payments — to be confirmed with a legal advisor before launch). BR-04 §2.1 already says commercial operation of the escrow must go through a State-Bank-licensed intermediary, but says nothing about the deposit.
2. **Onboarding friction.** Requiring 300,000 VND before the first shift loses newly approved nurses — especially fresh graduates (Tier 1) — before they have earned anything.
3. **Refund opacity.** SRS §2.3 fixes only the condition for getting the deposit back (account closed, 7 dispute-free days). Processing time, the amount actually returned when there is debt, and how a nurse can see and contest each deduction are unspecified (OD-11 partly).

## Decision

### D1 — Custody: the platform keeps a ledger, a licensed partner keeps the money

- Deposit money is received into and paid out of a **segregated custody account**: either an escrow account at a partner commercial bank, or a sub-wallet at a licensed intermediary (e-wallet / collection-and-payment service licensed by the State Bank of Vietnam). It never sits in the platform's operating account. *(Partner choice: OD-14.)*
- `wallets.deposit_balance` is a **mirror ledger** of that account. Every deposit movement (`TOPUP`, `DEPOSIT_WITHHOLD`, `PENALTY_DEDUCT`, `PENALTY_REVERSAL`, `DEPOSIT_REFUND`) stores the partner's reference in `wallet_transactions.external_ref`.
- A daily reconciliation job compares the sum of all `deposit_balance` values with the custody account statement; any difference raises an Admin alert and freezes deposit payouts until resolved (runbook "Wallet reconciliation").
- In the student project / demo scope the custody account is **simulated** (same as the escrow, SRS §1.3); the data model and flows are built as if the partner existed, so going live changes only the gateway adapter.
- The terms of service must state who holds the money, what it can be used for (SLA penalties only), and how it is returned.

### D2 — Progressive funding ("grace period") for new nurses

This replaces the sentence "No progressive accrual" in BR-04 §2.2.

- A nurse whose deposit is below `MIN_NURSE_DEPOSIT` may still accept jobs while in the **grace period**, under three limits:
  1. **Bank-transfer bookings only.** Cash bookings require a full deposit. On a transfer booking the platform already holds 100% of the price in escrow, so any penalty can be taken from the escrowed payout; the risk the deposit protects against does not exist yet.
  2. **At most `DEPOSIT_GRACE_MAX_SHIFTS` = 3** completed grace shifts.
  3. **Within `DEPOSIT_GRACE_DAYS` = 30** days of the nurse's profile first becoming `ACTIVE`.
- On each settled transfer booking while `deposit_balance < MIN_NURSE_DEPOSIT`, the settlement worker withholds `min(DEPOSIT_WITHHOLD_RATE × net payout, MIN_NURSE_DEPOSIT − deposit_balance)` from the nurse's 85% share and credits it to `deposit_balance` as a `DEPOSIT_WITHHOLD` transaction (two ledger rows, same idempotency root). `DEPOSIT_WITHHOLD_RATE` = 0.30.
  - *Worked example:* 500,000 VND shift → net 425,000 → withhold 127,500 → `available_balance` +297,500, `deposit_balance` 127,500. After three such shifts the deposit is 300,000 (the third withholds only the remaining 45,000).
- The nurse can top up the remainder at any time (VietQR, `TOPUP`), which ends the grace period early. A top-up may not take `deposit_balance` above `MIN_NURSE_DEPOSIT`.
- When the grace period ends (3 shifts used **or** 30 days passed) and the deposit is still short, the deposit gate applies as before: no new jobs until topped up; existing confirmed bookings are kept.
- Penalties during the grace period: deduct from `deposit_balance` first; the remainder is taken from that nurse's **unsettled escrowed payouts**; any remainder after that is booked as debt (`deposit_balance` negative), unchanged from BR-04.
- The urgent Radar (≤ 6 h) is treated like any job: grace nurses see transfer-paid Radar offers only.

### D3 — Refund on account closure, and transparency of deductions

- **Request:** the nurse requests closure in the app → a `deposit_refund_requests` row in status `REQUESTED`; the nurse immediately stops receiving new jobs (`wallets.closure_requested_at` set). The nurse may cancel the request while it is not yet `READY`.
- **Eligibility check (daily job + on demand):** the request moves to `READY` only when **all** hold:
  1. no booking of the nurse in `CONFIRMED` or `IN_PROGRESS`;
  2. at least `DEPOSIT_REFUND_HOLD_DAYS` = 7 days since the nurse's last `checkout_time` (SRS §2.3);
  3. no dispute on any of the nurse's bookings in `OPEN` or `UNDER_REVIEW`;
  4. no unpaid cash commission.
  While not eligible, the status is `WAITING_HOLD` and the app shows which condition is still pending and the earliest date it can clear.
- **Amount:** `refund = max(deposit_balance, 0)`. A negative balance (debt) is not refunded and is shown to the nurse as an amount still owed; `available_balance` is paid out first to clear the debt if the nurse agrees.
- **Payout SLA:** a `READY` request is paid to the nurse's registered bank account within `DEPOSIT_REFUND_SLA_WORKING_DAYS` = 5 working days, as one `DEPOSIT_REFUND` transaction carrying the custody partner's reference. Status `REFUNDED`. The Admin may reject only with a written reason (`REJECTED`), e.g. bank account mismatch; rejection never forfeits the money.
- **Every deduction is explained.** Each `PENALTY_DEDUCT` has one `deposit_penalty_details` row: reason code (`NURSE_LATE_CANCEL`, `NURSE_NO_SHOW`, `DISPUTE_UPHELD`), the SLA rule (e.g. "§5.2 row 7"), the booking, the dispute if any, and an appeal deadline.
- **Appeal:** the nurse may contest a deduction within `PENALTY_APPEAL_DAYS` = 3 days through the existing dispute channel. If the Admin upholds the appeal, a `PENALTY_REVERSAL` transaction credits the amount back (the original row is never edited — append-only). Penalties decided by a dispute ruling (`DISPUTE_UPHELD`) are not appealable a second time.
- The nurse is notified (push + in-app) for every deduction, withhold, reversal and refund status change.

## Consequences

- **Database:** migration `0008_nurse_deposit_grace_refund.sql` adds three `tx_type_enum` values, two enums, four `wallets` columns, `wallet_transactions.external_ref`, the tables `deposit_penalty_details` and `deposit_refund_requests`, and six `system_configs` keys. `0001` is untouched.
- **Shared package:** new config keys, `TxType` values and two enums in `packages/shared`.
- **Requirements:** FR-PAY-03, FR-BOOK-03 (eligibility gate), Annex A, BR-04 §2.2, BR-12 §2.3 and the Open Decisions register are updated in the same MR. The SRS §2.3 rule "7 dispute-free days" is kept unchanged; D2 is a deliberate deviation from BR-04's "no progressive accrual" and needs PO sign-off.
- **Matching (BE-2/BE-3):** the eligibility gate becomes "full deposit, **or** in grace period and the booking is `BANK_TRANSFER`".
- **Settlement worker (BE-3):** must perform the withhold in the same ACID transaction as the 85% credit.
- **Frontend (FE-2):** wallet screens show grace progress, withheld amounts, deduction reasons with an appeal button, and the closure / refund flow (plans W01, W02, A09, A10 and A07 updated).
- **Risk accepted:** a grace nurse can still no-show a transfer booking; the customer is refunded 100% from escrow as today, and the penalty is collected from that nurse's other escrowed payouts or booked as debt. Limiting grace to 3 shifts / 30 days caps this exposure.

## Alternatives considered

- **Drop the deposit, penalise by TrustScore only** — rejected 16/11/2026: no way to collect cash-booking penalties; a banned nurse can re-register.
- **Lower the deposit** — rejected: the SRS amount is fixed and already low.
- **Progressive funding on all bookings including cash** — rejected: a cash no-show in the first shift would be uncollectable.
