# Shift execution API — check-in, shift logs, check-out (BE-2 · Phase 4)

> **Modules:** `check-in` (FR-SHIFT-01), `shift-logs` (FR-SHIFT-02), `check-out` (FR-SHIFT-04) · **Migration:** `0024_shift_execution.sql`
> **Base path:** `/api/v1` · Envelope `{ success, data }` / `{ success: false, error: { code, message, details? } }` · camelCase
> **Related:** shift-extend (BE-1, FR-SHIFT-03), prescription-rejection (BE-1), settlements / cash-commission / privacy-consent / disputes (BE-3), reviews (BE-1), SOS (BE-3, FR-SHIFT-05 — not here).

Lifecycle: `CONFIRMED` →(check-in)→ `IN_PROGRESS` →(check-out)→ `COMPLETED`, or →(condition mismatch, refuse)→ `CANCELLED`.
Every time, position and amount is the **server's**: the device clock is ignored, prices come from pricing-engine.

## Parameters (`system_configs`, proposed values pending PO)

| Key | Value | Used for |
|---|---|---|
| `CHECKIN_MAX_RADIUS_METERS` | 200 | max Haversine distance to the care address (SRS §5.1) |
| `CHECKIN_OPENS_BEFORE_START_MINUTES` | 30 | check-in possible from start − 30 min until the scheduled end |
| `CHECKIN_SELFIE_MAX_AGE_MINUTES` | 10 | selfie upload URL issued at most 10 min before the check-in |
| `CONDITION_MISMATCH_WINDOW_MINUTES` | 30 | a condition discrepancy is reported in the first 30 min (SRS §4.4) |
| `CHECKOUT_EARLY_TOLERANCE_MINUTES` | 15 | shift/hour-based: check-out from scheduled end − 15 min |
| `CASH_COMMISSION_DUE_HOURS` | 24 | cash: commission due check-out + 24h (FR-PAY-02) |
| `SETTLEMENT_COOLING_HOURS` · `RECORD_ACCESS_EXPIRY_HOURS` · `PAYMENT_TIMEOUT_MINUTES` | 24 · 12 · 15 | existing keys |

---

## 1. Nurse — my shifts

### `GET /nurse/shifts?status=upcoming|in_progress|completed` — NURSE

`upcoming` = CONFIRMED, `in_progress` = IN_PROGRESS, `completed` = COMPLETED; no filter = all three (running and
upcoming first, then the latest completed). Max 100.

```json
[{ "bookingId": "…", "bookingCode": "HC-261116-AB12CD", "patientName": "Lê Văn Bảy", "patientAge": 78,
   "patientAddress": "12 Lê Lợi, Q1", "patientLatitude": 10.7769, "patientLongitude": 106.7009, "mobilityStatus": "NORMAL",
   "serviceName": "Ca trực 4 giờ", "isInvasive": false, "startTime": "…", "endTime": "…", "timeRange": "08:00–12:00",
   "scheduledHours": 4, "executionStatus": "CONFIRMED", "paymentStatus": "UNPAID", "paymentMethod": "CASH",
   "disputeStatus": "NONE", "totalAmount": 400000, "commissionAmount": 60000, "netAmount": 340000,
   "checkedInAt": null, "checkedOutAt": null }]
```

After the medical-record window closes (check-out + 12h) `patientAddress`, `patientLatitude/Longitude` and
`mobilityStatus` are `null` (FR-PRIV-01).

### `GET /bookings/:id/shift-state` — NURSE (assigned)

`ShiftExecutionState` (packages/shared `shift.contracts.ts`). Readable while the medical-record window is open
(CONFIRMED → check-out + 12h, or an Admin re-grant) — otherwise `403 RECORD_ACCESS_DENIED` (privacy-consent, BE-3).
Fields added by the backend: `checkInWatermark`, `checkInLatitude/Longitude`, `serviceType`, `conditionSurcharge`,
`checkout`, `updatedAt`. Care checklist ids: `INITIAL_VITALS`, `VERIFY_ORDER` (invasive only), `CARE_PROCEDURE`,
`FINAL_VITALS_HANDOVER` — all mandatory.

---

## 2. Check-in (FR-SHIFT-01)

Files never go through the API (1 MB body limit, presigned uploads): the selfie is uploaded first.

### `POST /bookings/:id/check-in/selfie-upload-url` — NURSE (assigned)

`{ "contentType": "image/jpeg" | "image/png" | "image/webp" }` → `201`
`{ "objectKey": "checkin-selfie/<nurseId>/<uuid>.jpg", "uploadUrl": "https://…", "expiresInSeconds": 600, "contentType": "image/jpeg" }`

