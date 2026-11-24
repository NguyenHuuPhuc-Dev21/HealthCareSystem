# settlements (BE-3 · Phase 5)

Pays out the customer escrow of bank-transfer bookings: 85% to the nurse, 15% to the platform, with ADR-0004's
progressive deposit funding. Contract: [`docs/api/settlements.api.md`](../../../../../docs/api/settlements.api.md) ·
FR-PAY-02 · BR-04 §2.1 · ADR-0004 D2. Migration `0018_settlements.sql`.

| File | Role |
|---|---|
| `settlements.types.ts` | rows, triggers, skip reasons, job name |
| `settlements.policy.ts` | pure: when a shift may settle, the split, cancellation shares |
| `settlements.repo.ts` | SQL |
| `settlements.service.ts` | `settleShift`, `settleCancellationShare` (caller's transaction) + service (confirm, dispute release, sweep) |
| `settlements.routes.ts` | `POST /bookings/:id/confirm-completion` (customer) |
| `settlements.jobs.ts` | `settlements.sweep` every 5 minutes |

## When

| Trigger | Condition |
|---|---|
| `COOLING_ELAPSED` (sweep) | checked out ≥ `SETTLEMENT_COOLING_HOURS` ago, `COMPLETED`, dispute `NONE` |
| `CUSTOMER_CONFIRMED` | the customer confirms completion after check-out, dispute `NONE` |
| `DISPUTE_RELEASED` | disputes (Phase 6) resolved `RESOLVED_NURSE` → `getSettlementsService().releaseAfterDispute(id)` or `settleShift(db, id, 'DISPUTE_RELEASED', nowMs)` |
| `CANCELLATION_SHARE` (sweep) | `cancellation_outcomes.settlement_status = PENDING`: rows 2–3 at once; row 4 (stopped after check-in) after the cooling window, no dispute |

Everything runs under the booking lock (`FOR UPDATE`): a dispute opened at the same time either commits first (the
settlement sees `OPEN` and skips) or after (it finds the booking `SETTLED`). **Disputes must lock the booking row when
opening.**

## How much

- Shift: `gross = total_amount` (incl. paid extensions), `commission = platform_fee` (priced in), `net = gross − commission`.
- Cancellation rows 2–3: `gross = nurse_compensation + platform_share`, `commission = platform_share`.
  Row 4: `commission = platform_share + 15% × nurse_compensation`.
- While `deposit_balance < MIN_NURSE_DEPOSIT`: `withheld = MoneyHelper.calculateDepositWithhold(net, deposit, min, DEPOSIT_WITHHOLD_RATE)`
  (≤ 30% of net, ≤ shortfall incl. debt) → `DEPOSIT_WITHHOLD`; the rest → `ESCROW_RELEASE` to `available_balance`.
- A shift worked with a short deposit counts one grace shift (`deposit_grace_shifts_used + 1`), same transaction.

## Ledger rows (one idempotency key each)

| Wallet | Row | Key |
|---|---|---|
| customer escrow | `ESCROW_RELEASE −gross` | `escrow-release:<bookingId>` |
| nurse available | `ESCROW_RELEASE +payout` | `settle:<bookingId>:payout` |
| nurse deposit | `DEPOSIT_WITHHOLD +withheld` | `settle:<bookingId>:withhold` |

The platform's 15% is `settlements.commission_amount` (Σ = platform revenue for admin-finance). Before paying, the
customer escrow held for the booking (holds − refunds − releases) must equal `gross`; otherwise
`SettlementInconsistencyError` — nothing is written, the sweep job errors once (retry → DLQ alert) and the booking
is put in `settlement_holds` (migration 0019) so it never blocks the batches behind it. An Admin resolves it with
`resolveHold(adminId, bookingId, note)` (route in Phase 7 admin-finance); the sweep then picks it up again.

## Not here

- Cash bookings: the nurse self-pays the 15% commission (`cash-commission`, FR-PAY-02 cash part).
- Check-out itself (`shift_logs.checkout_time`, `COMPLETED`) is BE-2's `check-out`; this module only reads it.
