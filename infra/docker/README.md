# Local Infrastructure & Docker Compose

Contains local container definitions for developing against real PostgreSQL 16 and Redis services.

## Starting Local Services

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

- **PostgreSQL 16:** `localhost:5432`, Database: `healthcare_dev`, User: `postgres`, Password: `postgrespassword`
- **Redis 7:** `localhost:6379`

## Backup & PITR profile (BE-2 · Phase 8)

`docker-compose.dr.yml` turns on continuous WAL archiving (`archive_timeout` 300 s) for the dev PostgreSQL, adds a
`pg_backups` volume (`/backups`) and mounts `infra/dr` at `/dr`:

```bash
npm run docker:up:dr   # same data volume, archiving on
npm run dr:drill       # backup → point-in-time restore on port 5433 → PASS / FAIL
```

Procedure and production settings: [`docs/runbooks/backup-pitr-dr-drill.md`](../../docs/runbooks/backup-pitr-dr-drill.md).
