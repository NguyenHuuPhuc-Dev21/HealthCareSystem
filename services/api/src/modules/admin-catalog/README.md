# Module `admin-catalog` (BE-1 / Dev A · Phase 7)

Admin manages the service catalog — FR-ADMIN-01 · SRS §4.2, §7 table 5.
API contract: [`docs/api/admin-catalog.api.md`](../../../../../docs/api/admin-catalog.api.md).

| File | Role |
|---|---|
| `admin-catalog.policy.ts` | Pure: invasive ⇒ Tier 2; which fields really change |
| `admin-catalog.repo.ts` | SQL: list, lock, insert, whitelisted update |
| `admin-catalog.service.ts` | `AdminCatalogService.list / create / update` |
| `admin-catalog.routes.ts` | `GET` (`{ items }`), `POST /admin/services/categories`, `PATCH /admin/services/categories/:id` (ADMIN) — camelCase, as admin-web proposed |

## Rules

- **No delete.** Bookings keep pointing at their service; hide it with `isActive: false` (hidden from booking, kept in history).
- `code` is set once at creation (`^[A-Z][A-Z0-9_]{2,49}$`, unique → `409 CODE_EXISTS`) and never changes.
- `isInvasive: true` requires `requiredTier: TIER_2_SPECIALIST`, checked on the row **after** the change
  → `400 INVALID_TIER_FOR_INVASIVE` (never corrected silently).
- `basePrice`: integer VND, 0..100,000,000. A new price applies to bookings priced afterwards; existing bookings keep their amounts.
- Every create / real change → `audit_logs` `UPDATE_SERVICE_CATALOG` (migration 0016), same transaction:
  create = `new_value` full row; change = only the changed fields, old and new (plus `code`). A PATCH that changes nothing writes nothing.
