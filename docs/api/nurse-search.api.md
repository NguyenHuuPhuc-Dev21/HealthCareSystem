# API contract — `nurse-search` (Phase 2, owner BE-3 / Dev C)

> **Baseline:** SRS v2.0 · FR-SEARCH-01 · FR-BOOK-03 · FR-PAY-03 (rules 6–10, ADR-0004) · BR-04 §grace · Phase 2 exit criterion 3
> **Depends on:** BE-2 `availability-engine` (time) · BE-2 `matching-radar.policy` (eligibility gate) · `tier-lifecycle.policy` (`isTier2ValidOn`)
> **Consumers:** FE-1 Patient Web (search page, nurse card) · BE-2 booking create (DIRECT_REQUEST target must be a result of this search)
> **Status:** IMPLEMENTED (17/11/2026) — `services/api/src/modules/nurse-search`. Open items in §6 use the proposed default until the team decides.

Base path `/api/v1`. Envelope: `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message", "details"? } }`.
All dates/times are Vietnam local time (UTC+7). Money is integer VND.

---

## 1. Rule: search and matching must give the same answer

A nurse appears in search **only if** the same nurse could be matched/accept that booking. So `nurse-search` does **not**
write its own eligibility or availability SQL; it reuses:

| Check | Source (single source of truth) |
|---|---|
| Profile + user `ACTIVE`, no `closure_requested_at` | `eligibilityBlocker()` — `matching-radar.policy` |
| Tier valid **on the shift date** (invasive / `required_tier = TIER_2`) | `needsTier2()` + `isTier2ValidOn()` |
| Deposit (full **or** grace + `BANK_TRANSFER` + shifts left) | `depositAllows()` — ADR-0004 D2 |
| Free for the slot (declared − time-off − bookings ± 60 min buffer) | `findAvailableNurses()` — `availability-engine` |
| Distance | `boundingBox()` + `distanceKm()` — `matching-radar.policy` |

Config values come from `system_configs` via `getConfigNumber` (no hardcoded numbers):
`MIN_NURSE_DEPOSIT`, `DEPOSIT_GRACE_MAX_SHIFTS`, `DEPOSIT_GRACE_DAYS`, `RADAR_EXPANDED_RADIUS_KM`, `TRAVEL_BUFFER_MINUTES`.

---

## 2. `GET /nurses/search` — PATIENT

### 2.1 Query

| Param | Type | Required | Notes |
|---|---|---|---|
| `serviceCode` | string | yes | Same code as `POST /bookings` (e.g. `SRV_WOUND_CARE`). Must be active and not prohibited, else `400 SERVICE_NOT_BOOKABLE`. Drives the Tier gate. |
| `start` | ISO datetime with offset | yes | Shift start, e.g. `2026-11-20T08:00:00+07:00`. Must be in the future (`400 INVALID_SLOT`). |
| `end` | ISO datetime with offset | yes | `end > start`, length ≤ 48 h (engine limit) → else `400 INVALID_SLOT`. |
| `lat`, `lng` | number | yes | Care location (usually the patient profile address). |
| `radiusKm` | number | no | Default `RADAR_EXPANDED_RADIUS_KM` (10). Max = the same config value. |
| `tier` | `TIER_1_BASIC` \| `TIER_2_SPECIALIST` | no | Extra filter. `TIER_2` means "Tier 2 valid on the shift date". Cannot loosen the service's own gate. |
| `gender` | `MALE` \| `FEMALE` \| `OTHER` | no | `users.gender`. |
| `paymentMethod` | `CASH` \| `BANK_TRANSFER` | no | See §3. If omitted, grace nurses are included with `cashAllowed = false`. |
| `sort` | `distance` \| `rating` \| `experience` | no | Default `distance`. Ties → `rating_avg DESC`, then `user_id`. |
| `page`, `pageSize` | int | no | Default 1 / 20, `pageSize` ≤ 50. |

