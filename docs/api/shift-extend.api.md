# API contract — `shift-extend` (Phase 4, owner BE-1 / Dev A)

Base URL: `/api/v1` · `Authorization: Bearer <accessToken>` · FR-SHIFT-03.

The family extends a **running** shift (`IN_PROGRESS`) by whole hours. The nurse must agree; she must not have another
shift right after (incl. the 60-minute travel buffer). Amounts are always computed by the server.

## Flow

| Payment | Steps | Extension in effect when |
|---|---|---|
| `CASH` | request → nurse accepts | the nurse accepts (extra paid in cash at check-out) |
| `BANK_TRANSFER` | request → nurse accepts → customer transfers within 15 min | the transfer is received |

Status shown: `AWAITING_NURSE` → `DECLINED` \| `AWAITING_PAYMENT` → `CONFIRMED` \| `EXPIRED`.
`EXPIRED`: the nurse did not answer before the scheduled end, or the transfer did not arrive in time.

---

### `POST /bookings/:id/extend/quote` — customer (owner)
```json
{ "hours": 1 }
```
`200` — nothing is stored:
```json
{ "success": true, "data": {
  "extraHours": 1, "hours": 1, "from": "2027-01-01T06:00:00.000Z", "to": "2027-01-01T07:00:00.000Z",
  "baseAmount": 100000, "nightSurcharge": 0, "nightHours": 0, "holidaySurcharge": 0, "holidayName": null,
  "heavyPatientSurcharge": 0, "platformFee": 15000, "platformFeeRate": 0.15, "totalAmount": 100000
} }
```

### `POST /bookings/:id/extend` — customer (owner)
```json
{ "hours": 1 }
```
`201` → the extension (shape below), status `AWAITING_NURSE`.

### `POST /bookings/:id/extend/respond` — the assigned nurse
```json
{ "extensionId": "…", "approved": true }
```
```json
{ "extensionId": "…", "approved": false, "declineReason": "Có ca kế tiếp" }
```
`bookingId` may also be sent in the body (nurse app); it must match the URL.
`200` → the extension: `CONFIRMED` (cash), `AWAITING_PAYMENT` (bank transfer, with `bankTransfer` and `paymentExpiresAt`) or `DECLINED`.

### `GET /bookings/:id/extensions` — customer, assigned nurse, Admin
`200` → `{ "extensions": [ … ] }`, oldest first. Poll it while a request is open.

### Extension object
```json
{
  "id": "…", "hours": 1, "amount": 100000, "paymentMethod": "BANK_TRANSFER",
  "status": "AWAITING_PAYMENT",
  "createdAt": "…", "respondedAt": "…", "declineReason": null,
  "paymentCode": "HC-261121-ABC123-GH1",
  "paymentExpiresAt": "…",
  "bankTransfer": { "bankName": "…", "accountNumber": "…", "accountName": "…", "transferContent": "HC-261121-ABC123-GH1" },
  "qrImageUrl": "https://img.vietqr.io/…",
  "appliedAt": null
}
```
The transfer content is the extension's own `paymentCode` (not the booking code).

### Dev only: `POST /bookings/:id/extensions/:extensionId/dev/simulate-payment` — customer
Exists only with `PAYMENT_SIMULATOR_ENABLED=true` (never in production). Pays the exact amount as if the gateway confirmed it.

## Errors

| Error | When |
|---|---|
| `400 INVALID_EXTENSION_HOURS` | not 1…`details.maxHours` whole hours |
| `400 BOOKING_ID_MISMATCH` | respond: `bookingId` in the body ≠ URL |
| `403 NOT_ASSIGNED_NURSE` | respond: not this booking's nurse |
| `404 BOOKING_NOT_FOUND` | unknown booking, or not yours |
| `404 EXTENSION_NOT_FOUND` | unknown extension of this booking |
| `409 BOOKING_NOT_IN_PROGRESS` | the shift is not running |
| `409 EXTENSION_WINDOW_CLOSED` | later than `details.deadline` (scheduled end − 30 min) |
| `409 EXTENSION_PENDING` | another extension of this shift is not finished |
| `409 EXTENSION_NOT_PENDING` | respond: already answered / expired; `details.status` |
| `409 NEXT_SHIFT_CONFLICT` | the nurse has a shift right after (incl. travel buffer); try fewer hours |

## Notes for FE
- **Patient web:** requests are allowed **until** 30 minutes before the end (SRS), not only in the last 30 minutes as in the
  mock. Show `details.deadline`; do not hardcode 30 or 4 (`details.maxHours`).
- **Patient web:** bank transfer is paid **after** the nurse accepts (`AWAITING_PAYMENT`), not before.
- **Nurse app:** `POST /bookings/:id/extend/respond` matches `respondToExtension`.
