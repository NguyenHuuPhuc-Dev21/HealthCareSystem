# Module `ops-monitoring` (BE-3 / Dev C · Phase 8)

Operational monitoring & alerting: job queue backlog, webhook failures, unacknowledged SOS, failed urgent deliveries,
overdue cash commissions, settlement lag, finance holds, ledger drift. Contract: `docs/api/ops-monitoring.api.md`.
Runbook: `docs/runbooks/monitoring-and-alerts.md`.

| File | What |
|---|---|
| `ops-monitoring.types.ts` | check names, thresholds (env `OPS_*`, operational — not business rules) |
| `ops-monitoring.policy.ts` | status rules (pure) |
| `ops-monitoring.repo.ts` | one read-only query per check |
| `ops-monitoring.service.ts` | `health()` (each check ≤ 5 s, else UNKNOWN) and `sweep()` (log + notify Admins, deduplicated in Redis) |
| `ops-monitoring.routes.ts` | `GET /admin/ops/health` |
| `ops-monitoring.jobs.ts` | `ops-monitoring.sweep` every 5 minutes |

**For the `sos` module (FR-SHIFT-05):** send the alert with `notifyUser({ type: 'SOS', priority: HIGH, … })` — the
`SOS_UNACKNOWLEDGED` check watches notification types `SOS` / `SOS_ALERT`.

Tests: `test/unit/ops-monitoring.test.ts`, `test/integration/ops-monitoring.test.ts`. Financial concurrency
(Phase 8): `test/integration/finance-concurrency.test.ts`.
