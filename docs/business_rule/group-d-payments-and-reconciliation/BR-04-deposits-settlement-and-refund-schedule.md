# BR-04: Deposit Wallet, Settlement & Refund Schedule

> **Group:** Group D — Payments, Refunds & Reconciliation  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** FR-PAY-01, FR-PAY-02, FR-PAY-03, FR-PAY-04, FR-BOOK-03, SRS §1.3, §2.2, §2.3, §5.1, §5.2  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version. **The 30% patient deposit model of the hospital baseline is abolished in full.** In SRS v2.0 the word "deposit" refers only to the **nurse's** upfront deposit wallet (§2.2); customers never pay a partial deposit — transfer bookings are prepaid at 100%.

---

## 1. Context & Business Intent

1. **Prepaid Transfer Bookings, Held by the Platform:** For `BANK_TRANSFER` bookings the customer prepays 100% before the shift and the platform holds the funds in a simulated escrow ledger per booking until settlement, so neither side can be left unpaid for a completed shift.
2. **A Deposit That Only Punishes, Never Pays:** The nurse's deposit wallet exists for exactly one purpose — absorbing SLA penalties. It is funded upfront, is never used for commission, and never limits the value of bookings a nurse may accept.

---

## 2. Rule Specifications

### 2.1 Prepayment & Escrow Holding (FR-PAY-01)

- Every booking declares `payment_method` (`BANK_TRANSFER` | `CASH`) at creation.
- **BANK_TRANSFER:** The customer pays **100% of the booking price** in advance via the sandbox payment gateway (PayOS / VNPay / VietQR). The booking sits in `execution_status = DRAFT` for up to **15 minutes** (config `PAYMENT_TIMEOUT_MINUTES`); on a verified payment webhook the funds are locked per booking (`payment_status = ESCROW_HELD`, `escrow_locked_balance`). Webhooks are authenticated by **HMAC-SHA256** signature and processed **idempotently** (`wallet_transactions.idempotency_key` is UNIQUE) — a replayed webhook returns HTTP 200 but never credits twice (SRS §9).
- If payment does not complete within 15 minutes, the booking becomes `EXPIRED` (SRS §5.2 row 9).
- **CASH:** Nothing is prepaid and nothing is held; the customer pays the nurse 100% in cash at shift end (commission handling: BR-05).
- The escrow is a **simulated escrow / internal ledger** in the current project scope (SRS §1.3); commercial operation must route the flow through a State-Bank-licensed payment intermediary.

### 2.2 Nurse Upfront Deposit Wallet (FR-PAY-03)

- **Upfront funding:** Before accepting any booking, the nurse must hold `deposit_balance ≥ 300,000 VNĐ` (config `MIN_NURSE_DEPOSIT`). This gate applies to **both** matching mechanisms (FR-BOOK-03). A nurse below the threshold who attempts to accept a booking is blocked (HTTP 403, SRS §10 TC-WALLET-01).
- **No progressive accrual, no value cap:** The deposit is **not** accumulated from earnings, and there is **no cap** linking booking value to deposit balance.
- **Single permitted use:** `deposit_balance` is debited **only** for SLA penalties, via transactions of type `PENALTY_DEDUCT` (see BR-18). It is **never** used to collect the 15% commission of cash bookings (BR-05).
- **Shortfall → debt:** If a penalty exceeds the deposit balance, the shortfall is booked as debt and offset against the nurse's later income.
- **Below-minimum lock:** After a penalty deduction leaves `deposit_balance < 300,000 VNĐ`, the nurse is locked from new bookings (`profile_status = SUSPENDED`) until the deposit is topped back up (SRS §2.3).
- **Withdrawal:** Deposit funds are withdrawable in full only when the nurse ends the cooperation and closes the account, after **7 days** with no open dispute (SRS §2.3).

### 2.3 Settlement (FR-PAY-02)

