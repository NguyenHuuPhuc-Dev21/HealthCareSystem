# ADR 0002: SQL-First PostgreSQL 16 Database Layer

## Status
Accepted

## Context
The platform implements complex business rules (BR-01–BR-23), strict multi-tenant data segregation, exclusion constraints for nurse scheduling, and an append-only double-entry financial ledger. Relying exclusively on application-layer ORM abstractions risks concurrency race conditions and silent constraint bypass.

## Decision
We adopt a **SQL-First Architecture**:
1. PostgreSQL 16 schema definitions, constraints, indexes, and migrations in `db/migrations/` serve as the foundation of truth.
2. Complex constraints (partial uniqueness, GiST exclusion constraints for overlapping schedules, CHECK constraints for staff 2FA) are enforced directly in the database engine.
3. The application repository layer executes parameterized SQL queries, with automated Tier 1 constraint tests (`db/tests/`) running in CI.

## Consequences
- Guarantees data integrity and prevents race conditions at the lowest-cost tier.
- Requires team discipline in authoring sequential, forward-only SQL migrations.
