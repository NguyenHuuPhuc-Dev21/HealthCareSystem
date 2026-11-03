# ADR-0003 — HTTP framework: Express 4

- **Status:** Proposed (Dev A / BE-1, Phase 0) — becomes Accepted when BE-2 and BE-3 approve the MR
- **Date:** 2026-11-03
- **Related:** ADR-0002 (SQL-first data layer), `services/api/src/app.ts`, `services/api/src/core/middleware`

## Context

`services/api` had no HTTP framework: `index.ts` never listened on a port, and the Phase 0
middleware stubs were already written in the Express `(req, res, next)` style. Three backend
developers need one shared way to declare routes, guards and error responses from Phase 1 on.

## Decision

Use **Express 4** with:

- `createApp()` in `src/app.ts` (no `listen()`, so tests mount the app in-process with supertest);
- one router per module, mounted under `API_PREFIX` (`/api/v1`) in `buildApiRouter()`;
- request validation with **Zod** through `validateBody(schema)` (whitelist: strict schemas);
- services throw `AppError` (`src/core/errors.ts`); a single `errorHandler` produces
  `{ success: false, error: { code, message, details? } }` and never leaks internal messages on 500;
- `authGuard` **fails closed** until `accounts-otp` registers a verifier via `setTokenVerifier()`;
- nurse tier / `profile_status` checks read `nurse_profiles` from the database on every request
  (`requireNurseEligibility`) — never from token claims.

## Alternatives considered

- **Fastify** — faster and has built-in schema validation, but the existing middleware would need
  rewriting and the team has more Express experience. Throughput is not a bottleneck for the MVP.
- **NestJS** — strong structure, but its module/DI conventions conflict with the agreed flat
  8-file module layout and add a learning curve mid-project.

## Consequences

- Async handlers must forward errors with `next(err)` (Express 4 does not catch rejected promises).
  The shared middlewares already do this; module routes should wrap handlers the same way.
- Upgrading to Express 5 later removes that wrapper need; it is a contained change in `core/`.
