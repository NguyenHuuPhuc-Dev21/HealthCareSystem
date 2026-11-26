# Cash-Booking Commission (15%) — Overdue & Suspension

> BE-3 · module `cash-commission` · job `cash-commission.overdue-sweep` (every 5 min). Alert: `CASH_COMMISSION_OVERDUE`.

## What must stay true

- Cash booking checked out → `commission_due_at = checkout + CASH_COMMISSION_DUE_HOURS` (24, set by BE-2 check-out).
- The nurse pays the platform fee herself by VietQR code `HH…` (`POST /bookings/:id/commission-payment-link`).
  The webhook books one `COMMISSION_PAYMENT` row with **no balance change** and marks the booking `SETTLED`.
- **Never** take the commission from `deposit_balance` or `available_balance` (FR-PAY-03, BR-05).
- Past the deadline and unpaid → the sweep sets the profile `SUSPENDED` / `COMMISSION_OVERDUE` (no new jobs).
  Paying every overdue commission lifts it automatically (only that reason; an Admin or other suspension stays).

## Alert levels

- **WARN** — commissions are overdue: normal, nurses pay late. Admin follows up (`GET /admin/finance/nurse-debts`).
- **ALERT** — an overdue commission whose nurse is still `ACTIVE` 15 min after the deadline → the sweep is not
  running. Check the worker / `JOB_BACKLOG`; the sweep catches up on its next run (idempotent).

## "I paid but I am still suspended"

```sql
SELECT b.booking_code, b.commission_due_at, b.settled_at, p.payment_code, p.paid_at, p.provider_ref
  FROM bookings b LEFT JOIN commission_payments p ON p.booking_id = b.id
 WHERE b.nurse_id = '<nurse uuid>' AND b.payment_method = 'CASH' AND b.commission_due_at IS NOT NULL
 ORDER BY b.commission_due_at;
```

1. Another overdue booking still unpaid → she must pay that one too (the suspension lifts when none is left).
2. Paid but `paid_at` empty → find the transfer in `payment_webhook_events` by `provider_ref`:
   `AMOUNT_MISMATCH` (wrong amount: refund at the gateway, pay again exactly) · `UNKNOWN_COMMISSION` (wrong code in
   the transfer content) · no row (webhook not delivered: ask the gateway to re-deliver).
3. `COMMISSION_RETURNED` = paid twice; the second transfer is refunded at the gateway.
4. Suspended for another reason (`suspended_reason` ≠ `COMMISSION_OVERDUE`) → that owner's process
   (deposit top-up, TrustScore, Admin).

Chronic late payers → Admin account review (`admin-users`, FR-ADMIN-01).
