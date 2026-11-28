# Module `admin-catalog` (BE-1 / Dev A · Phase 7)

Admin manages the service catalog — FR-ADMIN-01 · SRS §4.2, §7 table 5.
API contract: [`docs/api/admin-catalog.api.md`](../../../../../docs/api/admin-catalog.api.md).

| File | Role |
|---|---|
| `admin-catalog.policy.ts` | Pure: invasive ⇒ Tier 2; which fields really change |
| `admin-catalog.repo.ts` | SQL: list, lock, insert, whitelisted update |
| `admin-catalog.service.ts` | `AdminCatalogService.list / create / update` |
| `admin-catalog.routes.ts` | `GET`, `POST /admin/services/categories`, `PATCH /admin/services/categories/:id` (ADMIN) |

## Rules

- **No delete.** Bookings keep pointing at their service; retire it with `is_active = false` (hidden from booking, kept in history).
- `code` is set once at creation (`^[A-Z0-9_]{3,50}$`, unique → `409 SERVICE_CODE_TAKEN`) and never changes.
- `is_invasive = true` requires `required_tier = TIER_2_SPECIALIST`, checked on the row **after** the change
  → `422 INVASIVE_REQUIRES_TIER_2` (never corrected silently).
- `base_price`: integer VND, 0..100,000,000. A new price applies to bookings priced afterwards; existing bookings keep their amounts.
- Every create / real change → `audit_logs` `UPDATE_SERVICE_CATALOG` (migration 0031), same transaction:
  create = `new_value` full row; change = only the changed fields, old and new (plus `code`). A PATCH that changes nothing writes nothing.
