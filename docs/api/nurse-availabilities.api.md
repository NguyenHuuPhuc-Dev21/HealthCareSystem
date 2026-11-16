# API contract — `nurse-availabilities` + `availability-engine` (Phase 2, owner BE-2 / Dev B)

> **Baseline:** SRS v2.0 · FR-SCHED-01 · BR-03 §2.5 · BR-14 §2.5 · Phase 2 exit criteria
> **Consumers:** FE-2 (Nurse Web board N13 + Nurse App) · BE-3 `nurse-search` (internal) · BE-2 matching (Phase 3, internal)
> **Status:** DRAFT (12/11/2026). Matches the shapes already used by `apps/nurse-web/src/features/availabilities`.

Base path `/api/v1`. Envelope: `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message", "details"? } }`.
NURSE only, always on the caller's own schedule. **All times are Vietnam local time (UTC+7), `HH:MM`.**

---

## 1. Data model

| List | DB `availability_type` | Meaning |
|---|---|---|
| `recurringWindows` | `RECURRING_AVAILABLE` | Free every week on `dayOfWeek` (0 = Sunday … 6 = Saturday). |
| `dateAvailabilities` | `DATE_AVAILABLE` (new, migration 0008) | Open hours on ONE date. On that date they **replace** that weekday's weekly windows. |
| `timeOffExceptions` | `TIME_OFF_EXCEPTION` | Not available on that date/time; subtracted from everything else. |

Rules for every window:
- `endTime < startTime` → the window runs **past midnight** into the next day (e.g. `19:00`–`06:00`). The day/date is the evening's.
- `endTime = 23:59` means "until midnight". All day = `00:00`–`23:59`.
- `startTime = endTime` is rejected (zero length).
- Overlapping windows are allowed; they are merged (e.g. Fri `20:00`–`06:00` + Sat all day).
- Date rows older than yesterday are dropped on save (they no longer affect scheduling).

---

## 2. `GET /nurse/availabilities` — NURSE

`200`
```json
{
  "recurringWindows": [
    { "id": "6f0c…", "dayOfWeek": 1, "startTime": "07:00", "endTime": "12:00" },
    { "id": "8a21…", "dayOfWeek": 1, "startTime": "19:00", "endTime": "06:00" }
  ],
  "timeOffExceptions": [ { "id": "…", "specificDate": "2026-11-20", "startTime": "00:00", "endTime": "23:59" } ],
  "dateAvailabilities": [ { "id": "…", "specificDate": "2026-11-21", "startTime": "13:00", "endTime": "17:00" } ],
  "bookings": [
    { "id": "…", "code": "HC-2026-1052", "date": "2026-11-13", "startTime": "20:00", "endTime": "06:00",
      "status": "CONFIRMED", "serviceName": "Chăm sóc hậu phẫu tại nhà" }
  ]
}
```
`bookings` = the nurse's `CONFIRMED` / `IN_PROGRESS` shifts that have not ended, up to 92 days ahead (read-only;
`endTime <= startTime` = ends the next day).

**Errors:** `401` · `403 FORBIDDEN` (not a nurse) · `403 NURSE_PROFILE_REQUIRED`

---

## 3. `PUT /nurse/availabilities` — NURSE

Sends the **whole** schedule; it replaces what is stored, in one transaction (all or nothing).
```json
{
  "recurringWindows":   [ { "id": "seed-w1", "dayOfWeek": 1, "startTime": "07:00", "endTime": "12:00" } ],
  "timeOffExceptions":  [ { "id": "off-…",   "specificDate": "2026-11-20", "startTime": "00:00", "endTime": "23:59" } ],
  "dateAvailabilities": [ { "id": "open-…",  "specificDate": "2026-11-21", "startTime": "13:00", "endTime": "17:00" } ]
}
```
- `id` is optional and ignored; the server returns new ids. Send the lists again in full on every save.
- `timeOffExceptions` and `dateAvailabilities` may be omitted (= empty). Limits: 70 weekly windows, 400 rows per date list.

`200` — same body as `GET` (the saved schedule + bookings).

**Errors**
| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | bad time (`HH:MM`, 00:00–23:59), `dayOfWeek` not 0–6, invalid date, `startTime = endTime`, unknown field |
| 403 | `NURSE_PROFILE_REQUIRED` | the account has no nurse profile yet |
| 409 | `AVAILABILITY_LOCKED` | the new schedule would no longer cover a `CONFIRMED` / `IN_PROGRESS` shift that the current schedule covers (removing / shrinking its window, or a time-off on it). `details`: `{ bookingId, bookingCode, date, startTime, endTime }`. Nothing is saved. |

---

## 4. Internal interface — `availability-engine` (for BE-3 search, BE-2 matching)

```ts
import {
  findAvailableNurses, checkNurseAvailability, assertNurseAvailable, getEffectiveAvailability,
} from '../availability-engine/availability-engine.service';

// Search AND matching: same call, same answer (Phase 2 exit criterion 3).
findAvailableNurses(db, { nurseIds: string[]; start: Date; end: Date }, opts?): Promise<string[]>   // keeps input order
checkNurseAvailability(db, nurseId, { start, end }, opts?): Promise<
  { available: true } | { available: false; reason: 'NO_DECLARED_AVAILABILITY' | 'TIME_OFF' | 'BOOKING_CONFLICT' | 'TRAVEL_BUFFER' }>
assertNurseAvailable(tx, nurseId, { start, end }, opts?)  // throws 409 NURSE_NOT_AVAILABLE (details.reason)
getEffectiveAvailability(db, nurseId, from, to, opts?): Promise<{ start: Date; end: Date }[]>   // ≤ 62 days
// opts: { bufferMinutes?: number /* default system_configs TRAVEL_BUFFER_MINUTES = 60 */, ignoreBookingId?: string }
```

Rule: **effective = declared − time-off − (CONFIRMED/IN_PROGRESS bookings ± 60 min)**; the slot must fit inside ONE
continuous free interval. A new shift may start exactly 60 min after another ends (59 min → `TRAVEL_BUFFER`).

The engine checks **time only**. `ACTIVE`, `deposit_balance ≥ 300,000`, Tier (use `isTier2ValidOn` from tier-lifecycle),
gender, service and distance stay with the caller. Limits: ≤ 2,000 nurses per call, slot ≤ 48 h → else `400 INVALID_SLOT` /
`TOO_MANY_NURSES` / `INVALID_NURSE_ID`.

Phase 3 accept / assign: in the booking transaction, lock `nurse_profiles` (`FOR UPDATE`), then `assertNurseAvailable(tx, …)`.
`PUT /nurse/availabilities` locks the same row, so a schedule edit and an accept never interleave.

---

## 5. Open items
- SRS §8 lists only `PUT`; `GET` is added for the N13 board (agreed with FE-2's proposal).
- Max advance-booking horizon is not in SRS v2.0 (BR-03 §2.6); the engine accepts any future slot.
