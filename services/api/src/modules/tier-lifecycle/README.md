# Module `tier-lifecycle` (BE-2 / Dev B · Phase 1)

Daily GPHN expiry sweep: demotes Tier 2 nurses whose GPHN has expired and takes them off the invasive shifts
they can no longer do. No HTTP routes — it is a job on the shared queue.

- **SRS:** FR-AUTH-02 §2 · **Rules:** BR-21 §2.5, BR-09 §2.5 · RTM TC-AUTH-02
- **Job:** `tier-lifecycle.gphn-expiry-sweep`, daily **00:05 Asia/Ho_Chi_Minh** (registered in `worker.ts`)

## Files
| File | Role |
|---|---|
| `tier-lifecycle.policy.ts` | **pure** rules: `shouldDemote`, `isTier2ValidOn`, `releaseFromDate` (all built on credential-review's `computeTier`) |
| `tier-lifecycle.jobs.ts` | the sweep (`runGphnExpirySweep`), registration, Phase-1 redispatch placeholder |
| `tier-lifecycle.repo.ts` | SQL: candidates, lock, demote, release bookings |
| `tier-lifecycle.types.ts` | job names, payloads, result shapes |

## What one run does
For every `TIER_2_SPECIALIST` nurse whose `gphn_expiry_date <= today` (Vietnam date), each in its own transaction:
1. lock `nurse_profiles` (`FOR UPDATE`) and **re-check** — a renewal approved meanwhile wins;
2. `tier → TIER_1_BASIC`; **`profile_status` is not touched** (ACTIVE stays ACTIVE, Tier 1 work continues);
3. future `CONFIRMED` bookings of that nurse whose service needs Tier 2 (`is_invasive` or `required_tier = TIER_2`)
   and whose service date (VN) is on/after the expiry date → `nurse_id = NULL`, `execution_status = MATCHING`,
   prescription check reset. **No penalty, no TrustScore change, no ledger entry** — the customer's escrow stays on the booking;
4. `audit_logs` **TIER_DEMOTION** (actor NULL = system) with old/new tier and the released booking ids.

After commit: `matching-radar.redispatch` is scheduled per released booking (key `redispatch:<bookingId>:<nurseId>`),
and the nurse + affected customers are notified when a notifier is wired.

Rules on dates: a GPHN that expires **today** is already invalid today (same rule as `computeTier` at approval).
Shifts already `IN_PROGRESS`, non-invasive shifts and shifts that already started are never touched.

## Guarantees
- Idempotent: a re-run (retry, second worker) finds nothing left to do; redispatch keys are unique per booking + nurse.
- One nurse failing does not undo the others; the handler throws **after** the whole run if anything failed,
  so the queue retries and finally dead-letters (backlog alert).
- Re-promotion is not here: credential-review sets Tier 2 again when an Admin approves a renewed GPHN. Both lock the same
  `nurse_profiles` row, so they never interleave.

## Tests
- `test/unit/tier-lifecycle.test.ts` — policy boundaries, the sweep on an in-memory fake (fake clock), registration.
- `test/integration/tier-lifecycle.test.ts` — real PostgreSQL: demotion, bookings released/kept, audit, idempotency.

## Notes for the team
- **Phase 2/3 callers (nurse-search BE-3, matching-radar, job-board, bookings):** check Tier 2 with
  `isTier2ValidOn(nurse, serviceDate)` — the `tier` column alone can lag up to one day behind the GPHN expiry.
- **Phase 3 (matching-radar):** register the real `matching-radar.redispatch` handler, then delete
  `registerRedispatchPlaceholder` and its call in `worker.ts`. The handler must re-check the booking is still
  `MATCHING` with no nurse, and must not offer it to `releasedNurseId`. As a safety net the radar should also pick up
  `MATCHING` bookings that have no open offer.
- **core/middleware `requireNurseEligibility`** reads the `tier` column only; once Phase 3 accepts invasive shifts it
  should also apply `isTier2ValidOn` for the shift date.
- **Notifications:** `core/notifications` has no shared singleton yet, so `worker.ts` does not pass `notify`.
  When BE-3 exposes one, call `setTierLifecycleNotifier(...)` in `worker.ts` (example in `tier-lifecycle.jobs.ts`).
- **Open (BR-21 §2.5):** pre-expiry reminder (old 30-day reminder) is not specified in SRS v2.0.
