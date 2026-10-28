# ADR 0002: SQL-First PostgreSQL Database Layer

## Status
Accepted — **Revised per SRS v2.0 (Updated, 28/10/2026)**; the SQL-first decision is unchanged, its context is updated to the marketplace model.

## Context
The platform's correctness rests on database-level guarantees defined by SRS v2.0: a **16-table PostgreSQL schema** (SRS §7) with explicit foreign keys (e.g., `nurse_credentials.reviewed_by` → `users.id`), an **append-only wallet ledger** (`wallet_transactions` with a UNIQUE `idempotency_key`, `balance_before`/`balance_after`), **schedule-conflict prevention** across nurse availabilities and confirmed bookings (with a 60-minute travel buffer), a 3-axis booking state machine, and `nurse_profiles.profile_status` as the single source of truth for job-claim rights. Relying exclusively on application-layer ORM abstractions risks concurrency race conditions (double job claims, double settlement) and silent constraint bypass.

## Decision
We adopt a **SQL-First Architecture**:
1. PostgreSQL schema definitions, constraints, indexes, and migrations in `db/migrations/` serve as the foundation of truth for the SRS §7 16-table schema.
2. Complex constraints are enforced directly in the database engine: partial uniqueness, GiST exclusion constraints for overlapping nurse schedules/bookings where expressible, CHECK constraints for enum domains (roles, tiers, the three booking status axes, wallet transaction types), the UNIQUE `idempotency_key` on `wallet_transactions`, and append-only protection (no `UPDATE`/`DELETE` grants) on `wallet_transactions` and `audit_logs`.
3. The application repository layer executes parameterized SQL queries, with automated constraint tests (`db/tests/`) running in CI — including the SRS §10 schema acceptance checks (TC-DB-01: 16 tables present, `reviewed_by` FK integrity).

## Consequences
- Guarantees data integrity and prevents race conditions at the lowest-cost tier — the same layer that enforces first-come job claiming (`SELECT … FOR UPDATE`) and exactly-once settlement.
- Requires team discipline in authoring sequential, forward-only SQL migrations, and expressing new SRS rules (e.g., Phase 2 partial settlement) as schema changes plus tests, not application-only logic.
