# Module `admin-finance` (BE-3 / Dev C · Phase 7)

FR-ADMIN-01 "Financial Ledger & Reconciliation" · CT-15. Contract: `docs/api/admin-finance.api.md`.

| File | What |
|---|---|
| `admin-finance.policy.ts` | report period in Vietnam days, CSV encoding (pure) |
| `admin-finance.repo.ts` | read-only reports: snapshot, period flows, ledger rows, queues, debts |
| `admin-finance.service.ts` | `AdminFinanceService`: report, audited export, queues; actions delegate to withdrawals / deposits / settlements |
| `admin-finance.routes.ts` | `/admin/finance/*`, ADMIN only |

The reconciliation engine rebuilds every wallet balance from the append-only ledger (`checks[]`): when all three
are `ok`, the books balance. Period figures come from the ledger and `settlements` / `commission_payments` /
`withdrawal_requests`; "now" figures from `wallets` and the queues.

Every Admin action writes `audit_logs` in its own transaction (migration 0029 actions). Tests:
`test/unit/admin-finance.test.ts`, `test/integration/admin-finance.test.ts` (shared dev DB → totals checked as
before/after differences).