- **Transfer bookings:** Settlement runs **exactly 24 hours after `checkout_time`** (config `SETTLEMENT_COOLING_HOURS = 24`), or earlier if the customer taps "Confirm completion". If `dispute_status = NONE` at that moment, the worker deducts the **15% platform commission** (config `PLATFORM_COMMISSION_RATE = 0.15`) and credits the remaining **85%** to the nurse's `available_balance`; `payment_status` becomes `SETTLED`. If a dispute is `OPEN`, the settlement worker must not release the funds (BR-11).
  - *Worked example (SRS §10, TC-WALLET-01):* a settled 500,000 VNĐ transfer shift pays the nurse 500,000 × 85% = **425,000 VNĐ** into `available_balance`.
- **Cash bookings:** There is no escrow to release; the booking becomes `SETTLED` when the nurse's self-paid commission is confirmed (BR-05 §2.3).
- **Withdrawals (FR-PAY-04):** The nurse withdraws from `available_balance` to a bank account (`WITHDRAW_REQUESTED → WITHDRAWN`) under ACID transaction + row lock; withdrawal above `available_balance` is rejected (HTTP 400).

### 2.4 Cancellation & Refund Schedule (SRS §5.2)

Refund percentages below apply to **transfer bookings** (money already held). For **cash bookings** nothing was prepaid, so no refund arises; nurse SLA fines are still deducted from the deposit wallet, customer cancellation fees are **not** collected through the system, and the booking is simply released and recorded in the customer's cancellation history (SRS §5.2 applicability note).

| # | Scenario | Outcome |
| :--- | :--- | :--- |
| 1 | Customer cancels, Δt > 12h before start | **100% refund** (`REFUNDED`); nurse's schedule released |
| 2 | Customer cancels, 2h ≤ Δt ≤ 12h | **80% refund**; 15% of booking value to the nurse (schedule-holding compensation), 5% to the platform |
| 3 | Customer cancels, Δt < 2h (not yet checked in) | **50% refund**; 40% to the nurse (travel & lost-shift compensation), 10% to the platform |
| 4 | Customer stops the shift after check-in | Pay actual hours worked (min 1h); task-based full completion = full price; **100% refund of unused time**; no penalty (see BR-16) |
| 5 | Customer cancels for medical force majeure (ICU transfer/death, documented) | **100% refund of unused amounts, no penalty**; platform pays the nurse fixed **50,000 VNĐ** travel support (`ICU_TRAVEL_SUPPORT`) if the nurse already travelled |
| 8 | Nurse no-show, no replacement found | **100% refund** + 50,000 VNĐ customer voucher funded by the nurse's deposit fine (see BR-02, BR-18) |
| 9 | Payment timeout (15 min) / matching timeout | Booking `EXPIRED`; **100% refund** of any amount held |

Nurse-side cancellation fines (deposit deductions and TrustScore effects) are specified in BR-02 / BR-18.

### 2.5 Reconciliation (FR-ADMIN-01)

Admin reconciliation reports cover: total escrow held, total platform commission (15%), total amounts settled to nurses, total refunds, and pending withdrawal requests. The hospital baseline's four-bucket deposit reconciliation and its deposit-forfeiture category do not exist in this model.

---

## 3. Traceability & Dependencies

- **SRS References:** FR-PAY-01…FR-PAY-04, FR-BOOK-03; SRS §1.3 (Simulated Escrow, Upfront Deposit), §2.2, §2.3, §5.1 (configs `PAYMENT_TIMEOUT_MINUTES`, `SETTLEMENT_COOLING_HOURS`, `MIN_NURSE_DEPOSIT`, `ICU_TRAVEL_SUPPORT`), §5.2, §9 (webhook security)
- **APIs:** `POST /api/v1/payments/escrow-webhook`; `POST /api/v1/wallets/withdraw`; `POST /api/v1/bookings/:id/commission-payment-link`
- **Related Rules:** BR-05 (commission & cash), BR-18 (penalties & adjudication), BR-02 (cancellations), BR-16 (early stop), BR-11 (dispute freeze)
