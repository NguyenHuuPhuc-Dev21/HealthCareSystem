# Booking Expiry, Refunds & No-Show Dispatch

> BE-3 · module `booking-expiry` (jobs `booking-expiry.payment-timeout`, `booking-expiry.sweep` every minute).
> No-show replacement and penalties: BE-2 `matching-radar` / BE-1 `cancellation-policy` (SLA rows 7–8).

## Expiry (BE-3)

| Case | Rule | Money |
|---|---|---|
| Payment timeout | `BANK_TRANSFER` booking still `UNPAID` at `hold_expires_at` (created + `PAYMENT_TIMEOUT_MINUTES` 15) | none was held → `EXPIRED`, no penalty |
| Unmatched before start | `MATCHING` with no nurse `UNMATCHED_EXPIRY_LEAD_MINUTES` (30) before start | held escrow refunded 100% (`REFUND`) → `REFUNDED`, customer notified `BOOKING_EXPIRED` |
| Urgent unmatched | Radar booking without a nurse `URGENT_UNMATCHED_EXPIRY_MINUTES` (30) after matching started | same |
| Late payment | money arrives after expiry | webhook books and refunds it in full (`LATE_PAYMENT_REFUNDED`) — see `payment-webhook-failure.md` |

Expired bookings are never resurrected: the customer rebooks.

### "Many bookings expired at once"

1. Was matching healthy (nurses online, Radar job running — `JOB_BACKLOG`)? A stopped worker means timers fire late
   when it restarts, all together.
2. Refunds: every refunded booking has exactly one `REFUND` row (`escrow-refund:<booking>`):

```sql
SELECT b.booking_code, b.execution_status, b.payment_status, count(t.*) FILTER (WHERE t.tx_type = 'REFUND') AS refunds
  FROM bookings b LEFT JOIN wallet_transactions t ON t.booking_id = b.id
 WHERE b.execution_status = 'EXPIRED' AND b.updated_at > now() - interval '1 day'
 GROUP BY b.id ORDER BY b.updated_at DESC;
```

3. `REFUNDED` with 0 refund rows, or `ESCROW_HELD` + `EXPIRED` → incident (`deposit-and-wallet-reconciliation.md`).

## No-show (owned by BE-2 / BE-1 — summary)

- 30 min past start, no check-in → SOS Dispatch for a replacement (matching-radar).
- Nurse late cancellation ≤ 12 h (row 7): 20% deposit penalty, −20 TrustScore, Urgent Bonus on the replacement.
- No replacement (row 8): nurse `BANNED`, `NO_SHOW_PENALTY` from the deposit (debt if short) as the customer's
  voucher, 100% refund of a transfer booking.
- BE-3 side to verify: one `PENALTY_DEDUCT` (with `deposit_penalty_details`), one `REFUND`, deposit debt visible in
  `GET /api/v1/admin/finance/nurse-debts`.
