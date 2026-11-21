# Module `nurse-search` (BE-3 / Dev C · Phase 2)

Patients find and view verified nurses before booking.

- **SRS:** FR-SEARCH-01 · **Rules:** FR-PAY-03 rules 6–10 (ADR-0004 D2), BR-03 §2.5 · **Contract:** [`docs/api/nurse-search.api.md`](../../../../../docs/api/nurse-search.api.md)
- **Endpoints (PATIENT):** `GET /nurses/search`, `GET /nurses/:nurseId`
- **Jobs:** none. Read-only module (no writes, no audit log).

| File | Role |
|---|---|
| `nurse-search.policy.ts` | **pure**: card + exact gate (reuses matching-radar / tier-lifecycle), sort, paging |
| `nurse-search.service.ts` | `search`, `getProfile`; avatar signing (10 min) |
| `nurse-search.repo.ts` | SQL: service lookup, candidate pre-filter (same gate columns as matching-radar), reviews |
| `nurse-search.schema.ts` / `.routes.ts` / `.types.ts` | query validation, HTTP, shapes |

## Rules
- **Search = matching.** No own eligibility or availability logic: `eligibilityBlocker` / `depositAllows` / `distanceKm`
  (matching-radar), `isTier2ValidOn` (tier-lifecycle), `findAvailableNurses` (availability-engine). A nurse shown here
  passes the same checks a claim makes — and the claim still re-checks everything under locks.
- Tier is judged on the **shift date**; the card shows that effective tier.
- Deposit (ADR-0004 D2): `paymentMethod` given → exact gate for that method. Not given → gate as `BANK_TRANSFER`
  (most permissive) and `cashAllowed` tells the client whether cash also works (false = nurse in grace).
- Radius: default and maximum = `RADAR_EXPANDED_RADIUS_KM` (10 km). Nurses with no known position are not shown.
- Never returned: phone, email, exact position, `trust_score`, wallet / grace data, GPHN number.

## Notes for the team
- **FE-1:** call `GET /nurses/search` with the care location of the chosen patient profile; send `paymentMethod`
  once the patient has picked it, otherwise show a "chỉ nhận chuyển khoản" badge when `cashAllowed = false`.
- **BE-2 (bookings DIRECT_REQUEST):** the target nurse must pass the same gate; reuse `eligibilityBlocker` +
  `assertNurseAvailable` at create / claim time — search results are not a reservation.
- Up to 2,000 nearest candidates are checked per search (availability-engine limit).
