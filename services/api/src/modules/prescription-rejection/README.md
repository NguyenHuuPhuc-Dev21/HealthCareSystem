# Module `prescription-rejection` (BE-1 / Dev A · Phase 4)

Layer 3 of the medical-order control: on site, the nurse compares the paper prescription and the real
medication with the image uploaded at booking. If the order is forged, altered, expired or does not match,
she refuses the shift with photo evidence — without any penalty.

- **SRS:** FR-BOOK-02 Layer 3 · BR-15 §2.2 · BR-07 · RISK-01
- **API contract:** [`docs/api/prescription-rejection.api.md`](../../../../../docs/api/prescription-rejection.api.md)
- **Migration:** `0012` — table `prescription_rejections`, config `PRESCRIPTION_REJECTION_WINDOW_MINUTES`
- **Config used:** `PRESCRIPTION_REJECTION_WINDOW_MINUTES` (60, proposed), `ICU_TRAVEL_SUPPORT` (50,000 VND)

## Files

| File | Role |
|---|---|
| `prescription-rejection.routes.ts` | `POST /bookings/:id/reject-invalid-prescription/evidence-upload-url`, `POST /bookings/:id/reject-invalid-prescription` |
| `prescription-rejection.service.ts` | the whole rejection in one transaction; evidence file checks; customer notice |
| `prescription-rejection.policy.ts` | pure rules: who, which booking, when |
| `prescription-rejection.repo.ts` | SQL on `bookings`, `prescription_rejections` |
| `prescription-rejection.schema.ts` | Zod whitelists |
| `prescription-rejection.types.ts` | DTOs and the storage port |
| — `jobs.ts` | not needed: no timer |

## Rules implemented

The nurse may reject only when **all** hold (checked before, and again under the booking row lock):

1. she is the booking's assigned nurse — `403 NOT_ASSIGNED_NURSE`;
2. the service is invasive (there is an order to reject) — `409 PRESCRIPTION_NOT_REQUIRED`;
3. the booking is `CONFIRMED` or `IN_PROGRESS` — `409 ALREADY_CANCELLED` / `BOOKING_NOT_ACTIVE`;
4. now ≥ start − `PRESCRIPTION_REJECTION_WINDOW_MINUTES` — `409 TOO_EARLY_TO_REJECT` (`details.opensAt`);
5. now < scheduled end — `409 SHIFT_ALREADY_ENDED`;
6. the evidence is her own upload in the `prescription-rejection` category, 1 byte–10 MB, really a JPEG/PNG/WebP.

Then, in **one transaction**:

- booking → `CANCELLED`, `cancelled_by` = nurse, `cancelled_at`, `cancellation_reason = 'INVALID_PRESCRIPTION'`;
- prepaid booking (`ESCROW_HELD`) → 100% refund through BE-3's `refundEscrow` (idempotency key
  `escrow-refund:invalid-prescription:<bookingId>`), `payment_status = REFUNDED`. Cash booking: nothing to refund;
- one `prescription_rejections` row: reason, evidence key, refunded amount, `travel_support_amount` = `ICU_TRAVEL_SUPPORT`
  at that moment, `travel_support_status = PENDING`.

**No penalty:** nothing here touches the deposit, the TrustScore or the nurse's wallet.
Two concurrent calls cannot both win: the second waits for the row lock and gets `ALREADY_CANCELLED`.

The route uses `authGuard` + `roleGuard(NURSE)` but **not** `requireNurseEligibility`: a nurse demoted or suspended
after accepting must still be able to refuse an invalid order on site.

## Open items

1. **Travel support payout** — recorded as owed (`PENDING`), not paid. `wallets-ledger` (BE-3, Phase 5) needs a way to
   pay from the operations fund (a ledger type and a platform wallet), then sets `travel_support_status = PAID` and
   `travel_support_paid_at`. `idx_prescription_rejections_unpaid` lists what is due.
2. **Time window** — `PRESCRIPTION_REJECTION_WINDOW_MINUTES = 60` is a proposed value (PO). When `check-in` (BE-2) exists,
   the rule should become "after check-in", so the nurse is provably on site.
3. **Customer notice** — sent through an optional `notify` dependency, like `booking-expiry` and `matching-radar`;
   wired when `core/notifications` exposes a shared service.
4. **FE contract** — `RejectPrescriptionRequest` in `packages/shared` sends the photo as base64. This API takes a
   presigned upload instead (files never go through the API, body limit 1 MB); FE-2 to switch.
5. **Admin review** of rejections (to catch abuse) is not specified in SRS v2.0.
