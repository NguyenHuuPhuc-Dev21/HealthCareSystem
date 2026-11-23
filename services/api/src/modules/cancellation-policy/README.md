# Module `cancellation-policy` (BE-1 / Dev A · Phase 5)

The SRS §5.2 cancellation / timeout / compensation matrix as **one data-driven engine**, plus the customer's
cancel flow and refund list.

- **SRS:** §5.2 (rows 1–9) · BR-18 §2.1 · BR-02 · BR-04 · BR-16 · FR-PAY-02/03 · FR-RATE-01
- **API contract:** [`docs/api/cancellation-policy.api.md`](../../../../../docs/api/cancellation-policy.api.md)
- **Migration:** `0014` — the matrix numbers in `system_configs` (SRS values) + table `cancellation_outcomes`

## Files

| File | Role |
|---|---|
| `cancellation-policy.policy.ts` | **the engine** — pure functions, one per §5.2 situation, all numbers from `SlaRules` |
| `cancellation-policy.service.ts` | `loadSlaRules`, customer preview / cancel, refund list |
| `cancellation-policy.routes.ts` | `GET /bookings/:id/cancel-preview`, `POST /bookings/:id/cancel`, `GET /refunds` |
| `cancellation-policy.repo.ts` | SQL on `bookings`, `booking_offers`, `cancellation_outcomes`, `wallet_transactions` (read) |
| `cancellation-policy.types.ts` | `SlaScenario`, `SlaRules`, `SlaOutcome`, DTOs |

## The engine

| Row | Function | Outcome |
|---|---|---|
| 1 | `customerCancel` (Δt > 12h, or no nurse yet) | 100% refund |
| 2 | `customerCancel` (2h ≤ Δt ≤ 12h) | 20% fee → 15% nurse, 5% platform; 80% refund |
| 3 | `customerCancel` (Δt < 2h, no check-in) | 50% fee → 40% nurse, 10% platform; 50% refund |
| 4 | `customerStopAfterCheckin` | hours worked (min 1h; task done = 100%), rest refunded, no penalty |
| 5 | `forceMajeure` | 100% refund; 50,000 travel support if the nurse had set off |
| 6 | `nurseCancel` (Δt > 12h) | −5 TrustScore, booking back to `MATCHING` |
| 7 | `nurseCancel` (Δt ≤ 12h) | 20% fine from deposit = Urgent Bonus, −20 TrustScore, back to `MATCHING` |
| 8 | `noShowDue` + `nurseNoShow` | 100% refund, 50,000 fine → customer voucher, nurse `BANNED` |
| 9 | `expired` | 100% refund of what was held (booking-expiry, BE-3, already does this) |

Each returns an `SlaOutcome`: refund, fee, nurse compensation, platform share, nurse fine, urgent bonus, voucher,
travel support, TrustScore delta, next status, ban. **The engine moves no money**: the caller books what it says.
Cash bookings: nothing prepaid, so no refund and a customer fee is only recorded (`feeCollected = false`); nurse
fines still apply. All shares are integers and always add up to what was paid.

## Customer cancel (rows 1–3) — what is booked

In one transaction under the booking lock: booking → `CANCELLED` (`cancellation_reason` = scenario), open offers
closed, a `cancellation_outcomes` row, and the customer's share refunded with BE-3's `refundEscrow`
(key `escrow-refund:cancel:<bookingId>`).

- Full refund → `payment_status = REFUNDED`.
- Rows 2–3: the nurse and platform shares **stay in the customer escrow**; `payment_status` stays `ESCROW_HELD`
  and the outcome is `settlement_status = PENDING`. `settlements` (BE-3) pays them out and sets `DONE`.
- A booking still `MATCHING` (no nurse) is row 1 at any time: nobody held the slot.
- `IN_PROGRESS` → `409 SHIFT_IN_PROGRESS`: stopping a running shift is row 4 (check-out flow), not a cancellation.

## For the other rows — who calls the engine

| Row | Trigger | Owner (to agree) | Books |
|---|---|---|---|
| 4 | early check-out | BE-2 `check-out` | refund of unused part; settle the rest |
| 5 | ICU / death proof, Admin check | to agree | 100% refund; travel support (operations fund) |
| 6–7 | nurse cancels | BE-2 (`deposits`, `matching-radar`) | `PENALTY_DEDUCT` + `deposit_penalty_details` (row 7), Urgent Bonus, back to `MATCHING`, TrustScore |
| 8 | job 30 min after start | BE-2 / BE-3 | refund, `PENALTY_DEDUCT`, `vouchers` row, `BANNED` + `revokeAllSessionsForUser` |
| 9 | booking-expiry | BE-3 — done | — |

Use `loadSlaRules()` and the function of the row, then `insertOutcome` (repo) so `GET /refunds` shows it.

## Open items

1. **Settlement of the held shares** (rows 2–3) — needs `settlements` / `wallets-ledger` (BE-3, Phase 5).
2. **TrustScore** — the engine returns the delta; applying it (and SUSPENDED below 60) is `reviews-trustscore` (BE-1, Phase 6).
3. **Notifications** — optional `notify` dependency, wired when `core/notifications` exposes a shared service.
4. **`GET /refunds` scenarios** — besides the 9 rows it can return `INVALID_PRESCRIPTION` (prescription-rejection) and
   `OTHER` (late or extra payment refunds); patient-web to add them to `RefundScenario`.
