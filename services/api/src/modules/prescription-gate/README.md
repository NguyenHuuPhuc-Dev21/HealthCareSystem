# Module `prescription-gate` (BE-1 / Dev A · Phase 3)

The medical-order control for invasive services: no doctor's prescription, no booking — and the
nurse can read that prescription before she accepts.

- **SRS:** FR-BOOK-02 Layers 1–2 · §4.2 Group 2 (invasive services) · BR-15 · US-HP-18
- **API contract:** [`docs/api/prescription-gate.api.md`](../../../../../docs/api/prescription-gate.api.md)
- **Config:** `PRESCRIPTION_MAX_AGE_DAYS` = 7 (migration `0008`)

## Files

| File | Role |
|---|---|
| `prescription-gate.routes.ts` | `POST /bookings/prescription/upload-url`, `GET /bookings/:id/prescription` |
| `prescription-gate.service.ts` | upload link, Layer 1 gate (`assertPrescriptionGate`), Layer 2 view link + audit |
| `prescription-gate.policy.ts` | pure rules: prescription age, candidate-nurse access |
| `prescription-gate.repo.ts` | read-only SQL on `bookings`, `booking_offers`, `nurse_profiles` |
| `prescription-gate.schema.ts` | Zod whitelist for the upload request |
| `prescription-gate.types.ts` | DTOs and the storage port |
| — `jobs.ts` | not needed: no timer |

## Rules implemented

**Layer 1 — when the customer books**
- Non-invasive service: nothing is asked and nothing is stored.
- Invasive service: a prescription file **and** its issue date are mandatory.
- The file must be this customer's own upload in the `prescription` category, exist in storage,
  be 1 byte–10 MB, and really be a JPEG/PNG/WebP/PDF (magic bytes, not the declared type).
- The issue date must be a real date, not in the future, and at most `PRESCRIPTION_MAX_AGE_DAYS`
  days before today (Vietnam calendar day). Issued exactly that many days ago is still valid.

**Layer 2 — who may open the prescription** (`GET /bookings/:id/prescription`, link ≤ 10 minutes)

| Viewer | Condition | Audited |
|---|---|---|
| Customer | owns the booking | no |
| Admin | always | yes |
| Assigned nurse | inside BE-3's medical-record window (`assertRecordAccess`: CONFIRMED → check-out + 12 h, or an Admin re-grant) | yes |
| Other nurse | booking is `MATCHING` **and** she holds a live offer (`SENT`, not expired) **and** she is ACTIVE Tier 2 with a GPHN valid after today | yes |

Audit = one `VIEW_MEDICAL_RECORD` row per link issued (`target_table = bookings`).

## For `bookings` (BE-2)

```ts
import { assertPrescriptionGate } from '../prescription-gate/prescription-gate.service';

const rx = await assertPrescriptionGate({
  customerId,
  isInvasive: service.is_invasive,
  prescriptionImageKey: body.prescriptionImageKey,     // objectKey from the upload-url endpoint
  prescriptionIssuedDate: body.prescriptionIssuedDate, // YYYY-MM-DD
});
// rx is null for a non-invasive service. Store:
//   prescription_image_url   = rx?.prescriptionImageKey ?? null
//   prescription_issued_date = rx?.prescriptionIssuedDate ?? null
```

It throws `400` with one of: `PRESCRIPTION_REQUIRED`, `INVALID_PRESCRIPTION_DATE`,
`PRESCRIPTION_DATE_IN_FUTURE`, `PRESCRIPTION_TOO_OLD` (`details.maxAgeDays`), `INVALID_FILE_KEY`,
`FILE_NOT_UPLOADED`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`.

## Open items

1. **Nothing calls `assertPrescriptionGate` yet** — `bookings` (BE-2) does not exist. Until it does, Layer 1
   is enforced only for callers that use the function.
2. **"Nurse must view before accepting"** — this module gives the nurse the link and audits the view; setting
   `bookings.prescription_verified_by_nurse` and refusing an accept without it belongs to the accept flow
   (`matching-radar` / `job-board`). The audit rows here can serve as the proof that she opened it.
3. **Age is measured on the booking day**, not on the shift day. For an advance booking far ahead the
   prescription can be older than 7 days when the shift starts — to confirm with the PO.
4. **Legibility** (stamp, signature, clinic name) is checked by people (nurse, Layer 3), not by the system.
5. **Orphan uploads** — a prescription uploaded but never attached to a booking stays in storage (same open
   item as nurse documents).
6. The assigned nurse can also get the prescription through BE-3's medical-record endpoint; both paths use
   the same access window.
