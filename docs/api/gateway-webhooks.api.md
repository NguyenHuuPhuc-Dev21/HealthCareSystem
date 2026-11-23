# API contract — `gateway-webhooks` + `booking-expiry` (Phase 3, owner BE-3 / Dev C)

> **Baseline:** SRS v2.0 · FR-PAY-01 · FR-BOOK-01/03 · BR-04 §2.1 · BR-08 §2.5 · SEC-5.2–5.6 · RTM TC-PAY-01/02
> **Consumers:** FE-1 (Patient Web payment page) · the sandbox payment gateway · BE-2 (`bookings`, `matching-radar` — internal)
> **Status:** DRAFT (17/11/2026). Migration `0010_be3_phase3_expiry_webhooks_jobboard.sql`.

Base path `/api/v1`. Envelope: `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message", "details"? } }`.
All amounts are integer VND computed by the backend.

---

## 1. Money flow of a bank-transfer booking

```
POST /bookings (BANK_TRANSFER) → DRAFT · UNPAID · hold 15 min (PAYMENT_TIMEOUT_MINUTES)
   │  customer transfers via VietQR (content = booking code)
   ▼
POST /payments/escrow-webhook (gateway, HMAC) ── one transaction, booking row locked ──
   ESCROW_HOLD (customer wallet escrow_locked_balance += total) → payment_status ESCROW_HELD
   → activateMatching (BE-2): DRAFT → MATCHING (JOB_BOARD, or RADAR when start ≤ 6 h) → after COMMIT startRadar
   ▼
nurse claims → CONFIRMED (settlement 85/15 is Phase 5)
no claim at the deadline → EXPIRED + REFUND 100% (same transaction)
```

Escrow is a **simulated** ledger (SRS §1.3). The nurse deposit (ADR-0004) is a separate balance and is never touched here.

---

## 2. `GET /bookings/:id/payment-link` — PATIENT (owner)

Only while the booking is `DRAFT` + `UNPAID` and the hold has not passed.

`200`
```json
{ "bookingId": "…", "bookingCode": "HC-261117-7KQ2MX", "amount": 200000,
  "checkoutUrl": null,
  "qrImageUrl": "https://img.vietqr.io/image/970422-0000000000-compact2.png?amount=200000&addInfo=HC-261117-7KQ2MX&accountName=…",
  "expiresAt": "2026-11-17T02:15:00.000Z",
  "bankTransfer": { "bankName": "MB Bank (sandbox)", "accountNumber": "0000000000", "accountName": "CARENEST ESCROW SANDBOX",
                    "transferContent": "HC-261117-7KQ2MX" } }
```
- `transferContent` must be kept as is: the gateway matches the payment to the booking by it.
- `qrImageUrl` / `bankTransfer` are `null` until the receiving account is configured (`PAYMENT_RECEIVING_*` in `.env`).
- `checkoutUrl` is `null` in the VietQR-only sandbox (FE-1 already handles `null`).

| HTTP | code | When |
|---|---|---|
| 403 | `FORBIDDEN` | not the caller's booking (no existence leak) |
| 400 | `NOT_TRANSFER_BOOKING` | a cash booking |
| 409 | `PAYMENT_NOT_PENDING` | already paid, expired or past the hold (`details.executionStatus`, `details.paymentStatus`) |

---

## 3. `POST /payments/escrow-webhook` — GATEWAY (no bearer token)

PayOS-style envelope:
```json
{ "code": "00", "desc": "success", "success": true,
  "data": { "orderCode": "HC-261117-7KQ2MX", "amount": 200000, "reference": "FT26111700001",
            "description": "HC-261117-7KQ2MX", "transactionDateTime": "2026-11-17 09:05:00" },
  "signature": "<hex>" }
```
**Signature (SEC-5.3):** `HMAC-SHA256(PAYMENT_GATEWAY_WEBHOOK_SECRET, canonical(data))`, hex. `canonical(data)` = every field of
`data` sorted by key, `key=value` joined with `&` (null → empty). Compared in constant time. Any extra signed field is kept.

| Result | HTTP | Effect |
|---|---|---|
| malformed body | 400 `VALIDATION_ERROR` | none |
| wrong signature / secret not set | 401 `INVALID_SIGNATURE` | none (TC-PAY-01) |
| anything verified | **200** `{ "received": true, "outcome", "bookingId" }` | see below |

`outcome` (also stored in `payment_webhook_events`, append-only):

