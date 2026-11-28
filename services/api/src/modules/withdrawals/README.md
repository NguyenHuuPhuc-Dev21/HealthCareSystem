# withdrawals (BE-3 · Phase 5)

The nurse withdraws from her **available** balance to her registered bank account (FR-PAY-04).
Contract: [`docs/api/withdrawals.api.md`](../../../../../docs/api/withdrawals.api.md) · migration `0020_withdrawals.sql`.

| File | Role |
|---|---|
| `withdrawals.types.ts` | rows, POST result |
| `withdrawals.repo.ts` | SQL on `withdrawal_requests` |
| `withdrawals.service.ts` | request, list, Admin `markWithdrawn` / `reject` |
| `withdrawals.routes.ts` | `POST /wallets/withdraw`, `GET /wallets/withdrawals` (NURSE) |

## Rules

- **The money leaves `available_balance` at request time** (one `WITHDRAW` row, under the wallet lock), so it can't be
  spent or withdrawn twice while the Admin makes the transfer. `amount > available` → `400 INSUFFICIENT_BALANCE`.
- Needs a registered bank account (`PUT /nurse/bank-account`, deposits module); its details are copied onto the request.
- `Idempotency-Key` header (FE-2 sends one): a retried request returns the first withdrawal. Keys are namespaced per
  nurse (`withdraw:<nurseId>:<key>`).
- Admin (routes in Phase 7 `admin-finance`): `markWithdrawn(adminId, id, payoutRef)` → `WITHDRAWN`;
  `reject(adminId, id, reason)` → `REJECTED` + one `REFUND` credit back to available (`withdraw-reversal:<id>`).
  The `WITHDRAW` row is never edited.
- Deposit and escrow are never withdrawn.
