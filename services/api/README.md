# Backend API Service (`@healthcare-system/api`)

Backend RESTful API and background worker service implementing the business rules and domain logic of the Home-Care Nursing Platform. HTTP framework: Express 4 (ADR-0003). Data layer: SQL-first with `pg` (ADR-0002).

## Run locally

```bash
# from the repository root
npm install
npm run build --workspace=packages/shared     # services/api imports the built shared package
cp services/api/.env.example services/api/.env
npm run docker:up                              # PostgreSQL 16 + Redis + MinIO (private bucket)
npm run db:migrate                             # applies db/migrations then db/seeds, tracked in schema_migrations
npm run dev:api                                # http://localhost:3000/api/v1/health
```

If your local volume was created by an older compose file (schema loaded by the container), reset it once:
`npm run docker:down -- -v && npm run docker:up && npm run db:migrate`.

## Tests

```bash
npm run test:unit --workspace=services/api
# integration: needs a throw-away database whose name contains "test"
createdb -h localhost -U postgres healthcare_test
TEST_DATABASE_URL=postgresql://postgres:postgrespassword@localhost:5432/healthcare_test \
  npm run test:integration --workspace=services/api
```

## Core services (`src/core/`) — agreed internal interfaces

| Module | Owner | Use it for |
|---|---|---|
| `database` | BE-1 | `query(sql, params)`, `withTransaction(async (client) => …)`, type `DbClient` (the `dbTx` passed to `recordLedgerTransaction`) |
| `database/migrator` | BE-1 | `npm run db:migrate`; never edit a merged migration — add `000N_*.sql` (ask BE-1 for the next number) |
| `config` | BE-1 | `getConfig(key)`, `getConfigNumber(key)`, `invalidateConfig()`; missing keys throw — add them by migration |
| `storage` | BE-1 | `buildObjectKey`, `createUploadUrl`, `statObject`, `createDownloadUrl` (≤ 10 min) |
| `errors` | BE-1 | throw `AppError` / `badRequest` / `forbidden` … from services |
| `middleware` | BE-1/2/3 | `authGuard`, `roleGuard`, `requireNurseEligibility(tier)`, `validateBody(schema)` |
| `jobs` | BE-2 | `scheduleJob`, `cancelJob` — no ad-hoc `setTimeout` deadlines |
| `audit`, `notifications` | BE-3 | `writeAuditLog`, `dispatchNotification` |

## Module Structure

Each domain module lives in `src/modules/<module-name>/` following the 8-file convention outlined in `docs/development/development_checklist.md`:
- `README.md` — Domain scope and traceability
- `<module>.routes.ts` — Endpoint routing & auth bindings
- `<module>.service.ts` — Business rule decision engine
- `<module>.repo.ts` — Parameterized SQL queries
- `<module>.policy.ts` — Authorization checks (BR-09)
- `<module>.jobs.ts` — Schedulers & background tasks
- `<module>.types.ts` — DTOs & request contracts
- `<module>.schema.ts` — Input whitelist schemas
