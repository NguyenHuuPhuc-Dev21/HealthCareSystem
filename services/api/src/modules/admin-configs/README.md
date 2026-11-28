# Module `admin-configs` (BE-1 / Dev A · Phase 7)

Admin edits the business parameters in `system_configs` (SRS §5.1) without a redeploy.
API contract: [`docs/api/admin-configs.api.md`](../../../../../docs/api/admin-configs.api.md).

| File | Role |
|---|---|
| `admin-configs.policy.ts` | Pure: admin value → stored string, type check (core/config `parseConfigValue`), guard rails, ordered pairs |
| `admin-configs.repo.ts` | SQL: list, lock all rows, update with `updated_by` |
| `admin-configs.service.ts` | `AdminConfigsService.list / update` |
| `admin-configs.routes.ts` | `GET /admin/configs` → `{ items }`, `PATCH /admin/configs/:key` `{ value, note? }` (ADMIN) — shapes as admin-web proposed |

## Rules

- **Values only.** Keys come from migrations (the code reads them by name); the API never adds or deletes one.
- Checked by `data_type`, then for NUMBER keys, by name:
  - never negative / NaN; `*_RATE` 0..1; `TRUST_*` 0..100; `TRUST_RECOVERY_MIN_STARS` 1..5;
  - whole numbers for `*_HOURS|MINUTES|MIN|DAYS|SECONDS|MONTHS|SHIFTS|LENGTH|ATTEMPTS|HOUR|METERS|STARS` and VND amounts;
  - at least 1 for TTLs, lengths, radii, windows, timeouts, cooldowns, idle times, attempts, maxima;
  - ordered pairs: nurse share ≤ fee (near / late cancel), `CUSTOMER_CANCEL_LATE_HOURS` ≤ `CUSTOMER_CANCEL_FREE_HOURS`,
    `RADAR_INITIAL_RADIUS_KM` ≤ `RADAR_EXPANDED_RADIUS_KM`.
  - STRING `*_EMBARGO_START|END`: `HH:mm`.
  - Anything else → `400 INVALID_CONFIG_VALUE` with a readable message.
- One transaction: rows locked (`FOR UPDATE`, so two Admins cannot break a pair together), value stored with
  `updated_by`, `audit_logs` `UPDATE_CONFIG` with `{ key, value }` old and new (+ the Admin's `note`).
- After COMMIT: `invalidateConfig()` — this instance uses the new value at once; others within `CONFIG_CACHE_TTL_MS` (60 s).
- Same value again → the item unchanged, nothing written, no audit.

New keys with a meaning the guard rails do not cover: add a line to `admin-configs.policy.ts` in the same MR as the migration.