Then `PUT uploadUrl` with the photo (header `Content-Type` = the same type). The key is **single-use**, valid
`CHECKIN_SELFIE_MAX_AGE_MINUTES`, and only for this booking and nurse.

### `POST /bookings/:id/check-in` — NURSE (assigned)

```json
{ "latitude": 10.7778, "longitude": 106.7009, "isMockLocation": false, "selfieKey": "checkin-selfie/…/….jpg",
  "accuracyMeters": 8 }
```

`isMockLocation` = Android `isFromMockProvider` / iOS `isSimulatedBySoftware`. `timestamp` and `bookingId` are
accepted and ignored. → `200` `ShiftExecutionState` (`executionStatus: "IN_PROGRESS"`, `checkedInAt` = server time,
`checkInDistanceMeters`, `checkInWatermark: "2026-11-16 07:58:00 · 10.77790, 106.70090"`, `checkInSelfieUrl` 10-min link,
`careActivities`).

**Stamp on the photo** (SRS RISK-05, NFR-SEC-01: "đóng dấu Server Timestamp + tọa độ lên ảnh"): the server reads the
upload, burns a band at the bottom with `HealthCareSystem · Check-in <booking code>` and
`<server time> · <lat>, <lng> (GMT+7)` into the pixels, re-encodes it as JPEG (≤ 1080 × 1440, EXIF orientation applied,
all metadata removed) and stores it under a new key. `checkInSelfieUrl` / tracking `selfieUrl` point to the stamped
photo; the original upload is kept as evidence. The stamp time is exactly `checkedInAt`.

| Status | Code | When |
|---|---|---|
| 403 | `NOT_ASSIGNED_NURSE` | another nurse |
| 409 | `TOO_EARLY_TO_CHECK_IN` | before start − 30 min (`details.opensAt`) |
| 409 | `ALREADY_CHECKED_IN` / `BOOKING_NOT_CONFIRMED` / `SHIFT_ALREADY_ENDED` | wrong state / after the scheduled end |
| 403 | `MOCK_LOCATION_DETECTED` | the device reports a mock location — **logged** in `checkin_attempts`, `shift_logs.is_mock_location_detected = true` |
| 403 | `OUT_OF_RADIUS` | Haversine distance > 200 m (`details.distanceMeters`, `details.maxRadiusMeters`) — logged |
| 409 | `BOOKING_LOCATION_MISSING` | the care address has no GPS position |
| 400 | `SELFIE_NOT_ISSUED` / `SELFIE_EXPIRED` / `SELFIE_ALREADY_USED` | key not issued for this shift, older than 10 min, or reused — logged |
| 400 | `INVALID_FILE_KEY` / `FILE_NOT_UPLOADED` / `FILE_TOO_LARGE` / `FILE_TYPE_NOT_ALLOWED` | storage checks (magic bytes) — logged |
| 400 | `SELFIE_UNREADABLE` | the file cannot be decoded as a photo (stamping failed) — logged |

On success: booking → `IN_PROGRESS`, `shift_logs` row with the server time + position, the family is notified
(`SHIFT_CHECKED_IN`) and sees the selfie in `GET /bookings/:id/tracking`.

---

## 3. Shift log (FR-SHIFT-02) — NURSE (assigned), booking `IN_PROGRESS`

Every endpoint answers the updated `ShiftExecutionState`. Before check-in → `409 NOT_CHECKED_IN`; after → `409 SHIFT_NOT_IN_PROGRESS`.

| Endpoint | Body | Notes |
|---|---|---|
| `POST /bookings/:id/assessment` | `{ actualMobility, mentalStatus, isConditionMatched, mismatchReason?, requestedAction?: "SURCHARGE"\|"REFUSE", initialVitals }` | once (`409 ASSESSMENT_ALREADY_SUBMITTED`); ticks `INITIAL_VITALS` |
| `POST /bookings/:id/vitals` | `{ vitals: VitalSignRecord }` | `201`; `vitals.id` (UUID) makes retries idempotent; `vitals.timestamp` = measurement time, must be between check-in and now (±5 min) |
| `PATCH /bookings/:id/activities/:activityId` | `{ completed: boolean }` | also accepted as `POST` (offline queue); unknown id → `404 ACTIVITY_NOT_FOUND` |
| `POST /bookings/:id/notes` | `{ id?: uuid, text }` | `201`; free-text care note shown to the family |
| `POST /bookings/:id/condition-mismatch/refuse` | `{ reason? }` | only after a discrepancy was reported (`409 NO_MISMATCH_REPORTED`) |

