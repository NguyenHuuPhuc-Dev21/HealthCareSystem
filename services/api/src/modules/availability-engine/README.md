# Module `availability-engine` (BE-2 / Dev B · Phase 2)

The single answer to "is this nurse free for this slot?" — used by nurse search (BE-3) **and** matching / booking
acceptance (BE-2, Phase 3). No HTTP routes.

- **SRS:** FR-SCHED-01 · **Rules:** BR-03 §2.5, BR-14 §2.5 · Phase 2 exit criteria
- **Contract:** [`docs/api/nurse-availabilities.api.md` §4](../../../../../docs/api/nurse-availabilities.api.md)

## Rule
`effective = declared (weekly / one-date open hours) − time-off − (CONFIRMED / IN_PROGRESS bookings ± TRAVEL_BUFFER_MINUTES)`
A slot is available when ONE continuous effective interval covers it. Buffer comes from `system_configs`
(`TRAVEL_BUFFER_MINUTES`, 60) — never hard-coded.

Conventions: Vietnam local times (UTC+7, no DST); `end < start` = past midnight; `23:59` = midnight; a date with
`DATE_AVAILABLE` rows uses them instead of that weekday's windows; time-off cuts everything incl. last night's spill.

## Files
| File | Role |
|---|---|
| `availability-engine.policy.ts` | **pure** engine: clock/calendar helpers, interval algebra, `checkSlot`, `effectiveIntervals` |
| `availability-engine.service.ts` | `findAvailableNurses`, `checkNurseAvailability`, `assertNurseAvailable`, `getEffectiveAvailability` |
| `availability-engine.repo.ts` | two read queries (schedule rows, busy bookings) — batched for many nurses |
| `availability-engine.types.ts` | shapes, `UnavailableReason` |

## Rules for callers
- Never query `nurse_availabilities` yourself for availability decisions — call this module (no divergent logic).
- The engine checks **time only**. ACTIVE status, deposit ≥ 300,000 VND, Tier (`isTier2ValidOn`), gender, service and
  distance are the caller's filters.
- Phase 3: inside the accept/assign transaction, `SELECT … FROM nurse_profiles WHERE user_id = $1 FOR UPDATE`, then
  `assertNurseAvailable(tx, …)`. The DB's `ex_bookings_nurse_no_overlap` constraint is the last line of defence for overlaps;
  the buffer is enforced only here.
- `ignoreBookingId` re-checks a booking against everything except itself (re-match, extension).

## Tests
- `test/unit/availability-engine.test.ts` — overnight, 23:59, date overrides, time-off, buffer at 59/60 min, timezone.
- `test/integration/nurse-availabilities.test.ts` — the three Phase 2 exit criteria on PostgreSQL.
