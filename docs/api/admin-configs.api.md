# API — admin-configs (BE-1 · Phase 7 · SRS §5.1)

Base `/api/v1`. **ADMIN only** (`Authorization: Bearer …`). Envelope `{ success, data }` / `{ success: false, error: { code, message } }`.

## GET /admin/configs

```json
{
  "PLATFORM_COMMISSION_RATE": { "value": 0.15, "dataType": "NUMBER", "description": "…", "updatedAt": "2026-11-23T11:00:00.000Z", "updatedBy": null },
  "…": {}
}
```
`updatedBy` = Admin user id of the last change; `null` = value seeded by a migration.

## PATCH /admin/configs/:key

Body (strict): `{ "config_value": 0.2 }` — a number, a numeric string, `true`/`false`, or JSON, matching the key's `dataType`.

`200`: `{ "updated": true, "key": "SURCHARGE_NIGHT_SHIFT", "value": 0.2 }` (`updated: false` when the value did not change).

| Status | Code | When |
|---|---|---|
| 404 | `CONFIG_NOT_FOUND` | no such key (keys are added by migrations only) |
| 422 | `INVALID_CONFIG_VALUE` | wrong type, negative, rate > 1, TrustScore > 100, not a whole number, below 1 where 0 would disable a feature, or an ordered pair broken — `message` says which |
| 400 | `VALIDATION_ERROR` | body is not `{ config_value }` |

Effect: this API instance at once; other instances within 60 s (`CONFIG_CACHE_TTL_MS`). Audit: `UPDATE_CONFIG`, old/new `{ key, value }`.
