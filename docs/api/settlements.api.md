# settlements API (BE-3 · Phase 5 · FR-PAY-02)

Base path `/api/v1`. Envelope `{ "success": true, "data": … }`. Integer VND.

## POST `/bookings/:id/confirm-completion` — role PATIENT (booking owner)

The customer confirms the shift is done: the escrow is paid out now instead of at check-out + `SETTLEMENT_COOLING_HOURS`.
No body. Idempotent (a settled booking answers the same).

```json
{ "bookingId": "…", "bookingCode": "HC-261121-ABC123", "settled": true, "settledAt": "2026-11-23T14:05:00.000Z" }
```

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | id not a UUID |
| 400 | `NOT_TRANSFER_BOOKING` | cash booking (paid on site) |
| 403 | `FORBIDDEN` | not your booking (existence not revealed) |
| 409 | `SHIFT_NOT_FINISHED` | the nurse has not checked out yet |
| 409 | `DISPUTE_OPEN` | a dispute is open / under review — settlement frozen |
| 409 | `NOT_SETTLEABLE` | anything else (`details.reason`, e.g. `NOT_HELD`) |

## Background job `settlements.sweep` (every 5 minutes)

1. Bank-transfer shifts `COMPLETED`, `ESCROW_HELD`, dispute `NONE`, checked out ≥ `SETTLEMENT_COOLING_HOURS` ago.
2. `cancellation_outcomes` with `settlement_status = PENDING` (rows 2–3 at once; row 4 after the cooling window).

For each, in one transaction under the booking lock:

| | |
|---|---|
| customer escrow | `ESCROW_RELEASE` − gross |
| nurse `available_balance` | `ESCROW_RELEASE` + payout |
| nurse `deposit_balance` | `DEPOSIT_WITHHOLD` + withheld (ADR-0004 D2: while short, ≤ 30% of net and ≤ shortfall) |
| `wallets.deposit_grace_shifts_used` | + 1 when the shift was worked with a short deposit |
| `settlements` row | gross = commission + net; net = withheld + payout |
| booking | `payment_status = SETTLED`, `settled_at` (cancellation share: `settlement_status = DONE`) |

Worked example (ADR-0004): 500,000 shift, empty deposit → commission 75,000, net 425,000 → withheld 127,500,
payout 297,500. The nurse sees them in `GET /wallets/me/transactions` (`SETTLE` chip) and `/wallets/me/earnings`.

## For disputes (Phase 6)

`releaseAfterDispute(bookingId)` when a dispute ends `RESOLVED_NURSE`. Opening a dispute must lock the booking row
(`SELECT … FOR UPDATE`) and set `dispute_status = OPEN` — that alone freezes the settlement.
