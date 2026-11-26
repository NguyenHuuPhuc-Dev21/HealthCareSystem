# ops-monitoring API (BE-3 · Phase 8 · operational monitoring & alerting)

`GET /api/v1/admin/ops/health` — ADMIN only. Liveness without auth stays `GET /api/v1/health`.

```json
{ "success": true, "data": {
  "status": "ALERT",
  "checkedAt": "2026-11-26T03:00:00.000Z",
  "checks": [
    { "name": "JOB_BACKLOG", "status": "OK", "summary": "Job queue healthy",
      "value": { "waiting": 0, "active": 1, "delayed": 12, "failed": 0, "deadLetters": 0 }, "runbook": "monitoring-and-alerts.md" },
    { "name": "SETTLEMENT_LAG", "status": "ALERT", "summary": "2 shift(s) (1000000 VND) not settled 120 min after the cooling window",
      "value": { "count": 2, "amount": 1000000, "oldestCheckout": "…" }, "runbook": "settlement-job-monitoring.md" }
  ] } }
```

| Check | OK / WARN / ALERT |
|---|---|
| `JOB_BACKLOG` | ALERT when waiting > `JOB_BACKLOG_ALERT_THRESHOLD` or dead letters > 0 |
| `WEBHOOK_FAILURES` | problem outcomes in the last `OPS_WEBHOOK_WINDOW_MINUTES`: WARN ≥ `OPS_WEBHOOK_WARN`, ALERT ≥ `OPS_WEBHOOK_ALERT` |
| `SOS_UNACKNOWLEDGED` | ALERT: an SOS push unacknowledged > `OPS_SOS_ACK_ALERT_MINUTES` |
| `URGENT_DELIVERY_FAILURES` | WARN: failed HIGH push; ALERT: failed SMS fallback |
| `CASH_COMMISSION_OVERDUE` | WARN: overdue; ALERT: overdue + nurse still ACTIVE after `OPS_COMMISSION_SWEEP_GRACE_MINUTES` |
| `SETTLEMENT_LAG` | ALERT: transfer shift unpaid after cooling + `OPS_SETTLEMENT_LAG_MINUTES` |
| `FINANCE_HOLDS` | WARN: open settlement hold / reconciliation mismatch |
| `LEDGER_DRIFT` | ALERT: Σ wallets ≠ Σ ledger (escrow / available / deposit) |

`status` = the worst check. `UNKNOWN` = the check could not run in 5 s (Redis down, …) — never reported as OK.

Job `ops-monitoring.sweep` (every 5 min) logs `[OPS][ALERT] {…}` and notifies every active Admin (notification type
`OPS_ALERT`, `data: { check, runbook }`) at most once per `OPS_ALERT_REPEAT_MINUTES` per check.
Runbooks: `docs/runbooks/monitoring-and-alerts.md`.
