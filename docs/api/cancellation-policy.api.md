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

## Nurse side — SRS §5.2 rows 6–7 (NURSE only)

### GET /bookings/:id/nurse-cancel-preview

What giving the shift back now would cost. Nothing is stored.

```json
{ "bookingId": "uuid", "bookingCode": "HC-…", "scenario": "NURSE_CANCEL_URGENT", "hoursBeforeStart": 3,
  "freeHours": 12, "fine": 80000, "finePercent": 20, "trustScoreDelta": -20 }
```

### POST /bookings/:id/nurse-cancel  `{ "reason": "…" }` (1–500 chars, required)

Same fields as the preview, plus `cancellationId`, `trustScore` (after), `suspended` (fell below 60 → no new shifts
until an Admin lifts it), `penaltyTransactionId` (the deposit deduction, appealable like any penalty).

| Scenario | When | TrustScore | Deposit |
|---|---|---|---|
| `NURSE_CANCEL_EARLY` | more than `NURSE_CANCEL_FREE_HOURS` (12) before the start | −`TRUST_PENALTY_NURSE_CANCEL_EARLY` (5) | — |
| `NURSE_CANCEL_URGENT` | 12 h or less before the start | −`TRUST_PENALTY_NURSE_CANCEL_LATE` (20) | −`NURSE_LATE_CANCEL_FINE_RATE` (20%) × booking total (may go negative = debt) |

The booking goes back to `MATCHING` without a nurse (the customer pays nothing more); a row-7 fine is added to the
booking's `urgent_bonus_amount` for the nurse who takes it instead; matching restarts (urgent → Radar, otherwise Job Board).

| Status | Code | When |
|---|---|---|
| 404 | `BOOKING_NOT_FOUND` | unknown id, or not this nurse's booking |
| 409 | `SHIFT_IN_PROGRESS` | the shift has started (checked in) |
| 409 | `BOOKING_NOT_CANCELLABLE` | not `CONFIRMED` |
| 422 | `SHIFT_ALREADY_STARTED` | the start time has passed (no-show flow, not a cancellation) |
| 400 | `VALIDATION_ERROR` | no / too long `reason` |