Vitals bounds (typing mistakes, not abnormal patients): pulse 20–250, systolic 50–260, diastolic 20–160 and below
systolic, temperature 30–45 °C, SpO2 50–100, respiratory rate 4–60, glucose 1–40 mmol/L.

### Condition discrepancy (first 30 minutes)

`isConditionMatched: false` needs `mismatchReason` and `requestedAction`; after 30 min → `409 MISMATCH_WINDOW_CLOSED`
(`details.closedAt`).

- **`SURCHARGE`** — the backend re-prices the booked window with the real condition (pricing-engine; e.g. declared
  `NORMAL`, actually `BEDRIDDEN` → heavy-patient +15% of the base). If the price does not change →
  `409 SURCHARGE_NOT_APPLICABLE` (nothing stored; the nurse can submit again with `REFUSE`). Otherwise a
  `CONDITION_SURCHARGE` request is stored and the family is notified (HIGH, `CONDITION_SURCHARGE_REQUEST`).
- **`REFUSE`** — the shift is cancelled **without penalty** for the nurse (no deposit deduction, no TrustScore change):
  booking `CANCELLED`, `cancellation_reason = CONDITION_MISMATCH`, every open extension/surcharge expired, a
  bank-transfer prepayment (incl. paid extensions) refunded 100% from escrow (`payment_status = REFUNDED`).
  The nurse came for nothing through no fault of hers: she receives the fixed **travel support `ICU_TRAVEL_SUPPORT`
  (50,000 VND)** from the operations fund — one `TRAVEL_SUPPORT` ledger row into `available_balance`
  (key `travel-support:condition-mismatch:<bookingId>`), in the same transaction, as for an invalid medical order
  (SRS FR-BOOK-02 rule 3, RISK-01) and an ICU transfer (§5.2 row 5). The state then carries `travelSupportAmount`.
  Both sides are notified (`BOOKING_CANCELLED`). Refusing is closed once a surcharge is in effect (`409 SURCHARGE_IN_EFFECT`).

`conditionSurcharge` in the state / tracking:

```json
{ "id": "…", "status": "AWAITING_FAMILY | AWAITING_PAYMENT | IN_EFFECT | DECLINED | EXPIRED", "reason": "…",
  "actualMobility": "BEDRIDDEN", "amount": 60000, "paymentMethod": "BANK_TRANSFER", "createdAt": "…", "respondedAt": "…",
  "paymentCode": "HC-261116-AB12CD-PT1", "paymentExpiresAt": "…",
  "bankTransfer": { "bankName": "MB", "accountNumber": "…", "accountName": "…", "transferContent": "HC-261116-AB12CD-PT1" },
  "qrImageUrl": "https://img.vietqr.io/…" }
```

---

## 4. Family

### `GET /bookings/:id/tracking` — PATIENT (who booked; others `404`)

Matches patient-web `BookingTracking`: status, nurse, `checkIn { at, selfieUrl, distanceMeters, lat, lng, watermark }`,
`checkOutAt`, `vitals[]` (newest first; `pulse`, `temperatureC`, `systolic`, `diastolic`, `spo2`), `activities[]`
(notes + finished checklist items), `extensions[]` (shift-extend view), `emergency: null` (SOS is BE-3),
**`conditionSurcharge`** (new — FE-1 to add), `serverTime`.

### `POST /bookings/:id/condition-surcharge/respond` — PATIENT

`{ "approved": true | false }` → the `conditionSurcharge` view.

- declined → `DECLINED`; the nurse is told she may stop without penalty.
- accepted, **CASH** → `IN_EFFECT` at once: booking `surcharge_amount`, `platform_fee`, `total_amount` increased
  (paid in cash with the bill).
- accepted, **BANK_TRANSFER** → `AWAITING_PAYMENT`: transfer the amount to `paymentCode` within
  `PAYMENT_TIMEOUT_MINUTES`. The escrow webhook (§7) holds it and puts the surcharge in effect.

Errors: `404 SURCHARGE_NOT_FOUND` (nothing waiting), `409 SURCHARGE_NOT_PENDING`, `409 SHIFT_NOT_IN_PROGRESS`.
Dev only (`PAYMENT_SIMULATOR_ENABLED=true`): `POST /bookings/:id/condition-surcharge/dev/simulate-payment`.

---

## 5. Real time — `GET /ws/shifts?bookingId=<id>&access_token=<JWT>` (WebSocket)

Also `Sec-WebSocket-Protocol: bearer, <JWT>`. Customer of the booking, assigned nurse or Admin only
(`401` no/bad token, `403` not allowed, `400` bad id). Server → client, on every change:

