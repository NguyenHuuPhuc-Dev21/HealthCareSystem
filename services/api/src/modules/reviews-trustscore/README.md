# Module `reviews-trustscore` (BE-1 / Dev A · Phase 6, started in Phase 2)

Two-way blind reviews and TrustScore (FR-RATE-01). **Only the rating cache exists so far** — it is
the Phase 2 · BE-1 checklist item "maintain cached `rating_avg` on nurse profiles", needed by
`nurse-search` (FR-SEARCH-01 shows `rating_avg` on every profile card). The rest arrives in Phase 6.

## Files

| File | Role |
|---|---|
| `reviews-trustscore.repo.ts` | `recalculateNurseRatingAvg(db, nurseId)` — the only SQL that writes `nurse_profiles.rating_avg` |
| — routes / service / schema / jobs | Phase 6: `POST /bookings/:id/reviews`, visibility job, TrustScore |

## Rule implemented

`nurse_profiles.rating_avg` = average `rating` of the reviews that are **all** of:

- written about this nurse by a customer (`reviewee_id` = nurse, `reviewer_role = 'PATIENT'`);
- visible (`is_visible = TRUE`) — a blind review must not move the average, or the other side
  could infer it before submitting (FR-RATE-01 blind rating);
- attached to a booking whose `execution_status = 'COMPLETED'`.

Rounded to 2 decimals. `0` when no review qualifies (the column is `NOT NULL DEFAULT 0`;
callers that display it should treat "no visible review" as "not rated yet", not as zero stars).

## How to use it

Call it **inside the same transaction** that changes what counts:

```ts
await runInTransaction(pool, async (tx) => {
  await tx.query('UPDATE reviews SET is_visible = TRUE WHERE booking_id = $1', [bookingId]);
  await recalculateNurseRatingAvg(tx, nurseId);
});
```

It recomputes from the `reviews` table every time (no incremental maths), so calling it twice,
or after a review is hidden or removed, always gives the right number.

## Open items

- Nothing calls it yet: the visibility job that flips `is_visible` is Phase 6.
- Demo nurses in `db/seeds/003_demo_nurses.sql` have a hand-set `rating_avg` with no reviews behind
  it; recalculating one of them resets it to `0`.
