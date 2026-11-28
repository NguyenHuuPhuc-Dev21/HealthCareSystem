# admin-finance API (BE-3 · Phase 7 · FR-ADMIN-01 · CT-15)

Admin reconciliation report, ledger audit-trail export and the finance queues (withdrawals, deposit closure
refunds, reconciliation mismatches, settlement holds, nurse debts). Base path `/api/v1`, **ADMIN only**
(Bearer token of a 2FA Admin session). Money is whole VND.

## 1. Reconciliation (CT-15)

`GET /admin/finance/reconciliation?from=YYYY-MM-DD&to=YYYY-MM-DD`

Vietnam calendar days, both inclusive; default = this month up to today; at most 366 days
(`400 INVALID_PERIOD`). Field names follow admin-web `features/finance/finance.api.ts`.

| Field | Meaning | Kind |
|---|---|---|
| `total_escrow_held` | customer money held in escrow (Σ `escrow_locked_balance`) | now |
| `total_commission_collected` | 15% commission: transfer settlements + cash commissions paid | period |
| `total_payouts` | credited to nurses' available balances by settlements | period |
| `total_refunds` | escrow refunded to customers | period |
| `pending_withdrawals` | amount of withdrawal requests waiting for an Admin | now |
| `escrow_received` | escrow holds (customer payments) | period |
| `commission_transfer` / `commission_cash` | the two parts of the commission | period |
| `deposit_withheld` | payout part kept to fill deposits (ADR-0004) | period |
| `withdrawals_paid` | withdrawals marked WITHDRAWN | period |
| `pending_withdrawals_count` | | now |
| `deposits_held` | Σ positive deposits (custody partner) | now |
| `deposit_penalties` / `deposit_penalty_reversals` / `deposit_refunds_paid` | | period |
| `nurse_deposit_debt` | Σ deposits below zero | now |
| `cash_commission_unpaid` / `cash_commission_overdue` | cash commissions not yet paid / past due | now |
| `pending_deposit_refunds`, `open_settlement_holds` | queue sizes | now |
| `last_deposit_reconciliation` | `{ run_date, status: OK\|MISMATCH, resolved }` | |
| `checks[]` | `{ name: ESCROW_LEDGER\|AVAILABLE_LEDGER\|DEPOSIT_LEDGER, walletsTotal, ledgerTotal, ok }` — each balance against the append-only ledger | now |

## 2. Ledger export (audit trail)

`GET /admin/finance/ledger-export?from&to` → `text/csv` (UTF-8 BOM, CRLF), file `ledger_<from>_<to>.csv`.
Columns: `created_at, tx_type, balance_type, status, signed_amount, balance_before, balance_after, user_id,
role, booking_code, idempotency_key, external_ref`. More than 50 000 rows → `413 EXPORT_TOO_LARGE` (export a
shorter period). Every export writes `audit_logs` **EXPORT_FINANCE_REPORT** (period, row count, IP).
Values starting with `= + - @` are prefixed with `'` (no spreadsheet formula injection).

## 3. Queues and actions

| Method | Path | Body | Effect |
|---|---|---|---|
| GET | `/admin/finance/withdrawals?status=` | — | default `WITHDRAW_REQUESTED` (oldest first), full bank account |
| POST | `/admin/finance/withdrawals/:id/approve` | `{ payoutRef? }` | WITHDRAWN · notify `WITHDRAWAL_UPDATE` · audit `PROCESS_WITHDRAWAL` |
| POST | `/admin/finance/withdrawals/:id/reject` | `{ reason }` (≥ 10) | REJECTED, money back to available (REFUND row) · notify · audit |
| GET | `/admin/finance/deposit-refunds?status=` | — | default open (REQUESTED, WAITING_HOLD, READY), by due date |
| POST | `/admin/finance/deposit-refunds/:id/payout` | `{ externalRef? }` | READY only; DEPOSIT_REFUND row · notify · audit `PROCESS_DEPOSIT_REFUND`. `409 RECONCILIATION_MISMATCH` while a mismatch is open |
| POST | `/admin/finance/deposit-refunds/:id/reject` | `{ reason }` | REJECTED (money never forfeited) · notify · audit |
| GET | `/admin/finance/deposit-reconciliations` | — | daily runs, newest first |
| POST | `/admin/finance/deposit-reconciliations/:runDate/resolve` | `{ note }` | unfreezes deposit payouts · audit `RESOLVE_FINANCE_HOLD` |
| GET | `/admin/finance/settlement-holds?open=true` | — | bookings the settlement sweep skips (escrow mismatch) |
| POST | `/admin/finance/settlement-holds/:bookingId/resolve` | `{ note }` | the sweep settles it again · audit `RESOLVE_FINANCE_HOLD` |
| GET | `/admin/finance/nurse-debts` | — | nurses with a negative deposit or unpaid cash commission |

Errors: `400 VALIDATION_ERROR`, `404 *_NOT_FOUND`, `409 WITHDRAWAL_CLOSED / REFUND_NOT_READY / REFUND_NOT_OPEN`,
`403` for a non-Admin.

## 4. Implementation notes

- Reports only read the ledger (`wallet_transactions`, append-only) and the finance tables; actions run in the
  module that owns the money (withdrawals, deposits, settlements) in one transaction, with the audit row in
  the same transaction and the nurse notified after commit.
- Migration `0029_admin_finance.sql`: audit actions `PROCESS_WITHDRAWAL`, `PROCESS_DEPOSIT_REFUND`,
  `RESOLVE_FINANCE_HOLD`, `EXPORT_FINANCE_REPORT`; report indexes.
