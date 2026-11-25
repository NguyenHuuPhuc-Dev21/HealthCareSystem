# API contract — `bookings` + `pricing-engine` + `matching-radar` (Phase 3, owner BE-2 / Dev B)

> **Baseline:** SRS v2.0 · FR-BOOK-01/02/03 · BR-03 · BR-06 · BR-08 · BR-14 · US-HP-09/10 · RTM TC-PRICE-01, TC-MATCH-01/02
> **Consumers:** FE-1 (Patient Web booking flow) · FE-2 (Nurse Web/App Radar modal) · BE-3 (`gateway-webhooks`, `job-board`, `booking-expiry` — internal)
> **Status:** DRAFT (16/11/2026). Shapes follow `apps/patient-web/src/features/booking/booking.types.ts` and
> `packages/shared/src/contracts/job-board.contracts.ts`.

Base path `/api/v1`. Envelope: `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message", "details"? } }`.
**All amounts are integer VND computed by the backend. The client never sends an amount or a status.**

---

## 1. Pricing (FR-BOOK-01)

`total = base + night surcharge + holiday surcharge + heavy-patient surcharge` — every surcharge is a percentage of the
**base**; they add up, never compound. Rates come from `system_configs`.

| Part | Rule |
|---|---|
| base | `PER_HOUR`: catalog price × hours · `PER_TIME` / `PER_SHIFT`: catalog price |
| night (+20%) | only the share of the visit between 22:00 and 06:00 (Vietnam time): `base × night minutes / total minutes × 20%` |
| holiday | share of the visit on a `public_holidays` date: Tết +300%, other public holidays +200% |
| heavy patient (+15%) | `weight_kg ≥ 80` or `mobility_status = BEDRIDDEN` |
| platform fee (15%) | `total × 15%` — **inside** the total (taken from the nurse's earnings at settlement), not added on top |

SRS examples (both in the test suite): 20:00–06:00 at 50,000/h → **580,000**; a 500,000 shift on Tết → **2,000,000**.

### `POST /bookings/quote` — PATIENT
```json
{ "serviceCode": "SRV_SHIFT_4H", "patientProfileId": "…", "startAt": "2026-11-16T13:00:00.000Z", "endAt": "2026-11-16T17:00:00.000Z" }
```
`200`
```json
{ "hours": 4, "baseAmount": 400000, "nightSurcharge": 40000, "nightHours": 2, "holidaySurcharge": 0, "holidayName": null,
  "heavyPatientSurcharge": 0, "platformFee": 66000, "platformFeeRate": 0.15, "totalAmount": 440000 }
```
**Errors:** same service / slot / ownership errors as `POST /bookings` (no eKYC, consent or prescription check: a quote stores nothing).

---

## 2. Bookings

### `POST /bookings/prescription/upload-url` — PATIENT
`{ "contentType": "image/jpeg" }` (`image/jpeg` | `image/png` | `image/webp`) →
`200` `{ "objectKey": "prescription/<userId>/<uuid>.jpg", "uploadUrl": "https://…", "contentType": "image/jpeg", "expiresInSeconds": 600 }`.
PUT the photo to `uploadUrl`, then send `objectKey` as `prescription.imageKey`.

### `POST /bookings` — PATIENT
```json
{ "serviceCode": "SRV_IV_INJECTION", "patientProfileId": "…",
  "startAt": "2026-11-16T04:00:00.000Z", "endAt": "2026-11-16T05:00:00.000Z",
  "paymentMethod": "BANK_TRANSFER",
  "prescription": { "imageKey": "prescription/…", "issuedDate": "2026-11-14" },
  "invitedNurseId": "…" }
```
`prescription` is required for invasive services only; `invitedNurseId` is optional (direct request).

Gates, in this order — nothing is written unless all pass:

| # | Gate | Error |
|---|---|---|
| 1 | service exists · not prohibited (Group 3) · active | `404 SERVICE_NOT_FOUND` · **`403 SERVICE_PROHIBITED`** · `400 SERVICE_NOT_AVAILABLE` |
| 2 | slot: starts in the future; shifts last 4 / 8 / 12 / 24 h; a `PER_TIME` visit ≤ 4 h | `400 START_IN_PAST` · `400 END_BEFORE_START` · `400 INVALID_DURATION` |
| 3 | invasive: medical order photo, issued ≤ 7 days ago, uploaded by this customer | `400 PRESCRIPTION_REQUIRED` · `PRESCRIPTION_EXPIRED` · `PRESCRIPTION_DATE_IN_FUTURE` · `INVALID_FILE_KEY` · `FILE_NOT_UPLOADED` · `FILE_TYPE_NOT_ALLOWED` · `FILE_TOO_LARGE` |
| 4 | profile is the caller's · Decree-13 consent active · home care needs eKYC `VERIFIED` | `403 FORBIDDEN` · `403 CONSENT_REQUIRED` · `403 EKYC_REQUIRED` |
| 5 | invited nurse is ACTIVE | `400 INVITED_NURSE_NOT_AVAILABLE` |

Prohibited services are also refused by a **database trigger** (`trg_bookings_no_prohibited_service`, migration 0009), so
no other path — Admin tool, script, future endpoint — can create such a booking.

Result `201` (`Booking`):

| `paymentMethod` | After creation |
|---|---|
| `BANK_TRANSFER` | `executionStatus: DRAFT`, `paymentStatus: UNPAID`, `paymentExpiresAt` = now + `PAYMENT_TIMEOUT_MINUTES` (15). Matching starts when the payment is `ESCROW_HELD`. |
| `CASH` | `executionStatus: MATCHING` at once (nothing to prepay). Start ≤ 6 h away → `matchingMode: RADAR`; later → `JOB_BOARD`; with `invitedNurseId` → `DIRECT_REQUEST`. |

```json
{ "id": "…", "code": "HC-261116-7KQ2MX", "serviceCode": "SRV_WOUND_CARE", "serviceLabel": "…", "isInvasive": false,
  "patientProfileId": "…", "patientName": "…", "startAt": "…", "endAt": "…", "paymentMethod": "BANK_TRANSFER",
  "pricing": { "…quote fields…": 0, "surchargeAmount": 0 },
  "executionStatus": "DRAFT", "paymentStatus": "UNPAID", "disputeStatus": "NONE",
  "paymentExpiresAt": "2026-11-16T02:15:00.000Z", "bankTransfer": null,
  "invitedNurse": null, "matchingMode": null, "prescriptionReview": null, "createdAt": "…" }
```
- `pricing` totals are the snapshot stored on the booking (`base_amount`, `surcharge_amount`, `platform_fee`, `total_amount`);
  they never change after creation. `surchargeAmount` = night + holiday + heavy patient.
- `bankTransfer` stays `null` until BE-3's payment gateway provides transfer details.
- `prescriptionReview` is always `null`: SRS v2.0 has no Admin review of medical orders (the nurse checks them, layers 2–3).

### `GET /bookings` — PATIENT → `200 { "items": [Booking] }` (newest first, max 100)
### `GET /bookings/:id` — PATIENT (owner) → `200 Booking` · `403 FORBIDDEN` (not yours — no existence leak)

---

## 3. Radar Dispatch (urgent bookings, start ≤ 6 h) — FR-BOOK-03

| Minute | What happens |
|---|---|
| 0 | wave 1: offers to eligible nurses within `RADAR_INITIAL_RADIUS_KM` (5 km) of the care location |
| 5 (`RADAR_EXPANSION_DELAY_MIN`) | wave 2: offers to eligible nurses within `RADAR_EXPANDED_RADIUS_KM` (10 km) not offered yet |
| 15 (`RADAR_WINDOW_MINUTES`) | Radar offers can no longer be claimed; the booking stays `MATCHING` until BE-3's `booking-expiry` expires it |

A nurse is offered a booking only if: profile + account `ACTIVE` · Tier fits (invasive / Tier-2 services need Tier 2 with a GPHN
valid **on the shift date**) · deposit rule below · no account-closure request · last known position inside the radius ·
`availability-engine` says she is free (declared schedule, no time-off, 60-minute buffer).

**Deposit rule (FR-PAY-03 rule 6, ADR-0004 D2):** full deposit (`≥ MIN_NURSE_DEPOSIT`) → any booking. Otherwise the
nurse is in the **grace period** only if `now < wallets.deposit_grace_expires_at`, and then only for `BANK_TRANSFER`
bookings, while `deposit_grace_shifts_used` (completed) + bank-transfer shifts currently `CONFIRMED`/`IN_PROGRESS`
< `DEPOSIT_GRACE_MAX_SHIFTS` (3). Cash bookings always need the full deposit. The same rule is used for Radar offers,
Job Board claims and direct requests.

### `GET /nurse/radar` — NURSE
`200` the nurse's current open offer as `RadarJob`, or `null`. Before the claim only need-to-know data is returned:
patient **given name**, age, weight, mobility, distance, time, amounts (`netAmount` = total − platform fee + urgent bonus).
No address, phone or medical history.

### `POST /bookings/:id/claim-radar` — NURSE
First accept wins. One transaction locks the nurse row, then the booking row, and re-checks everything at that moment.
`200` `{ "success": true, "booking_id": "…", "bookingCode": "…" }`

| HTTP | code | When |
|---|---|---|
| 409 | `ALREADY_CLAIMED` | another nurse got it, or the booking is no longer `MATCHING` |
| 403 | `NO_ACTIVE_OFFER` | no open Radar offer for this nurse (never offered, dismissed, or past the 15-minute window) |
| 403 | `NURSE_NOT_ACTIVE` | profile or account not `ACTIVE` |
| 403 | `ACCOUNT_CLOSING` | the nurse asked to close the account (`wallets.closure_requested_at`, ADR-0004 D3) |
| 403 | `TIER_MISMATCH` | service needs Tier 2 with a GPHN valid on the shift date |
| 403 | `DEPOSIT_SHORTFALL` | deposit below `MIN_NURSE_DEPOSIT` and no usable grace period — a negative deposit (debt) is never covered by grace (`details.minDeposit`, `details.paymentMethod`) |
| 409 | `SCHEDULE_CONFLICT` | not free for the slot (`details.reason`: `NO_DECLARED_AVAILABILITY` / `TIME_OFF` / `BOOKING_CONFLICT` / `TRAVEL_BUFFER`) |
| 409 | `PAYMENT_NOT_SECURED` | bank-transfer booking not in `ESCROW_HELD` |
| 404 | `BOOKING_NOT_FOUND` | |

### `POST /bookings/:id/dismiss-radar` — NURSE
`200` `{ "dismissed": true }` — the offer is marked `DECLINED` and is not shown to this nurse again.
(FE-2's `dismissRadarJob()` is a no-op today; call this so a dismissed job does not come back on the next poll.)

---

## 4. Internal interfaces

```ts
import { activateMatching, getMatchingRadarService } from '../matching-radar/matching-radar.service';

// BE-3 gateway-webhooks — in the SAME transaction that sets payment_status = ESCROW_HELD and writes the ledger:
const { matchingMode, startRadar } = await activateMatching(tx, bookingId);   // DRAFT → MATCHING (idempotent)
// …after COMMIT:
if (startRadar) await getMatchingRadarService().startRadar(bookingId);

// BE-3 job-board (advance bookings, direct invitation) — the same claim transaction as Radar:
await getMatchingRadarService().claimBooking(nurseId, bookingId, 'JOB_BOARD');        // POST /bookings/:id/accept
await getMatchingRadarService().claimBooking(nurseId, bookingId, 'DIRECT_REQUEST');   // needs the open DIRECT_REQUEST offer
```

| Job (shared queue) | Scheduled by | Handler |
|---|---|---|
| `matching-radar.wave` | bookings / webhook via `startRadar`, wave 1 → wave 2 | matching-radar |
| `matching-radar.redispatch` | tier-lifecycle (nurse taken off a booking) | matching-radar: urgent → Radar again without that nurse; later → Job Board |
| `booking-expiry.payment-timeout` `{ bookingId }` at `hold_expires_at`, key `payment-timeout:<id>` | bookings | **BE-3 `booking-expiry`** (placeholder in `bookings.jobs.ts` until then) |

Direct request: `POST /bookings` with `invitedNurseId` inserts a `booking_offers` row (`DIRECT_REQUEST`, `SENT`, `expires_at` NULL)
and keeps the booking off Radar while it is open. BE-3 `job-board` sets the 15-minute `expires_at` when matching starts and,
on timeout / decline, marks the offer `EXPIRED` / `DECLINED` and (for urgent bookings) calls `startRadar`.

---

## 5. Open items
- **Nurse position:** Radar uses `nurse_profiles.current_lat/lng`; no endpoint updates it yet (Phase 4 check-in work or a small `PUT /nurse/location`).
- **Grace period needs two writers outside BE-2:** `wallets.deposit_grace_expires_at` must be set (now + `DEPOSIT_GRACE_DAYS`) by
  BE-1 `credential-review` when a profile first becomes `ACTIVE` — while it stays NULL nobody is in grace; and
  `deposit_grace_shifts_used` must be incremented by BE-3 at settlement of a grace shift. Matching only reads them.
- **Prescription layer 2** (Tier 2 nurse views the photo before accepting) and the full `prescription-gate` module belong to BE-1; layer 1 lives in `bookings.service.ts` until then.
- **Unmatched-booking expiry + 100% refund**, bank webhook and the ledger belong to BE-3.
- Task-visit maximum (4 h) and the 15-minute Radar window are not explicit numbers in the SRS text beyond "minutes 5–15".
