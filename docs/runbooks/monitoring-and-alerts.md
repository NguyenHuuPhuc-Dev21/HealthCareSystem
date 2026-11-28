# Monitoring & Alerts — what each alert means and which runbook to follow

> BE-3 · Phase 8 · module `ops-monitoring`. Owner: BE-3. Contract: `docs/api/ops-monitoring.api.md`.

## Where alerts come from

- **Job `ops-monitoring.sweep`** (worker, every 5 min) runs every check. Each check in `ALERT`:
  - writes one log line `[OPS][ALERT] {"check":…,"summary":…,"value":…,"runbook":…}` (ship this to the log platform);
  - notifies every active Admin in-app + push (type `OPS_ALERT`, HIGH only for SOS), at most once per
    `OPS_ALERT_REPEAT_MINUTES` (default 60) per check — a still-open problem is re-notified every hour.
- **`GET /api/v1/admin/ops/health`** (Admin) shows every check now: `OK | WARN | ALERT | UNKNOWN`.
  `UNKNOWN` = the check could not run (Redis down, query > 5 s) — treat as an incident on its own, never as OK.

## Check → runbook

| Check | ALERT when | First look | Runbook |
|---|---|---|---|
| `JOB_BACKLOG` | waiting jobs > `JOB_BACKLOG_ALERT_THRESHOLD` (100) or any dead letter | worker process up? Redis up? `deadLetters` list in the DLQ | below |
| `WEBHOOK_FAILURES` | ≥ `OPS_WEBHOOK_ALERT` (3) problem webhooks in `OPS_WEBHOOK_WINDOW_MINUTES` (60) | `payment_webhook_events` by outcome | `payment-webhook-failure.md` |
| `SOS_UNACKNOWLEDGED` | an SOS push unacknowledged > `OPS_SOS_ACK_ALERT_MINUTES` (2) | call the family / nurse **now** | `sos-response.md` |
| `URGENT_DELIVERY_FAILURES` | an SMS fallback FAILED (push failures alone = WARN) | SMS/ZNS provider status, phone numbers | below |
| `CASH_COMMISSION_OVERDUE` | an overdue commission whose nurse is still ACTIVE after `OPS_COMMISSION_SWEEP_GRACE_MINUTES` (15) | is `cash-commission.overdue-sweep` running? | `cash-commission-overdue.md` |
| `SETTLEMENT_LAG` | a transfer shift unpaid > cooling (24 h) + `OPS_SETTLEMENT_LAG_MINUTES` (120) after check-out | is `settlements.sweep` running? errors in its log? | `settlement-job-monitoring.md` |
| `FINANCE_HOLDS` (WARN) | open settlement hold or reconciliation mismatch | Admin finance queues | `deposit-and-wallet-reconciliation.md` |
| `LEDGER_DRIFT` | Σ wallet balance ≠ Σ ledger for escrow / available / deposit | `GET /admin/finance/reconciliation` `checks[]` | `deposit-and-wallet-reconciliation.md` |

Thresholds are operational (env `OPS_*`, see `services/api/.env.example`), not business rules.

## Job backlog / dead letters

1. Is the worker running (`npm run worker` / container)? A stopped worker → every timer (payment timeout, settlement,
   SMS fallback, sweeps) waits. Restart it; jobs are idempotent and safe to run late.
2. Redis reachable (`docker ps`, `redis-cli ping`)? The API stays up without Redis but nothing is scheduled.
3. Dead letters: a job that failed `JOB_MAX_ATTEMPTS` (5) times. Read its last error in the worker log, fix the
   cause, then re-run it (every BE-3 handler is idempotent: re-running cannot move money twice).
4. Never delete the queue or the Redis volume to "clear" a backlog — pending timers would be lost.

## Failed urgent deliveries (SMS fallback / push)

1. `SELECT channel, delivery_status, count(*) FROM notifications WHERE priority = 'HIGH' AND created_at > now() - interval '24 hours' GROUP BY 1, 2;`
2. SMS failed: provider outage or a bad phone number (`users.phone`). For an SOS / urgent case, call the person.
3. In the MVP, FCM and SMS/ZNS are simulated (logged) — a FAILED row in dev means the provider adapter threw.

## Escalation

ALERT on `SOS_UNACKNOWLEDGED` → on-call immediately. Money alerts (`LEDGER_DRIFT`, `SETTLEMENT_LAG`,
`WEBHOOK_FAILURES`) → BE-3 within the business day; never fix money by editing rows — compensating ledger
entries only (`deposit-and-wallet-reconciliation.md`). Write an incident note for every ALERT that needed a person.
