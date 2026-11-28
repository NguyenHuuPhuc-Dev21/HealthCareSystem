# API — admin-catalog (BE-1 · Phase 7 · FR-ADMIN-01)

Base `/api/v1`. **ADMIN only**. Shapes follow what admin-web proposed (`apps/admin-web/src/features/catalog`, camelCase).

Service:

```json
{
  "id": "uuid", "code": "SRV_SHIFT_4H", "name": "Ca 4 giờ", "serviceType": "SHIFT_BASED",
  "isInvasive": false, "isProhibited": false, "requiredTier": "TIER_1_BASIC",
  "basePrice": 400000, "unit": "PER_SHIFT", "isActive": true, "createdAt": "…", "updatedAt": "…"
}
```

`serviceType`: `TASK_BASED` · `SHIFT_BASED` · `CONTRACT` — `unit`: `PER_TIME` · `PER_HOUR` · `PER_SHIFT` — `requiredTier`: `TIER_1_BASIC` · `TIER_2_SPECIALIST`.

## GET /admin/services/categories → `{ items: Service[] }`
All services, hidden (`isActive: false`) and prohibited ones included, ordered by `serviceType`, `code`.

## POST /admin/services/categories → `201 Service`
Required: `code` (`^[A-Z][A-Z0-9_]{2,49}$`), `name` (≤ 150), `serviceType`, `basePrice` (integer VND 0..100,000,000), `unit`.
Optional (default): `isInvasive` (false), `isProhibited` (false), `requiredTier` (TIER_1_BASIC), `isActive` (true).

## PATCH /admin/services/categories/:id → `200 Service`
Any subset of `name, serviceType, isInvasive, isProhibited, requiredTier, basePrice, unit, isActive`. `code` cannot change.
To hide a service: `{ "isActive": false }` (there is no DELETE — bookings keep pointing at their service).

| Status | Code | When |
|---|---|---|
| 404 | `SERVICE_NOT_FOUND` | unknown id |
| 409 | `CODE_EXISTS` | POST with a code that exists |
| 400 | `INVALID_TIER_FOR_INVASIVE` | the result would be invasive without `TIER_2_SPECIALIST` |
| 400 | `VALIDATION_ERROR` | body invalid / unknown field / empty PATCH |

New prices apply to bookings priced afterwards; existing bookings keep their amounts.
Audit: `UPDATE_SERVICE_CATALOG` — create: `new_value` = full row; change: only the changed columns, old and new (plus `code`).
