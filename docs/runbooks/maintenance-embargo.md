# Maintenance Embargo — Shift Handover 19:00–21:00

> **SRS v2.0 NFR-AVAIL-01:** "ưu tiên không bảo trì hệ thống vào khung giờ chuyển giao ca đêm 19:00 - 21:00".
> Day shifts check out and night shifts check in; families follow the handover. Owner: BE-2 (Phase 8).

## Rule

No migration, deploy, restart, backup-heavy job or planned downtime between **19:00 and 21:00 Vietnam time**
(window from `system_configs` `MAINTENANCE_EMBARGO_START` / `_END`, migration 0028; default 19:00–21:00).

## Enforcement

| Where | What happens inside the window |
|---|---|
| `npm run db:migrate` | `NODE_ENV=production` (or `MAINTENANCE_EMBARGO=enforce`): pending migrations are **refused** before anything is applied. Dev / CI: warning only. Nothing pending → nothing to refuse. |
| `npm run ops:embargo-check` | exit code **3** → first step of every deploy job / manual maintenance; exit 0 outside the window |
| Recurring jobs | unit test `maintenance-embargo.test.ts` fails if a daily job (GPHN sweep 00:05, deposit reconciliation 01:30, refund eligibility 02:15, retention purge 03:00, …) is scheduled inside the window. Frequent sweeps (every 1–5 min, hourly reveal) are normal operation, not maintenance. |
| Backups | `infra/dr/backup.sh` scheduled 03:30 |

## Emergency override

Only to fix an incident that cannot wait until 21:00 (money moving wrongly, data loss, security):

```bash
npm run db:migrate -- --no-seeds --override-embargo="Sửa lỗi trừ ký quỹ sai từ 19:10 — INC-0042"
npm run ops:embargo-check -- --override-embargo="…"
```

The reason (≥ 10 characters) is printed as `[embargo] OVERRIDE` in the deploy log; mention it in the incident report.
