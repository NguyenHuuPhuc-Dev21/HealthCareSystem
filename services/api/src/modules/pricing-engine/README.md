# Module `pricing-engine` (BE-2 / Dev B · Phase 3)

The only place a booking price is computed. No HTTP routes of its own (`POST /bookings/quote` lives in `bookings`).

- **SRS:** FR-BOOK-01 · **Rules:** BR-03 §2.2 · RTM TC-PRICE-01 · **Contract:** [`docs/api/bookings.api.md` §1](../../../../../docs/api/bookings.api.md)

`total = base + night + holiday + heavy patient`; each surcharge is a % of the **base** (no compounding); integer VND.
Rates: `SURCHARGE_NIGHT_SHIFT`, `SURCHARGE_HOLIDAY_MAJOR`, `SURCHARGE_HOLIDAY_MINOR`, `SURCHARGE_HEAVY_PATIENT`,
`PLATFORM_COMMISSION_RATE` from `system_configs`; holiday dates from `public_holidays` (type decides the rate).
Night window 22:00–06:00 and the 80 kg threshold are SRS definitions in `packages/shared/constants`.

| File | Role |
|---|---|
| `pricing-engine.policy.ts` | **pure** `computeQuote`, `nightMinutes`, `isHeavyPatient`, `toSnapshot` |
| `pricing-engine.service.ts` | `quotePrice(db, …)` — loads rates + holidays, then calls the pure engine |

Tests: `test/unit/pricing-engine.test.ts` (both SRS examples, 22:00 / 06:00 boundaries, holiday share, no compounding).

Note: `public_holidays` is seeded for 2026 only — Tết 2027 must be added before bookings for those dates are priced.
