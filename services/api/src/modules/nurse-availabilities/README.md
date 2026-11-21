# Module `nurse-availabilities` (BE-2 / Dev B · Phase 2)

A nurse's weekly free windows, one-date open hours and time-off (board N13 on Nurse Web / App).

- **SRS:** FR-SCHED-01 · **Rules:** BR-03 §2.5 · **Contract:** [`docs/api/nurse-availabilities.api.md`](../../../../../docs/api/nurse-availabilities.api.md)
- **Endpoints:** `GET /api/v1/nurse/availabilities`, `PUT /api/v1/nurse/availabilities` (NURSE, own schedule only)
- **Migration:** `0008` — overnight windows (`end_time <> start_time`) and the `DATE_AVAILABLE` type.

## Files
| File | Role |
|---|---|
| `nurse-availabilities.policy.ts` | **pure**: body → rows (drops stale dates), `findLockedBooking` |
| `nurse-availabilities.service.ts` | GET view; PUT = one transaction: lock nurse row → lock check → delete → insert |
| `nurse-availabilities.repo.ts` | SQL (single `unnest` INSERT), calendar bookings |
| `.routes.ts` / `.schema.ts` / `.types.ts` | HTTP, strict validation, DTOs (same shapes as FE-2's `availability.types.ts`) |

## Rules
- PUT replaces the whole schedule atomically; any error leaves the old schedule untouched.
- **409 `AVAILABILITY_LOCKED`** when the new schedule stops covering a `CONFIRMED` / `IN_PROGRESS` shift the old one
  covered (removing or shrinking its window, or adding time-off on it). Shifts never covered (legacy data) do not block.
- Overlapping windows are accepted and merged by the engine.
- The nurse row (`nurse_profiles`) is locked during the save — Phase 3 booking acceptance must lock it too.
- Effective availability is **not** computed here: see `availability-engine`.

## Tests
- `test/unit/nurse-availabilities.test.ts` — schema (FE payload), stale-date pruning, lock rule.
- `test/integration/nurse-availabilities.test.ts` — PUT/GET round trip, atomic replace, 409, 403 + exit criteria.

## Notes for the team
- **FE-2:** set `VITE_USE_MOCK_AVAILABILITY=false`. Errors to show: `AVAILABILITY_LOCKED` (`details.bookingCode`),
  `VALIDATION_ERROR`. The server's ids replace the client's after every save.
- **BE-3 (`nurse-search`):** filter ACTIVE / deposit / Tier / gender / area first, then
  `findAvailableNurses(db, { nurseIds, start, end })` when the customer picked a time slot.
- **BE-1 (seed):** sample nurses for search need `nurse_availabilities` rows, or the engine will exclude them.
