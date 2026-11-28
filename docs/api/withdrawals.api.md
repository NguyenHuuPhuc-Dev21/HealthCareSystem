# withdrawals API (BE-3 · Phase 5 · FR-PAY-04)

Base path `/api/v1`. Role **NURSE**. Envelope `{ "success": true, "data": … }`. Integer VND.
FE caller: `apps/nurse-web/src/features/wallet/wallet.api.ts` (`requestWithdrawal`, `getWithdrawals`).
Bank account: `GET/PUT /nurse/bank-account` (see `deposits.api.md`).

## POST `/wallets/withdraw`

Headers: `Idempotency-Key: <8–64 letters, digits, - or _>` (recommended). Body `{ "amount": 200000 }`.

201:
```json
{ "withdrawal_id": "9c2f…", "id": "9c2f…", "amount": 200000, "status": "WITHDRAW_REQUESTED", "requestedAt": "2026-11-24T14:10:00.000Z" }
```

The amount leaves `availableBalance` at once (`WITHDRAW` in `/wallets/me/transactions`, `-200000`). The same
`Idempotency-Key` again returns the same withdrawal; the money is taken once.

| HTTP | code | When |
|---|---|---|
| 400 | `INVALID_AMOUNT` | not a positive integer |
| 400 | `INSUFFICIENT_BALANCE` | amount > available balance (`details.available`) |
| 400 | `VALIDATION_ERROR` | malformed `Idempotency-Key` |
| 409 | `BANK_ACCOUNT_REQUIRED` | no registered bank account |

## GET `/wallets/withdrawals`

Newest first (at most 100): `WithdrawalDto[]`

```json
[{ "id": "…", "amount": 150000, "status": "REJECTED", "rejectReason": "Tên chủ tài khoản không khớp CCCD",
   "requestedAt": "…", "processedAt": "…" }]
```

| status | meaning |
|---|---|
| `WITHDRAW_REQUESTED` | money reserved, waiting for the Admin transfer |
| `WITHDRAWN` | transferred (`processedAt`) |
| `REJECTED` | refused with `rejectReason`; the money is back in the available balance (`REFUND`) |

Admin processing (`markWithdrawn`, `reject`) is exposed by `admin-finance` (Phase 7).