```json
{ "type": "SHIFT_UPDATED", "bookingId": "…", "change": "CHECKED_IN | ASSESSMENT | VITALS | ACTIVITY | NOTE | SURCHARGE_REQUESTED | SURCHARGE_ANSWERED | SURCHARGE_PAID | CANCELLED | CHECKED_OUT",
  "at": "…", "executionStatus": "IN_PROGRESS" }
```

No patient data on the socket: the app reloads `tracking` / `shift-state`. Multi-instance via Redis (`REDIS_URL`), same
switch as `/ws/notifications`.

---

## 6. Check-out (FR-SHIFT-04)

### `POST /bookings/:id/check-out` — NURSE (assigned), booking `IN_PROGRESS`

```json
{ "finalVitals": { "heartRate": 78, "bloodPressureSystolic": 120, "bloodPressureDiastolic": 76, "temperature": 36.7, "spo2": 98 },
  "completedActivityIds": ["INITIAL_VITALS", "CARE_PROCEDURE"],
  "handoverNote": "Huyết áp ổn định. Nhắc người nhà cho uống nước mỗi 2 giờ." }
```

`checkoutTime` from the device is accepted and ignored. `FINAL_VITALS_HANDOVER` is ticked by the request itself.
→ `200` `ShiftExecutionState` with `executionStatus: "COMPLETED"` and

```json
"checkout": { "checkedOutAt": "…", "settlementEarliestAt": "… (transfer: +24h) | null",
              "commissionDueAt": "… (cash: +24h) | null", "recordAccessUntil": "… (+12h)", "reviewOpen": true }
```

| Status | Code | When |
|---|---|---|
| 409 | `SHIFT_NOT_FINISHED` | shift/hour-based before scheduled end − 15 min (`details.opensAt`). Task-based: no limit — paid 100% once the checklist is done (rule 3) |
| 400 | `CARE_REPORT_INCOMPLETE` | a mandatory checklist item is not done (`details.missingActivityIds`) |
| 400 | `UNKNOWN_ACTIVITY` | id not on the checklist |
| 400 | `VALIDATION_ERROR` | final vitals missing / handover note < 10 characters |
| 409 | `NOT_CHECKED_IN` / `ALREADY_CHECKED_OUT` / `SHIFT_NOT_IN_PROGRESS` | wrong state |

Effects (one transaction, booking row locked): `shift_logs.checkout_time` = server time, final vitals + report stored,
booking `COMPLETED`, open extension/surcharge requests expired (a late transfer is refunded 100%). `checkout_time` is
the single anchor of:

- **24h settlement & dispute window** — bank transfer: settlements (BE-3) pays out at check-out + 24h if no dispute
  (its sweep job); disputes (BE-3) accepted until then;
- **cash commission** — `bookings.commission_due_at = check-out + CASH_COMMISSION_DUE_HOURS`, read by
  cash-commission (BE-3); the nurse gets `COMMISSION_DUE`;
- **12h medical-record window** — enforced by privacy-consent (BE-3) on every read;
- **two-way reviews** — open as soon as the booking is `COMPLETED` (reviews, BE-1).

Notifications: family `SHIFT_COMPLETED`, nurse `COMMISSION_DUE` (cash).

---

## 7. Gateway webhook — surcharge transfers

`POST /payments/escrow-webhook` (BE-3): an `orderCode` `<booking code>-PT<n>` that matches a condition surcharge goes
to shift-logs' `confirmConditionSurchargePayment` in the webhook transaction (same pattern as `-GH<n>` extensions):

| Outcome | Meaning |
|---|---|
| `SURCHARGE_PAID` | held in escrow, booking amounts increased |
| `DUPLICATE` | same gateway reference already booked |
| `UNKNOWN_SURCHARGE` | no surcharge with this code |
| `AMOUNT_MISMATCH` | amount ≠ surcharge — nothing moves, Admin reconciles |
| `LATE_PAYMENT_REFUNDED` | expired / shift over or cancelled — held and refunded 100% |

## 8. For the apps (changes needed)

- **nurse-app** check-in sends `multipart/form-data` with the photo: switch to the 2-step flow (§2: upload URL → PUT →
  `selfieKey`). Error codes `MOCK_LOCATION_DETECTED` / `OUT_OF_RADIUS` are unchanged.
- **nurse-web / nurse-app** `CheckInRequest.selfieImageBase64` is deprecated (`selfieKey`).
- **patient-web** `BookingTracking`: add `conditionSurcharge` and the respond call; subscribe to `/ws/shifts`
  instead of polling.
- **nurse-app / nurse-web**: after `SURCHARGE_NOT_APPLICABLE`, offer `REFUSE`; after `DECLINED`, call
  `/condition-mismatch/refuse`.
