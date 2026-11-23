# Module `reviews-trustscore` (BE-1 / Dev A · Phase 6)

Two-way blind reviews and the nurse TrustScore — FR-RATE-01 · BR-18 §2.5 · BR-02 · SRS §4.6, §5.2 rows 6–7.
API contract: [`docs/api/reviews-trustscore.api.md`](../../../../../docs/api/reviews-trustscore.api.md).

## Files

| File | Role |
|---|---|
| `reviews-trustscore.policy.ts` | Pure rules: who may review, window, blind period, clamp 0..100, suspension, recovery |
| `reviews-trustscore.schema.ts` | Zod body for `POST /bookings/:id/reviews` (strict) |
| `reviews-trustscore.repo.ts` | SQL. `recalculateNurseRatingAvg` is the only writer of `rating_avg`; `updateNurseScore` the only writer of `trust_score` |
| `reviews-trustscore.service.ts` | `ReviewsService`, `revealBooking`, **`applyTrustScoreChange`** (exported for other modules) |
| `reviews-trustscore.routes.ts` | 5 routes, no logic |
| `reviews-trustscore.jobs.ts` | `reviews-trustscore.reveal-sweep` — hourly at :07 (registered in `worker.ts`) |

## Rules

**Reviews**

- Open when the booking is `COMPLETED` (not at settlement); close `REVIEW_WINDOW_DAYS` (7, *proposed*) after the
  shift ended. "Ended" = `shift_logs.checkout_time`, else `bookings.end_time`.
- Only the booking's customer (`PATIENT`) or its nurse (`NURSE`) — anyone else gets 404, as if the booking did not exist.
- One review per side (`UNIQUE (booking_id, reviewer_id)` → `409 ALREADY_REVIEWED`). No edit, no delete.
- **Blind:** hidden until both sides have reviewed (revealed in the same transaction as the second review) or
  `REVIEW_BLIND_DAYS` (7) after the shift (hourly sweep). Hidden reviews are never returned to anyone.
- On reveal: `rating_avg` is recalculated; a customer rating ≥ `TRUST_RECOVERY_MIN_STARS` (4) gives the nurse
  `+TRUST_RECOVERY_GOOD_RATING` (2), once per booking.

**TrustScore** — every change goes through `applyTrustScoreChange(db, change, suspendBelow)`:

- runs in the caller's transaction, locks `nurse_profiles` (`FOR UPDATE`);
- clamps to 0..100 and records requested vs applied delta in `trust_score_events` (append-only, migration 0015);
- with a `bookingId` it is idempotent per (nurse, reason, booking) — retries never deduct twice;
- below `TRUST_SUSPEND_BELOW` (60) an `ACTIVE` nurse becomes `SUSPENDED` (`suspended_reason = TRUST_SCORE_BELOW_THRESHOLD`).
  **Nothing re-activates her automatically** — the Admin lifts it (Phase 7 admin).

| Reason | Delta | Called by |
|---|---|---|
| `CANCEL_OVER_12H` | −5 (`TRUST_PENALTY_NURSE_CANCEL_EARLY`) | nurse cancel (cancellation-policy) |
| `CANCEL_WITHIN_12H` | −20 (`TRUST_PENALTY_NURSE_CANCEL_LATE`) | nurse cancel (cancellation-policy) |
| `DISPUTE_UPHELD` | −25 (`TRUST_PENALTY_DISPUTE_UPHELD`) | disputes (BE-3) when the Admin upholds against the nurse |
| `GOOD_RATING_RECOVERY` | +2 | this module, on reveal |
| `ADMIN_ADJUSTMENT` | any, with `actorId` + `note` | admin (Phase 7) |

```ts
import { applyTrustScoreChange } from '../reviews-trustscore/reviews-trustscore.service';

await withTransaction(async (tx) => {
  // ... resolve the dispute ...
  await applyTrustScoreChange(
    tx,
    { nurseId, delta: -(await getConfigNumber('TRUST_PENALTY_DISPUTE_UPHELD')), reason: 'DISPUTE_UPHELD', bookingId },
    await getConfigNumber('TRUST_SUSPEND_BELOW'),
  );
});
```

## Open items

- `REVIEW_WINDOW_DAYS` is not in SRS v2.0 — proposed 7 days, pending PO.
- Notifications (review received, suspended) wait for a shared `core/notifications` service.
- Patient-side lists (`GET /patient/reviews/...`) are not called by patient-web yet.
