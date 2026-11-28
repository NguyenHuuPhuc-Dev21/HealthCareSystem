# API — admin-configs (BE-1 · Phase 7 · SRS §5.1)

Base `/api/v1`. **ADMIN only** (`Authorization: Bearer …`). Envelope `{ success, data }` / `{ success: false, error: { code, message } }`.
Shapes follow what admin-web proposed (`apps/admin-web/src/features/configs`).

Config item:

```json
{
  "key": "PLATFORM_COMMISSION_RATE",
  "value": "0.15",
  "dataType": "NUMBER",
  "description": "…",
  "updatedBy": { "id": "uuid", "name": "Quản trị viên" },
  "updatedAt": "2026-11-28T10:00:00.000Z"
}
```

`value` is the stored string (`VARCHAR(500)`). `updatedBy` is `null` while the value is still the one a migration seeded.

## GET /admin/configs → `{ items: ConfigItem[] }`
Every key, ordered by key.

## PATCH /admin/configs/:key → `ConfigItem` (after the change)

Body (strict): `{ "value": "0.2", "note": "Theo quyết định PO ngày 26/11" }` — `value` string ≤ 500, `note` optional ≤ 200 (kept in the audit record only).

| Status | Code | When |
|---|---|---|
| 404 | `CONFIG_NOT_FOUND` | no such key (keys are added by migrations only) |
| 400 | `INVALID_CONFIG_VALUE` | wrong type; negative; `*_RATE` outside 0–1; `TRUST_*` > 100; stars outside 1–5; not a whole number (durations, counts, VND); below 1 where 0 would switch a feature off (TTL, window, timeout, max…); `*_EMBARGO_START/END` not `HH:mm`; an ordered pair broken (nurse share ≤ fee, late-cancel hours ≤ free-cancel hours, initial radar radius ≤ expanded). `message` says which. |
| 400 | `VALIDATION_ERROR` | body is not `{ value, note? }` |

The same value again → `200` with the item unchanged; nothing written, no audit.
Effect: this API instance at once; other instances within 60 s (`CONFIG_CACHE_TTL_MS`).
Audit: `UPDATE_CONFIG`, `old_value { key, value }`, `new_value { key, value, note? }`, actor = Admin, IP.