| outcome | When | Money |
|---|---|---|
| `HELD` | exact amount, booking `DRAFT` + `UNPAID`, hold not passed | `ESCROW_HOLD` (`external_ref` = `reference`), `ESCROW_HELD`, matching starts |
| `DUPLICATE` | same `reference` already booked (re-delivery) | none — 5 deliveries = 1 `ESCROW_HOLD` (TC-PAY-02) |
| `LATE_PAYMENT_REFUNDED` | paid after the hold, or the booking already `EXPIRED` / `CANCELLED` | `ESCROW_HOLD` + `REFUND` in one transaction; booking `EXPIRED` · `REFUNDED` |
| `EXTRA_PAYMENT_REFUNDED` | booking already paid under another reference | `ESCROW_HOLD` + `REFUND` of the second payment |
| `AMOUNT_MISMATCH` | amount ≠ stored total | none — Admin reconciles with the gateway |
| `NOT_TRANSFER_BOOKING` | transfer received for a cash booking | none — Admin follows up |
| `UNKNOWN_BOOKING` | no booking with `orderCode` | none |
| `NOT_SUCCESS` | `success = false` or `code ≠ "00"` | none |

### Shift-extension payments (`<booking code>-GH<n>`, FR-SHIFT-03)

A bank-transfer extension (BE-1 `shift-extend`) is paid to the **same webhook** with its own transfer content
`<booking code>-GH<n>`. When an extension with that code exists, the webhook hands the payment to shift-extend's
`confirmExtensionPayment` in the same transaction (a booking code that merely ends in `-GH<digits>` still goes the booking way):

| outcome | Effect |
|---|---|
| `EXTENSION_PAID` | `ESCROW_HOLD` in the customer's escrow; extension in effect (`end_time` and amounts updated) |
| `DUPLICATE` | same `reference` already booked |
| `AMOUNT_MISMATCH` | amount ≠ extension price → nothing moves |
| `LATE_PAYMENT_REFUNDED` | payment window over / no longer usable → `ESCROW_HOLD` + `REFUND` 100% |
| `UNKNOWN_EXTENSION` | extension disappeared between lookup and lock |

Idempotency keys: `escrow-hold:<reference>`, `escrow-refund:<reference>`, `escrow-refund:unmatched:<bookingId>` (UNIQUE in `wallet_transactions`).

### `POST /payments/dev/simulate-escrow` — PATIENT (owner), dev / demo only
Exists only when `PAYMENT_SIMULATOR_ENABLED=true` **and** `NODE_ENV ≠ production`. Body `{ "bookingId": "…" }`: builds and signs
the webhook the sandbox would send for the exact amount and runs the real handler. Same `200` result as above.

---

## 4. Expiry (`booking-expiry`, jobs only — no endpoint)

| Rule | Deadline | Result |
|---|---|---|
| Unpaid transfer (FR-BOOK-01, SRS §5.2 row 9) | `hold_expires_at` (created + 15 min) | `EXPIRED`, reason `PAYMENT_TIMEOUT` |
| Unmatched (FR-BOOK-03, BR-08 §2.5) | `start − UNMATCHED_EXPIRY_LEAD_MINUTES` (30) | `EXPIRED`, reason `UNMATCHED` |
| Unmatched urgent (Radar) | also `matching_started_at + URGENT_UNMATCHED_EXPIRY_MINUTES` (30), whichever first | same |

- If the booking was `ESCROW_HELD`, a `REFUND` of 100% is booked **in the same transaction** and `payment_status` → `REFUNDED`.
  Cash bookings: nothing to refund.
- Open offers of the booking (Radar, direct request) → `EXPIRED`. The reason is in `bookings.cancellation_reason`.
- Jobs: `booking-expiry.payment-timeout` `{ bookingId }` (scheduled by BE-2 at `hold_expires_at`, key `payment-timeout:<id>`) and
  `booking-expiry.sweep` every minute (safety net for both rules). Each booking is re-checked under its row lock; re-runs are harmless.
- `bookings.matching_started_at` is stamped by a DB trigger whenever a booking enters `MATCHING` (cash at creation, transfer at the webhook).

---

## 5. Open items
- Real gateway: replace the sandbox VietQR link with the partner's checkout/refund API; refunds then carry the partner reference in `external_ref`.
- Late / extra payments are refunded automatically in the ledger; the actual bank payout in the sandbox is simulated.
- Commission-payment webhook for cash bookings (`COMMISSION_PAYMENT`) is Phase 5 and will reuse the same signature check.
- FE-1: `Booking.bankTransfer` (BE-2 view) stays `null`; read the transfer details from `GET /bookings/:id/payment-link`.
