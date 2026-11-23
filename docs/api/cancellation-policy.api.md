# API contract — `cancellation-policy` (Phase 5, owner BE-1 / Dev A)

Base URL: `/api/v1` · `Authorization: Bearer <accessToken>` of a **customer** (PATIENT) · SRS §5.2.
All amounts are integer VND computed by the server; the matrix numbers come from `system_configs`.

## The rules (customer cancels before check-in)

| Scenario | When (Δt = time to the start) | Customer refund | Nurse | Platform |
|---|---|---|---|---|
| `CUSTOMER_CANCEL_EARLY` | Δt > 12h, or no nurse assigned yet | 100% | — | — |
| `CUSTOMER_CANCEL_NEAR` | 2h ≤ Δt ≤ 12h | 80% | 15% | 5% |
| `CUSTOMER_CANCEL_LATE` | Δt < 2h (also after the start, before check-in) | 50% | 40% | 10% |

Cash bookings: nothing was prepaid, so nothing is refunded; the fee is recorded (`feeCollected: false`), not collected.
A running shift (`IN_PROGRESS`) cannot be cancelled: it is ended early with no penalty (check-out flow).

---

### `GET /bookings/:id/cancel-preview`
What cancelling **now** would do. Nothing is stored.
```json
{ "success": true, "data": {
  "bookingId": "…", "scenario": "CUSTOMER_CANCEL_NEAR", "hoursBeforeStart": 5,
  "paymentMethod": "BANK_TRANSFER", "amountPaid": 400000,
  "feePercent": 20, "refundPercent": 80, "refundAmount": 320000,
  "nurseCompensation": 60000, "platformShare": 20000,
  "feeAmount": 80000, "feeCollected": true
} }
```

### `POST /bookings/:id/cancel`
No body. Cancels and books the refund at once.
```json
{ "success": true, "data": {
  "booking": { "id": "…", "code": "HC-…", "executionStatus": "CANCELLED", "paymentStatus": "ESCROW_HELD" },
  "outcome": { "scenario": "CUSTOMER_CANCEL_NEAR", "rowNo": 2, "refundAmount": 320000, "nurseCompensation": 60000, "platformShare": 20000, "…": "…" },
  "refund": { "refundId": "…", "scenario": "CUSTOMER_CANCEL_NEAR", "amountPaid": 400000, "refundAmount": 320000, "refundPercent": 80, "status": "REFUNDED", "…": "…" }
} }
```
- `refund` is `null` when nothing was prepaid (cash, unpaid draft).
- `paymentStatus` is `REFUNDED` for a full refund; for rows 2–3 it stays `ESCROW_HELD` (the nurse and platform shares
  are paid out at settlement).
- The amounts can differ from the preview if time passed in between (e.g. crossing the 12h or 2h mark): the response is what was applied.

### `GET /refunds`
The customer's refunds, newest first (at most 100): cancellations, expired bookings, invalid-prescription rejections, late payments.
```json
{ "success": true, "data": { "items": [ {
  "refundId": "…", "bookingId": "…", "bookingCode": "HC-…", "serviceLabel": "Ca chăm sóc phục hồi 4 giờ ban ngày",
  "scenario": "CUSTOMER_CANCEL_NEAR", "amountPaid": 400000, "refundAmount": 320000, "refundPercent": 80,
  "nurseCompensation": 60000, "platformShare": 20000, "voucherAmount": 0,
  "status": "REFUNDED", "createdAt": "…", "refundedAt": "…"
} ] } }
```
`scenario` is one of the 9 §5.2 names, or `INVALID_PRESCRIPTION` / `OTHER`.

## Errors

| Error | When |
|---|---|
| `404 BOOKING_NOT_FOUND` | unknown booking, or not yours |
| `409 SHIFT_IN_PROGRESS` | the shift has started (check-in done) |
| `409 BOOKING_NOT_CANCELLABLE` | already cancelled, completed or expired; `details.executionStatus` |

## Notes for FE (patient-web `features/refunds`)
- Paths and field names match `refunds.api.ts` / `refunds.types.ts`. Added: `feeAmount`, `feeCollected` in the preview,
  `outcome` in the cancel response; `booking` there is a short summary, not the full `Booking` — reload the booking if needed.
- Add `INVALID_PRESCRIPTION` and `OTHER` to `RefundScenario`.
- Always show the preview right before confirming; do not compute amounts in the app.
