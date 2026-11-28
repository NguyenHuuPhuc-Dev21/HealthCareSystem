# API — admin-catalog (BE-1 · Phase 7 · FR-ADMIN-01)

Base `/api/v1`. **ADMIN only**. Fields are snake_case, like the `service_categories` table.

Service object:

```json
{
  "id": "uuid", "code": "SRV_SHIFT_4H", "name": "Ca 4 giờ", "service_type": "SHIFT_BASED",
  "is_invasive": false, "is_prohibited": false, "required_tier": "TIER_1_BASIC",
  "base_price": 400000, "unit": "PER_SHIFT", "is_active": true, "created_at": "…", "updated_at": "…"
}
```

`service_type`: `TASK_BASED` · `SHIFT_BASED` · `CONTRACT` — `unit`: `PER_TIME` · `PER_HOUR` · `PER_SHIFT` — `required_tier`: `TIER_1_BASIC` · `TIER_2_SPECIALIST`.

## GET /admin/services/categories
All services, retired (`is_active: false`) included, ordered by `service_type`, `code`.

## POST /admin/services/categories → 201
Required: `code` (`^[A-Z0-9_]{3,50}$`), `name` (≤ 150), `service_type`, `base_price` (integer VND 0..100,000,000), `unit`.
Optional (default): `is_invasive` (false), `is_prohibited` (false), `required_tier` (TIER_1_BASIC), `is_active` (true).

## PATCH /admin/services/categories/:id → 200
Any subset of `name, service_type, is_invasive, is_prohibited, required_tier, base_price, unit, is_active`. `code` cannot change.
Returns the updated service. To retire a service: `{ "is_active": false }` (there is no DELETE).

| Status | Code | When |
|---|---|---|
| 404 | `SERVICE_NOT_FOUND` | unknown id |
| 409 | `SERVICE_CODE_TAKEN` | POST with a code that exists |
| 422 | `INVASIVE_REQUIRES_TIER_2` | the result would be invasive without TIER_2_SPECIALIST |
| 400 | `VALIDATION_ERROR` | body invalid / unknown field / empty PATCH |

New prices apply to bookings priced afterwards. Audit: `UPDATE_SERVICE_CATALOG` (old/new changed fields).
