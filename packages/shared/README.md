# Shared Domain Library (`@healthcare-system/shared`)

This package is the authoritative single source of truth for:
- Enums across all database schemas and domain models (`enums.ts`)
- Common Data Transfer Object (DTO) contracts (`types.ts`)
- Non-negotiable architectural constants and limits (`constants.ts`)

Any modification to status enums or lifecycle states must be coordinated here and validated against `docs/database/schema.sql`.