### 2.2 Response `200`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "nurseId": "uuid",
        "fullName": "Nguyễn Thị A",
        "avatarUrl": "https://… (presigned, 10 min) | null",
        "gender": "FEMALE",
        "tier": "TIER_2_SPECIALIST",
        "isRetiredMedicalStaff": true,
        "yearsOfExperience": 12,
        "ratingAvg": 4.8,
        "reviewCount": 37,
        "distanceKm": 3.4,
        "cashAllowed": true
      }
    ],
    "page": 1, "pageSize": 20, "total": 1
  }
}
```

Mapping: `fullName`, `avatarUrl`, `gender` ← `users`; `tier`, `is_retired_medical_staff`, `years_of_exp`, `rating_avg` ← `nurse_profiles`;
`reviewCount` = count of `reviews` with `reviewee_id = nurse` and `is_visible = true` (verified = tied to a real booking).
**Never returned:** phone, email, exact `current_lat/lng`, `trust_score`, deposit balance, grace counters, GPHN number.

### 2.3 Errors
`400 VALIDATION_ERROR` · `400 INVALID_SLOT` · `400 SERVICE_NOT_BOOKABLE` · `401 UNAUTHORIZED` · `403 FORBIDDEN` (not PATIENT).

`tier` in the card is the tier valid **on the shift date** (a Tier 2 nurse whose GPHN expires before the shift shows as Tier 1).

---

## 3. Deposit rule in search (ADR-0004 D2)

| Nurse state | `paymentMethod=CASH` | `paymentMethod=BANK_TRANSFER` | omitted |
|---|---|---|---|
| `deposit_balance ≥ MIN_NURSE_DEPOSIT` | shown | shown | shown, `cashAllowed=true` |
| Grace: not expired, `shifts_used + held_transfer_shifts < DEPOSIT_GRACE_MAX_SHIFTS` | hidden | shown | shown, `cashAllowed=false` |
| Grace expired / shifts used up, deposit short | hidden | hidden | hidden |
| `closure_requested_at` set (refund in progress) | hidden | hidden | hidden |

The final gate is still enforced again at accept / booking create (BE-2) — search is a filter, not a guarantee.

---

## 4. Get one nurse — `GET /nurses/:nurseId` — PATIENT

Same card fields (without `distanceKm`, `cashAllowed`; `tier` = valid today) + the latest visible patient reviews (`rating`, `comment`, `createdAt`, max 20, newest first). `400 VALIDATION_ERROR` if `nurseId` is not a UUID. Returns
`404 NURSE_NOT_FOUND` if the nurse is not `ACTIVE` or has `closure_requested_at` set. No slot check here.

---

## 5. Algorithm (service layer)

1. Validate query (Zod, strict — unknown params → 400). Load service by code → `needsTier2`.
2. Repo: one SQL over `nurse_profiles ⋈ users ⋈ wallets` inside the bounding box with the cheap filters
   (ACTIVE, no closure, gender, coarse deposit `balance ≥ min OR grace_expires_at > now()`). Reuse `NURSE_SELECT`
   shape from `matching-radar.repo` (incl. `held_transfer_shifts`).
3. In code: exact `distanceKm ≤ radiusKm`, `eligibilityBlocker(...) === null`, Tier filter via `isTier2ValidOn(shiftDate)`.
4. `findAvailableNurses(db, { nurseIds, start, end })` (≤ 2,000 ids per call; chunk if more).
5. Sort, paginate, sign avatar URLs (`core/storage`, 10 min).

---

## 6. Open items (need PO / BE-2 / FE-1 answer)

1. **`paymentMethod` in search** — implemented as proposed (optional param + `cashAllowed`). Alternative: hide grace nurses unless `BANK_TRANSFER`.
2. **Default radius** — implemented with `RADAR_EXPANDED_RADIUS_KM` (10 km) as default and maximum; a separate `SEARCH_RADIUS_KM` key would need a migration.
3. **`avatar_url`** — implemented: object-storage key → presigned 10 min; `https://` URL → passed through; anything else → `null`. Confirm with BE-1 how avatars are saved.
4. **`trust_score`** — confirm it stays hidden from patients.
5. **Reviews** — implemented as `reviewer_role = PATIENT` and `is_visible = true` only; confirm.
6. ADR-0004 is still *Proposed*; if PO rejects the grace period, §3 collapses to "full deposit only".
