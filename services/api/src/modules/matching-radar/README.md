# Module `matching-radar` (BE-2 / Dev B · Phase 3)

Radar Dispatch for urgent bookings, and the single claim transaction used by every matching path.

- **SRS:** FR-BOOK-03 · **Rules:** BR-06, BR-08 · RTM TC-MATCH-01/02 · **Contract:** [`docs/api/bookings.api.md` §3–4](../../../../../docs/api/bookings.api.md)
- **Endpoints (NURSE):** `GET /nurse/radar`, `POST /bookings/:id/claim-radar`, `POST /bookings/:id/dismiss-radar`
- **Jobs:** `matching-radar.wave`, `matching-radar.redispatch` (registered in `worker.ts`)

| File | Role |
|---|---|
| `matching-radar.policy.ts` | **pure**: route (≤ 6 h → Radar), eligibility gate, distance, wave radius |
| `matching-radar.service.ts` | `activateMatching`, `startRadar`, `runWave`, `claimBooking`, `dismissRadar`, `redispatch` |
| `matching-radar.repo.ts` | SQL: locks, candidates, offers |
| `matching-radar.jobs.ts` / `.routes.ts` / `.types.ts` | queue handlers, HTTP, shapes |

## Rules
- Wave 1 = 5 km at minute 0; wave 2 = 10 km at minute 5; offers stop at minute 15. All four numbers and the deposit
  minimum come from `system_configs`.
- Candidates: ACTIVE, no closure request, Tier valid on the shift date (`isTier2ValidOn`), deposit rule, inside the radius,
  and free according to `availability-engine` — the same engine nurse search uses.
- Deposit rule (ADR-0004 D2): full deposit → any booking; short deposit → only `BANK_TRANSFER` bookings while the grace
  period runs and completed + held grace shifts < `DEPOSIT_GRACE_MAX_SHIFTS`. See `depositAllows` in the policy.
- **Claim = first accept wins.** Lock order: `nurse_profiles` row, then `bookings` row (same order as tier-lifecycle and
  nurse-availabilities). Everything is re-validated under the locks; the DB exclusion constraint on overlapping
  bookings is the last line of defence.
- A wave never offers the same nurse twice; re-running a wave job is harmless.

## Notes for the team
- **BE-1 (`credential-review`):** set `wallets.deposit_grace_expires_at = now() + DEPOSIT_GRACE_DAYS` when a nurse profile
  first becomes `ACTIVE`; until then nobody is in grace. **BE-3 (settlement):** increment `deposit_grace_shifts_used`
  when a shift taken during grace is settled.
- **Nurse position** (`current_lat/lng`) has no update endpoint yet — Radar only reaches nurses whose position is set.
- **Notifications:** `core/notifications` has no shared instance, so offers are not pushed yet; nurses see them through
  `GET /nurse/radar` polling. Pass `notify` in `getMatchingRadarService` when BE-3 exposes one.
- **BE-3 job-board:** use `claimBooking(nurseId, bookingId, 'JOB_BOARD' | 'DIRECT_REQUEST')` — do not write a second claim.
