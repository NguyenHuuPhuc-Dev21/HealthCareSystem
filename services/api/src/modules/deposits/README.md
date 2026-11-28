# deposits (BE-3 · Phase 5)

The nurse deposit as decided in **ADR-0004**: a licensed partner keeps the money, we keep a mirror ledger (D1);
progressive funding for new nurses (D2); refund on account closure and transparent, appealable deductions (D3).
Contract: [`docs/api/deposits.api.md`](../../../../../docs/api/deposits.api.md) · FR-PAY-03 · BR-04 §2.2 · BR-12 §2.3.

| File | Role |
|---|---|
| `deposits.types.ts` | row types, job names / schedules, outcomes |
| `deposits.policy.ts` | pure: payment code, shortfall / top-up split, refund eligibility, working days, appeal window |
| `deposits.ledger.ts` | **money**, in the caller's transaction: `confirmTopup`, `deductPenalty`, `reversePenalty` |
| `deposits.repo.ts` | SQL |
| `deposits.service.ts` | use cases (nurse + Admin functions) |
| `deposits.routes.ts` | nurse endpoints + bank account (+ dev simulator) |
| `deposits.jobs.ts` | `deposits.reconciliation` 01:30, `deposits.refund-eligibility` 02:15 |

Migration `0017_deposits.sql`: grace-start trigger, `nurse_bank_accounts`, `deposit_topups`,
`deposit_penalty_appeals`, `deposit_reconciliations`.

## Suspension on a shortfall (BE-2, migration 0025)

Trigger `trg_wallets_deposit_suspension`: a deduction that leaves `deposit_balance` below `MIN_NURSE_DEPOSIT` (outside
the ADR-0004 grace — and any debt, grace or not) sets the profile `SUSPENDED` / `DEPOSIT_SHORTFALL`; a credit that
brings it back to `MIN_NURSE_DEPOSIT` sets it `ACTIVE` again (SRS v2.0 nurse lifecycle, FR-PAY-03). Nothing to call:
it fires inside the transaction that moved the money. Test: `test/integration/deposit-suspension.test.ts`.

## For other modules

```ts
import { deductPenalty, reversePenalty } from '../deposits/deposits.ledger';

// row 7 nurse late cancel, row 8 no-show, dispute RESOLVED_CUSTOMER on a cash booking — inside YOUR transaction:
await deductPenalty(db, { nurseId, bookingId, reason: PenaltyReason.NURSE_LATE_CANCEL, amount, slaRuleRef: 'SRS §5.2 row 7' }, nowMs);
// disputes (Phase 6), appeal upheld:
await reversePenalty(db, { penaltyTransactionId, decidedBy: adminId, note });
```

- One penalty per (reason, booking) unless you pass `idempotencyKey`. Returns `null` when already booked.
- `deposit_balance` may go negative (booked debt, FR-PAY-03). ADR-0004 D2's "take the rest from unsettled escrowed
  payouts" for grace nurses is done by **settlements** (B3) when it pays that nurse.
- `DISPUTE_UPHELD` needs `disputeId` and is never appealable; the others are appealable for `PENALTY_APPEAL_DAYS`.

## Rules worth knowing

- **Grace start**: trigger on `nurse_profiles` `PENDING_VERIFICATION → ACTIVE` sets
  `wallets.deposit_grace_expires_at = now() + DEPOSIT_GRACE_DAYS` once (creates the wallet if needed).
- **Top-up**: link amount 1 … shortfall. Transfer content `KQ` + 12 characters; the escrow webhook routes it here,
  never to a booking. At payment, at most the *current* shortfall is credited (`TOPUP`, `external_ref` = gateway
  reference); the rest is recorded as `returned_amount` for the custody partner to send back. Same reference twice
  → `DUPLICATE`; a second payment of a paid link → `TOPUP_RETURNED`; wrong amount → `AMOUNT_MISMATCH` (nothing moves).
- **Appeal**: one per penalty, creates a `disputes` row with `reason_code = 'PENALTY_APPEAL'` (decided in Phase 6).
- **Closure**: needs a registered bank account (copied onto the request). Sets `wallets.closure_requested_at` (no new
  jobs). READY only when: no CONFIRMED/IN_PROGRESS booking, `DEPOSIT_REFUND_HOLD_DAYS` since the last check-out,
  no OPEN/UNDER_REVIEW dispute (incl. her own appeals), no unpaid cash commission. READY → `due_by` =
  `DEPOSIT_REFUND_SLA_WORKING_DAYS` working days (weekends and `public_holidays` skipped). Cancel only before READY.
- **Admin** (routes in Phase 7 `admin-finance`): `payoutRefund` (one `DEPOSIT_REFUND`, refund = max(deposit, 0)),
  `rejectRefund` (written reason; money never forfeited), `resolveReconciliation`.
- **Reconciliation**: daily; each wallet's `deposit_balance` must equal its own DEPOSIT ledger movements and the
  totals must match the custody statement (simulated = ledger). `MISMATCH` → job error (DLQ alert) and refund payouts
  frozen until resolved. **Seeds / fixtures must put deposit money in through the ledger**, or the dev database
  reports a mismatch.
- **Notifications** to the nurse on every deduction / withhold / reversal / refund change (ADR-0004 D3) come with the
  `notifications` module (Phase 6).
