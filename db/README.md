# Database Migrations, Seeds & Constraint Tests

This directory manages the PostgreSQL 16 relational database layer:
- `migrations/` — Forward-only SQL migrations (`0001_initial_schema.sql`)
- `seeds/` — Canonical test fixtures and reference scenarios (`001_reference_and_demo.sql` for encounter #MH-8824)
- `tests/` — Automated constraint and exclusion tests validating ERD-2 page 15 rules (Tier 1 of the Test Strategy)
