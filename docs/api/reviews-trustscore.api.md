# API — reviews-trustscore (BE-1 · Phase 6 · FR-RATE-01)

Base: `/api/v1`. All routes need `Authorization: Bearer <access token>`. Envelope: `{ success, data }` / `{ success: false, error: { code, message } }`.

## POST /bookings/:id/reviews — customer or nurse of the booking

Body (strict):

```json
{ "rating": 5, "comment": "Rất tận tâm", "tags": ["Đúng giờ"] }
```

| Field | Rule |
|---|---|
| `rating` | integer 1–5, required |
| `comment` | ≤ 500 chars, optional |
| `tags` | ≤ 10 strings of 1–40 chars, optional |

`201`:

```json
{ "success": true, "data": { "review_id": "uuid", "isVisible": false } }
```

`isVisible` is `true` when this was the second side's review (both become visible together).

| Status | Code | When |
|---|---|---|
| 404 | `BOOKING_NOT_FOUND` | unknown id, or the caller is not this booking's customer / nurse |
| 422 | `BOOKING_NOT_COMPLETED` | booking is not `COMPLETED` |
| 422 | `REVIEW_WINDOW_CLOSED` | more than `REVIEW_WINDOW_DAYS` (7) after the shift ended (check-out, else scheduled end) |
| 409 | `ALREADY_REVIEWED` | this side already reviewed |
| 400 | `VALIDATION_ERROR` | body invalid |

## GET /nurse/reviews/pending — NURSE

Completed shifts she can still review: `[{ bookingId, bookingCode, customerName, completedAt, expiresAt }]`.

## GET /nurse/reviews/sent — NURSE

Her reviews (latest 100): `[{ id, bookingCode, customerName, rating, comment?, tags?, isVisible, createdAt }]`.

## GET /nurse/reviews/received — NURSE

Reviews about her that are **visible** (latest 100): `[{ id, bookingCode, customerName, rating, comment?, isVisible: true, createdAt }]`.
Blind reviews are never returned.

## GET /nurse/trust-score — NURSE

```json
{
  "score": 92,
  "ratingAvg": 4.8,
  "ratingCount": 12,
  "ratingDistribution": { "star5": 10, "star4": 2, "star3": 0, "star2": 0, "star1": 0 },
  "history": [{ "id": "uuid", "delta": 2, "reason": "GOOD_RATING_RECOVERY", "bookingCode": "HC-…", "createdAt": "…" }]
}
```

`ratingAvg` is `null` when there is no visible customer review. `history` = latest 100 changes; `delta` is what was applied (after clamping to 0..100).
`reason`: `CANCEL_OVER_12H` · `CANCEL_WITHIN_12H` · `DISPUTE_UPHELD` · `GOOD_RATING_RECOVERY` · `ADMIN_ADJUSTMENT`.

## Background job

`reviews-trustscore.reveal-sweep` — hourly at :07 (Asia/Ho_Chi_Minh): reveals reviews whose blind period (`REVIEW_BLIND_DAYS` = 7) is over, recalculates `rating_avg`, applies the +2 recovery.

## Config (system_configs, migration 0015)

`REVIEW_BLIND_DAYS` 7 · `REVIEW_WINDOW_DAYS` 7 (proposed) · `TRUST_PENALTY_DISPUTE_UPHELD` 25 · `TRUST_RECOVERY_GOOD_RATING` 2 · `TRUST_RECOVERY_MIN_STARS` 4 · `TRUST_SUSPEND_BELOW` 60
