# Settlement Job Monitoring (24h payout, 85/15)

> BE-3 · module `settlements` · job `settlements.sweep` (every 5 min). Alert: `SETTLEMENT_LAG`, `FINANCE_HOLDS`.

## What must stay true

- A transfer shift is paid once: customer confirmed (`POST /bookings/:id/confirm-completion`) **or**
  `checkout_time + SETTLEMENT_COOLING_HOURS` (24) passed, with `dispute_status` `NONE` / `RESOLVED_NURSE`.
- Split: commission = `platform_fee` (15%), net 85% → `available_balance`; while the deposit is below
  `MIN_NURSE_DEPOSIT`, part of the net is withheld into the deposit (`DEPOSIT_WITHHOLD`, ADR-0004).
- One `settlements` row per booking (append-only, UNIQUE booking): re-running the sweep or a confirm racing the sweep
  pays once (`finance-concurrency.test.ts` §4). Ledger keys: `escrow-release:<booking>`, `settle:<booking>:payout` / `settle:<booking>:withhold`.
- A booking whose escrow does not match the split goes to `settlement_holds` and is skipped until an Admin resolves it.

## SETTLEMENT_LAG — shifts not paid after cooling + 2 h

```sql
SELECT b.booking_code, b.dispute_status, b.payment_status, s.checkout_time, h.reason AS hold
  FROM bookings b JOIN shift_logs s ON s.booking_id = b.id
  LEFT JOIN settlement_holds h ON h.booking_id = b.id AND h.resolved_at IS NULL
 WHERE b.payment_method = 'BANK_TRANSFER' AND b.payment_status = 'ESCROW_HELD' AND b.execution_status = 'COMPLETED'
   AND b.settled_at IS NULL AND s.checkout_time < now() - interval '26 hours'
 ORDER BY s.checkout_time;
```

1. Worker running? `settlements.sweep` registered? (worker log line at start; `JOB_BACKLOG`.)
2. Worker log `[settlements] booking … could not be settled:` → the reason:
   - `SettlementInconsistencyError` (escrow holds less than the split) → the booking is now in `settlement_holds`;
     follow `deposit-and-wallet-reconciliation.md`, then resolve the hold
     (`POST /api/v1/admin/finance/settlement-holds/:bookingId/resolve {note}`); the next sweep pays it.
   - anything else (DB error, config missing) → fix, the sweep retries every 5 min.
3. Batch size is 200 per run: a very large lag drains over several runs. Do not settle by hand.

## A disputed booking must NOT be paid

`dispute_status` `OPEN` / `UNDER_REVIEW` freezes it (FR-DISP-01). If one was paid, the freeze failed: stop the
worker, open an incident, reverse only by compensating entries agreed with the PO (never delete `settlements`).

## Checks on a sample

```sql
SELECT booking_id, gross_amount, commission_amount, net_amount, deposit_withheld, payout_amount, trigger, settled_at
  FROM settlements ORDER BY settled_at DESC LIMIT 20;
-- gross = commission + net, net = withheld + payout are CHECK constraints: a violation cannot be stored.
```
