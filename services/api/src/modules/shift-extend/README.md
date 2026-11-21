# Module `shift-extend` (BE-1 / Dev A · Phase 4)

The family extends a running shift in 1-hour steps; the nurse must agree and must not have a conflicting next shift.

- **SRS:** FR-SHIFT-03 · BR-15 §2.3 · BR-13 · SRS §4.4
- **API contract:** [`docs/api/shift-extend.api.md`](../../../../../docs/api/shift-extend.api.md)
- **Migration:** `0013` — `booking_adjustments` columns + `EXPIRED` status + one-open-extension index;
  configs `EXTENSION_REQUEST_DEADLINE_MINUTES` (30), `MAX_EXTENSION_HOURS` (4) — proposed, pending PO
- **Also reads:** `TRAVEL_BUFFER_MINUTES`, `PAYMENT_TIMEOUT_MINUTES`, surcharge rates (pricing-engine)

## Files

| File | Role |
|---|---|
| `shift-extend.routes.ts` | quote, request, respond, list (+ dev payment simulator) |
| `shift-extend.service.ts` | the flow; `confirmExtensionPayment` for the payment webhook |
| `shift-extend.policy.ts` | pure rules: window, hours, per-hour rate, next-shift conflict, statuses, payment codes |
| `shift-extend.repo.ts` | SQL on `bookings`, `booking_adjustments`, `nurse_profiles` (lock) |
| `shift-extend.schema.ts` | Zod whitelists (the client never sends amounts) |
| `shift-extend.types.ts` | DTOs |
| — `jobs.ts` | not needed: stale requests are expired lazily under the booking lock |

## Flow

```
customer  POST /bookings/:id/extend {hours}          → REQUESTED   (price fixed now)        view: AWAITING_NURSE
nurse     POST /bookings/:id/extend/respond          → REJECTED                              view: DECLINED
                                                     → ACCEPTED, CASH: applied at once       view: CONFIRMED
                                                     → ACCEPTED, BANK: waits ≤ 15 min        view: AWAITING_PAYMENT
gateway   (BE-3 webhook) confirmExtensionPayment     → PAID, applied                         view: CONFIRMED
no answer before the end / no payment in time        → EXPIRED                               view: EXPIRED
```

"Applied" = `bookings.end_time` + N hours and `base_amount / surcharge_amount / platform_fee / total_amount` increased,
so settlement and the cash bill see one total. Nurse first, money second: a declined extension never needs a refund.

## Rules implemented

- Request: shift `IN_PROGRESS`; now ≤ scheduled end − `EXTENSION_REQUEST_DEADLINE_MINUTES` (SRS: "at least 30 minutes
  before the end"); 1 ≤ hours ≤ `MAX_EXTENSION_HOURS`; no other open extension (also a unique index); no collision with
  the nurse's next shift + `TRAVEL_BUFFER_MINUTES`.
- Price: pricing-engine with the service priced **per hour** — `PER_HOUR` at its catalogue price, `PER_SHIFT`/`PER_TIME`
  at catalogue price ÷ booked hours (earlier extensions excluded) — plus night / holiday / heavy-patient surcharges on the
  extra hours. Platform fee stays inside the total, like bookings.
- Accept: the nurse row is locked (same lock as matching), the next-shift check is repeated, and the bookings exclusion
  constraint (`ex_bookings_nurse_no_overlap`) is the last guard (`23P01` → `409 NEXT_SHIFT_CONFLICT`).
- Payment (bank transfer): own transfer content `<booking code>-GH<n>`; held in the customer's escrow with BE-3's
  `holdEscrow` (idempotent on the gateway reference). If it can no longer be used it is refunded 100% at once.

## For gateway-webhooks (BE-3)

Inside the webhook transaction, before looking the order code up as a booking:

```ts
import { isExtensionPaymentCode } from '../shift-extend/shift-extend.policy';
import { confirmExtensionPayment } from '../shift-extend/shift-extend.service';

if (isExtensionPaymentCode(data.orderCode)) {
  const outcome = await confirmExtensionPayment(
    db,
    { paymentCode: data.orderCode, amount: data.amount, providerRef: data.reference },
    { nowMs, bufferMinutes: await getConfigNumber('TRAVEL_BUFFER_MINUTES') },
  );
  return event(outcome, /* bookingId */ null); // or look it up for the event row
}
```

Outcomes: `EXTENSION_PAID`, `DUPLICATE`, `UNKNOWN_EXTENSION`, `AMOUNT_MISMATCH`, `LATE_PAYMENT_REFUNDED`.
Until this is wired, bank-transfer extensions stop at `AWAITING_PAYMENT` (the dev simulator works).

## Open items

1. **Check-in (BE-2)** — a shift is `IN_PROGRESS` only after check-in, which does not exist yet.
2. **Webhook wiring (BE-3)** — see above.
3. **PO values** — 30-minute deadline and 4-hour maximum. Note the patient-web mock currently allows requests only in the
   *last* 30 minutes; this module follows the SRS wording (until 30 minutes before the end). FE-1 to align.
4. **Per-hour price of shift/task services** — pro rata of the catalogue price; to confirm with the PO.
5. **Notifications** — optional `notify` dependency (nurse on request, customer on answer), wired when `core/notifications`
   exposes a shared service, like booking-expiry.
6. **Realtime** — the apps poll `GET /bookings/:id/extensions`; WebSocket push is part of the shared realtime work.
