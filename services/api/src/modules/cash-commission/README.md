# cash-commission (BE-3 · Phase 5)

On a **cash** booking the customer pays the nurse on site; the nurse then self-transfers the platform commission
(the booking's `platform_fee`, 15%) before `bookings.commission_due_at` (check-out + 24h, set by BE-2's check-out).
FR-PAY-02 (cash part) · BR-05. Contract: [`docs/api/cash-commission.api.md`](../../../../../docs/api/cash-commission.api.md) ·
migration `0021_cash_commission.sql`.

| File | Role |
|---|---|
| `cash-commission.types.ts` | rows, outcomes, job name, suspension reason |
| `cash-commission.policy.ts` | pure: `HH…` payment code, status (UNPAID / OVERDUE / PAID), sort |
| `cash-commission.repo.ts` | SQL: debts, payment codes, suspend / reactivate |
| `cash-commission.ledger.ts` | `confirmCommissionPayment` — called by the escrow webhook in its transaction |
| `cash-commission.service.ts` | list, payment link, dev simulator, overdue sweep |
| `cash-commission.routes.ts` | `GET /nurse/commission-debts`, `POST /bookings/:id/commission-payment-link` (+ dev `confirm-commission`) |
| `cash-commission.jobs.ts` | `cash-commission.overdue-sweep` every 5 minutes |

## Rules

- **Never from the deposit or the available balance.** The payment is one `COMMISSION_PAYMENT` ledger row whose
  `balance_before = balance_after` (the nurse pays from her own bank account), `external_ref` = gateway reference,
  key `commission:<bookingId>`. The nurse sees it as `-amount` in her history.
- One payment code per booking (`HH` + 12 characters), to the platform's receiving account (`PAYMENT_RECEIVING_*`).
  Paid → booking `payment_status = SETTLED`, `settled_at`.
- Webhook outcomes: `COMMISSION_PAID`, `DUPLICATE` (same reference), `COMMISSION_RETURNED` (paid twice — the second
  transfer goes back), `AMOUNT_MISMATCH` (nothing moves), `UNKNOWN_COMMISSION`.
- Overdue (deadline passed, unpaid) → ACTIVE nurse becomes `SUSPENDED` with `suspended_reason = 'COMMISSION_OVERDUE'`
  (no new jobs: matching requires ACTIVE). When the last overdue commission is paid, that suspension — and only that
  one — is lifted back to `ACTIVE`.
- Also used elsewhere: wallets-ledger shows `COMMISSION_OVERDUE` on the wallet banner; deposits counts an unpaid
  commission as `UNPAID_COMMISSION` before refunding a deposit.

## For BE-2 (check-out)

Set `bookings.commission_due_at = checkout_time + 24h` on a cash booking at check-out (status `COMPLETED`). Nothing else.
