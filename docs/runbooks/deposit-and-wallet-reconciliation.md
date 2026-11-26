# Deposit, Penalty & Wallet Reconciliation

> BE-3 · modules `wallets-ledger`, `deposits`, `admin-finance`. Jobs: `deposits.reconciliation` (daily 01:30).
> Alerts: `LEDGER_DRIFT`, `FINANCE_HOLDS`.

## Invariants

- Three separate balances per wallet: `available_balance`, `escrow_locked_balance`, `deposit_balance`.
- Every change is one append-only `wallet_transactions` row with a UNIQUE `idempotency_key`; the row stores
  `balance_before` / `balance_after`. So **each balance = Σ (balance_after − balance_before) of its rows**.
- `deposit_balance` is used only for SLA penalties (`PENALTY_DEDUCT`) — never for commission. It may go below zero
  (penalty debt). Below `MIN_NURSE_DEPOSIT` outside the ADR-0004 grace → `SUSPENDED` / `DEPOSIT_SHORTFALL`
  (BE-2 trigger 0025), lifted automatically when topped up.
- Rows are never updated or deleted. A wrong movement is corrected by a **compensating** row with its own key.

## LEDGER_DRIFT — Σ wallets ≠ Σ ledger

1. `GET /api/v1/admin/finance/reconciliation` → `checks[]` says which balance drifts and by how much.
2. Find the wallets:

```sql
SELECT w.id, w.user_id, w.available_balance, w.escrow_locked_balance, w.deposit_balance,
       COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'AVAILABLE'), 0)     AS ledger_available,
       COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'ESCROW_LOCKED'), 0) AS ledger_escrow,
       COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'DEPOSIT'), 0)       AS ledger_deposit
  FROM wallets w LEFT JOIN wallet_transactions t ON t.wallet_id = w.id AND t.status = 'COMPLETED'
 GROUP BY w.id
HAVING w.available_balance     <> COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'AVAILABLE'), 0)
    OR w.escrow_locked_balance <> COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'ESCROW_LOCKED'), 0)
    OR w.deposit_balance       <> COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'DEPOSIT'), 0);
```

3. Usual causes: a seed / script that set `wallets.*` directly (dev data), a manual SQL edit, or a code path that
   updated a balance without a ledger row (a bug: stop that path first).
4. Production: decide with the PO which side is right (the gateway / custody statement wins), then post one
   compensating `wallet_transactions` row per wallet through a reviewed script with a key like
   `correction:<incident>:<wallet>`. Dev DB: drift from seeds is expected; reseed or ignore.

## FINANCE_HOLDS

- **Reconciliation mismatch** (`deposit_reconciliations` `MISMATCH`, unresolved) → deposit refund payouts are frozen.
  Compare the custody partner statement with `ledger_total`; correct as above; then
  `POST /api/v1/admin/finance/deposit-reconciliations/:runDate/resolve {note}` (audited).
- **Settlement hold** (`settlement_holds`) → the booking's escrow does not cover the split: check its escrow rows
  (`SELECT * FROM wallet_transactions WHERE booking_id = '<id>' ORDER BY created_at;`), correct, then
  `POST /api/v1/admin/finance/settlement-holds/:bookingId/resolve {note}` (audited); the sweep settles it.

## Period reconciliation (FR-ADMIN-01)

`GET /api/v1/admin/finance/reconciliation?from&to` — escrow received / held, commission (transfer + cash), payouts,
refunds, withdrawals, deposits, nurse debts. Export the ledger for the auditors with
`GET /api/v1/admin/finance/ledger-export?from&to` (CSV, audited). Totals must match the gateway and custody statements.

## Nurse disputes a deduction

Every `PENALTY_DEDUCT` has a `deposit_penalty_details` row (reason, SLA rule, booking, appeal deadline). The nurse
appeals within `PENALTY_APPEAL_DAYS` (3) from the app; an upheld appeal writes `PENALTY_REVERSAL` (once). Penalties
decided by a dispute ruling are not appealable.
