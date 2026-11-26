# Backup, Point-in-Time Recovery & DR Drill

> **SRS v2.0 NFR-AVAIL-01 (CT-23):** daily automated snapshot of the whole PostgreSQL database + Point-in-Time
> Recovery. **RPO ≤ 1 h** for wallet transactions, **≤ 24 h** for logs; **RTO ≤ 4 h**. Uptime ≥ 99.5 %, no planned
> maintenance 19:00–21:00 (see [`maintenance-embargo.md`](./maintenance-embargo.md)).
> Owner: BE-2 (Phase 8). Tooling: `infra/dr/`, `npm run ops:dr-verify`.

## 1. How the targets are met

| Target | Mechanism | Setting |
|---|---|---|
| Daily snapshot | `infra/dr/backup.sh` — `pg_basebackup` (tar + gzip, WAL included, SHA-256 manifest), kept `RETENTION_DAYS` (7) | cron `30 3 * * *` (outside 19:00–21:00) |
| RPO wallets ≤ 1 h | continuous WAL archiving; a segment is closed and shipped at least every `archive_timeout` | `wal_level=replica`, `archive_mode=on`, `archive_timeout=300` → ≤ 5 min |
| RPO logs ≤ 24 h | `audit_logs`, chat, shift logs live in the same database → same ≤ 5 min | — |
| RTO ≤ 4 h | `infra/dr/restore.sh` restores base + replays WAL into a new data directory and promotes | measured by every drill |
| Off-site copy | production: ship `/backups/wal` and `/backups/base` to object storage in another zone (or use the provider's managed PITR, e.g. RDS / Cloud SQL, with the same settings) | DevOps |

The ledger tables are append-only (DB triggers), so "no lost transaction up to the target" is checked row-for-row.

## 2. Local drill (developer machine, Docker)

```bash
npm run docker:up:dr        # dev Postgres + WAL archiving + /backups volume + scripts at /dr (data volume kept)
npm run dr:drill            # backup → probe writes → PITR to a chosen instant → checks → stops the copy
```

`drill.sh` writes only to its own database `dr_probe`: two rows before the target, one after. PASS means the two
"before" rows came back and the "after" row did not (recovery stopped exactly at the target), and the restore time
fits 4 h. Sample output (sandbox run, 2026-11-26):

```
DR drill 20261126T011540Z
  target           : 2026-11-26 01:15:42.030546 +00:00
  before / after   : 2 of 2 present / 0 of 1 present (expected 2 / 0)
  restore time     : 1 s (RTO budget 14400 s)
RESULT: PASS
```

To also check the application data on the restored copy:

```bash
docker exec -u postgres -e KEEP_RESTORED=1 healthcare_postgres sh /dr/drill.sh
npm run ops:dr-verify -- --restored=postgresql://postgres:<pw>@localhost:5433/healthcare_dev \
                         --source=postgresql://postgres:<pw>@localhost:5432/healthcare_dev \
                         --target="<target printed by the drill>"
docker exec -u postgres healthcare_postgres pg_ctl -D /tmp/pitr-drill stop -m fast
```

`ops:dr-verify` (read-only) checks: restored server promoted · every `db/migrations` file applied · the 11 critical
triggers (append-only ledger / audit / settlements / webhooks, prohibited services, deposit suspension, chat
evidence) present and enabled · rows created up to the target identical to the source for `wallet_transactions`,
`audit_logs`, `bookings`, `conversations_messages` · every wallet balance = its ledger · WAL archiving healthy on the
source. Exit 1 on any FAIL. On a dev database the ledger check shows WARN (test fixtures create wallets without
ledger rows) — it only FAILs when the restored copy is worse than the source.

## 3. Real incident — restore procedure

1. **Declare** the incident, note the time `T_incident`, pick the target: the last moment before the damage
   (bad deploy, wrong mass update) or "latest" for a lost server. Freeze writes (maintenance page) if the live DB
   is still up.
2. **Restore** on the standby host (never over the live data directory):
   `sh infra/dr/restore.sh LATEST "<target, with time zone>" 5433 /var/lib/postgresql/pitr`
   (base backup older than the target; WAL from `/backups/wal` or the off-site copy).
3. **Verify** with `npm run ops:dr-verify -- --restored=<url> [--source=<url of the damaged db if readable>] --target=…`.
   Any FAIL → stop, choose an earlier base backup / target.
4. **Reconcile money** before reopening: run the deposit reconciliation job and BE-3's financial report for the
   window `target → T_incident`; payment-gateway webhooks received in that window are replayed (they are
   idempotent on `idempotency_key`).
5. **Switch** `DATABASE_URL` of API + worker to the restored server, restart (outside 19:00–21:00 unless the
   incident forces it — then `--override-embargo`), re-enable WAL archiving and take a fresh base backup at once.
6. **Record** RPO (`T_incident − target`, data actually lost) and RTO (declaration → service back) in the incident
   report.

## 4. Drill schedule & record

- Local: before each release touching migrations. Staging: monthly, with production-size data, on the same
  infrastructure as production (that is the RTO that counts). Never between 19:00 and 21:00.
- Record each drill: date, base backup, target, restore time, `ops:dr-verify` result, operator.

| Date | Environment | Restore time | RPO observed | dr-verify | Operator |
|---|---|---|---|---|---|
| 2026-11-26 | sandbox (PG 16, script validation) | 1 s | 0 rows lost before target | drill PASS | BE-2 |
