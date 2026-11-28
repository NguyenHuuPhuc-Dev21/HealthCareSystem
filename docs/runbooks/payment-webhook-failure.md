# Payment Webhook Failures & Escrow

> BE-3 · modules `gateway-webhooks`, `deposits` (top-up "KQ…"), `cash-commission` ("HH…"), `shift-extend` (`-GH<n>`),
> `shift-logs` (`-PT<n>`, BE-2). Alert: `WEBHOOK_FAILURES` (`monitoring-and-alerts.md`).

## How it works (what must stay true)

- `POST /api/v1/payments/escrow-webhook` verifies the HMAC signature first: a bad signature → **401, nothing changes**.
  Never disable the check to unblock payments.
- Every verified webhook writes one append-only `payment_webhook_events` row with its outcome — even duplicates.
- Money moves only through `wallet_transactions`, keyed by the gateway reference (`escrow-hold:<reference>`):
  a re-delivered webhook is `DUPLICATE` and books nothing (`finance-concurrency.test.ts` §1).
- Routing by `orderCode`: `HH…` cash commission · `KQ…` deposit top-up · `<code>-GH<n>` extension · `<code>-PT<n>`
  surcharge · otherwise the booking code.

## Outcomes and what to do

| Outcome | Meaning | Action |
|---|---|---|
| `HELD` | paid in time → escrow held, booking enters matching | none |
| `DUPLICATE` | same reference again | none (expected under retries) |
| `LATE_PAYMENT_REFUNDED` | paid after the 15-min hold: booked and refunded in full, booking `EXPIRED` | tell the customer to rebook; nothing to fix |
| `EXTRA_PAYMENT_REFUNDED` | a second transfer for a booking already paid: refunded in full | none |
| `AMOUNT_MISMATCH` | amount ≠ booking total: **nothing moved** | contact the customer; refund the transfer at the gateway; they pay the exact amount |
| `NOT_TRANSFER_BOOKING` | money for a cash booking: nothing moved | refund at the gateway |
| `UNKNOWN_BOOKING` / `UNKNOWN_EXTENSION` / `UNKNOWN_SURCHARGE` / `UNKNOWN_COMMISSION` | code matches nothing: nothing moved | find the payer by `provider_ref` in the gateway statement; refund |
| `NOT_SUCCESS` | gateway reported failure | none |
| `TOPUP_*`, `COMMISSION_PAID`, `COMMISSION_RETURNED` | deposit / commission paths | see `deposit-and-wallet-reconciliation.md`, `cash-commission-overdue.md` |

```sql
-- Last hour, problems only
SELECT received_at, outcome, order_code, amount, provider_ref
  FROM payment_webhook_events
 WHERE received_at > now() - interval '1 hour'
   AND outcome IN ('AMOUNT_MISMATCH','NOT_TRANSFER_BOOKING','UNKNOWN_BOOKING','UNKNOWN_EXTENSION','UNKNOWN_SURCHARGE','UNKNOWN_COMMISSION')
 ORDER BY received_at DESC;
```

## "The customer paid but the booking is still UNPAID"

1. Find the transfer in the gateway statement (reference, amount, content).
2. `SELECT * FROM payment_webhook_events WHERE provider_ref = '<reference>';`
   - no row → the webhook never arrived or failed the signature (API log: `INVALID_SIGNATURE`). Ask the gateway to
     re-deliver; check `PAYMENT_GATEWAY_WEBHOOK_SECRET` matches the gateway dashboard.
   - a row → its outcome says what happened (table above).
3. A booking past `hold_expires_at` is never resurrected: the late payment is refunded automatically.
4. Never insert `wallet_transactions` by hand. A re-delivered, correctly signed webhook is the only way to book it.

## Many `401 INVALID_SIGNATURE`

Secret rotated on one side only, or someone is probing the endpoint. Compare the secret; if probing, block the source
IP at the proxy. A signature failure never changes state, so there is nothing to undo.
