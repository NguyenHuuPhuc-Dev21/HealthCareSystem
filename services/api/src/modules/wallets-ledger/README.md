# wallets-ledger (BE-3 · Phase 5)

The nurse's wallet: balances, ledger history, earnings, upcoming settlements, and the travel-support payout.
Contract: [`docs/api/wallets-ledger.api.md`](../../../../../docs/api/wallets-ledger.api.md) · FR-PAY-01/03 · FR-BOOK-02 L3 · ADR-0004.

| File | Role |
|---|---|
| `wallets-ledger.types.ts` | row types, job name, page sizes |
| `wallets-ledger.policy.ts` | pure: signed amount, descriptions, filter chips, cursor, grace, suspension banner, earnings buckets (VN time) |
| `wallets-ledger.ledger.ts` | **`postNurseEntry`** — the only way money moves on a nurse wallet |
| `wallets-ledger.repo.ts` | SQL reads |
| `wallets-ledger.service.ts` | use cases |
| `wallets-ledger.routes.ts` | 4 GET endpoints, NURSE only |
| `wallets-ledger.jobs.ts` | `wallets-ledger.travel-support-sweep` every 5 minutes |

## `postNurseEntry(db, entry)` — for deposits, settlements, withdrawals

Call it inside your own transaction. It locks the wallet row (creating it on first use), is idempotent on
`idempotencyKey` (returns `null` when already booked), writes ONE append-only `wallet_transactions` row
(`amount = |delta|`, `balance_before/after` of the moved balance) and updates that balance.

- `balance: 'AVAILABLE'` can never go below 0 → `InsufficientBalanceError` (nothing written).
- `balance: 'DEPOSIT'` may go negative (booked penalty debt, FR-PAY-03).
- Customer escrow stays in `gateway-webhooks.ledger.ts`; this module never touches `escrow_locked_balance`.

## Rules worth knowing

- **Signed amount** shown to the nurse = `balance_after − balance_before` (cannot disagree with the ledger).
- **escrowLockedBalance** of the summary = net (total − platform_fee) of her checked-out transfer shifts still in
  escrow and not settled — the same rows as `/wallets/me/upcoming-settlements`. The money itself sits in the
  customer's escrow.
- **Earnings** = completed credits of `ESCROW_RELEASE`, `DEPOSIT_WITHHOLD`, `URGENT_BONUS`, `TRAVEL_SUPPORT`.
  Cash jobs are paid in hand and are not in the ledger.
- **Suspension banner** priority: `ACCOUNT_CLOSING` → profile `SUSPENDED` (`TRUST_SCORE_LOW` when
  `TRUST_SCORE_BELOW_THRESHOLD`) → `COMMISSION_OVERDUE` → `DEPOSIT_BELOW_MIN` (short deposit and no grace).
- **Travel support** (migration 0016 adds `TRAVEL_SUPPORT`): each `PENDING` `prescription_rejections` row is
  paid into `AVAILABLE` under `travel-support:<rejection id>` and flipped to `PAID` in the same transaction.
