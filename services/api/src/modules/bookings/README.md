# Module `bookings` (BE-2 / Dev B · Phase 3)

Customers get a quote, create a booking and read their bookings.

- **SRS:** FR-BOOK-01/02/03 · **Rules:** BR-03, BR-14 · US-HP-09 · **Contract:** [`docs/api/bookings.api.md`](../../../../../docs/api/bookings.api.md)
- **Endpoints (PATIENT):** `POST /bookings/quote`, `POST /bookings/prescription/upload-url`, `POST /bookings`, `GET /bookings`, `GET /bookings/:id`
- **Migration 0009:** config keys `URGENT_BOOKING_LEAD_HOURS`, `RADAR_WINDOW_MINUTES`; DB trigger that refuses prohibited services.

| File | Role |
|---|---|
| `bookings.policy.ts` | **pure**: slot rules, prescription date rule, booking code |
| `bookings.service.ts` | gates → price → INSERT (one transaction) → follow-up jobs |
| `bookings.repo.ts` | SQL |
| `bookings.jobs.ts` | temporary placeholder for `booking-expiry.payment-timeout` (BE-3 owns the real handler) |
| `.routes.ts` / `.schema.ts` / `.types.ts` | HTTP, strict validation, DTOs (FE-1 shapes) |

## Rules
- Amounts come only from `pricing-engine`; the snapshot on the row never changes.
- Prohibited services: 403 in the service **and** a DB trigger. There is no Admin booking route.
- Consent + eKYC: `assertCanBookForProfile` (patient-profiles) inside the booking transaction.
- `BANK_TRANSFER` → `DRAFT` + 15-minute hold (`PAYMENT_TIMEOUT_MINUTES`); `CASH` → `MATCHING` immediately.
- Timers go through the shared job queue only.

## Tests
- `test/unit/bookings.test.ts` — slot, prescription, schema, routing, eligibility gate, distance.
- `test/integration/bookings-matching.test.ts` — the whole flow on PostgreSQL.

## Notes for the team
- **BE-3:** see contract §4 — call `activateMatching` in the webhook transaction, register the real
  `booking-expiry.payment-timeout` handler, then delete `bookings.jobs.ts`.
- **BE-1:** prescription layer 1 is a minimal check here; move it behind your `prescription-gate` when it lands.
- **Dev C's tests:** four `privacy-consent-*` integration tests picked the first service by code, which is a prohibited
  one; they now add `NOT is_prohibited` (the new trigger refuses such rows).
