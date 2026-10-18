# Backend API Service (`@healthcare-system/api`)

Backend RESTful API and background worker service implementing the business rules and domain logic of the Home-Care Nursing Platform.

## Module Structure

Each domain module lives in `src/modules/<module-name>/` following the 8-file convention outlined in `docs/development/development_checklist.md`:
- `README.md` — Domain scope and traceability
- `<module>.routes.ts` — Endpoint routing & auth bindings
- `<module>.service.ts` — Business rule decision engine
- `<module>.repo.ts` — Tenant-filtered SQL queries
- `<module>.policy.ts` — 4-factor authorization checks (BR-09)
- `<module>.jobs.ts` — Schedulers & background tasks
- `<module>.types.ts` — DTOs & request contracts
- `<module>.schema.ts` — Input whitelist schemas

Cross-cutting infrastructure components reside in `src/core/`.
