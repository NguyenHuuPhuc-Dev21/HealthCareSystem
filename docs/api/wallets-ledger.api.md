# wallets-ledger API (BE-3 · Phase 5)

Base path `/api/v1`. All endpoints: `Authorization: Bearer <access token>`, role **NURSE**.
Responses use the standard envelope `{ "success": true, "data": … }`. Money is integer VND.
Shapes come from `packages/shared/src/contracts/wallet.contracts.ts`. FE caller: `apps/nurse-web/src/features/wallet/wallet.api.ts`.

| Method | Path | Data |
|---|---|---|
| GET | `/wallets/me` | `WalletSummaryDto` |
| GET | `/wallets/me/transactions?type=&cursor=&limit=` | `Paged<WalletTransactionDto>` |
| GET | `/wallets/me/earnings?range=week\|month` | `{ points: EarningsPointDto[], totalAmount, periodLabel }` |
| GET | `/wallets/me/upcoming-settlements` | `UpcomingSettlementDto[]` |

A nurse who has never had a wallet gets zero balances / empty lists (reads never create a wallet).

## GET `/wallets/me`

```json
{
  "availableBalance": 1250000,
  "escrowLockedBalance": 425000,
  "depositBalance": 127500,
  "minDeposit": 300000,
  "isSuspended": false,
  "suspendedReason": null,
  "depositGraceActive": true
}
```

| Field | Rule |
|---|---|
| `availableBalance` | `wallets.available_balance` (can be withdrawn) |
| `escrowLockedBalance` | Σ (total − platform_fee) of her checked-out transfer shifts still `ESCROW_HELD`, not settled |
| `depositBalance` | `wallets.deposit_balance`; may be negative (penalty debt) |
| `minDeposit` | `MIN_NURSE_DEPOSIT` |
| `depositGraceActive` | ADR-0004 D2: deposit < min, `deposit_grace_expires_at` > now, `deposit_grace_shifts_used` < `DEPOSIT_GRACE_MAX_SHIFTS` |
| `isSuspended` / `suspendedReason` | first match: `ACCOUNT_CLOSING` (closure requested) → profile `SUSPENDED` (`TRUST_SCORE_LOW` if suspended by trust score, else `null`) → `COMMISSION_OVERDUE` (completed cash shift past `commission_due_at` without `COMMISSION_PAYMENT`) → `DEPOSIT_BELOW_MIN` (deposit < min and no grace) |

## GET `/wallets/me/transactions`

Newest first. Query:

| Param | Values |
|---|---|
| `type` | `ALL` (default) · `SETTLE` (ESCROW_RELEASE, DEPOSIT_WITHHOLD) · `PENALTY` (PENALTY_DEDUCT, PENALTY_REVERSAL) · `WITHDRAW` · `DEPOSIT` (TOPUP, DEPOSIT_WITHHOLD, DEPOSIT_REFUND, PENALTY_DEDUCT, PENALTY_REVERSAL) · or one exact `TxType` |
| `cursor` | `nextCursor` of the previous page (opaque) |
| `limit` | 1–50, default 20 |

```json
{
  "items": [
    {
      "id": "6c0e…",
      "type": "ESCROW_RELEASE",
      "status": "COMPLETED",
      "balanceType": "AVAILABLE",
      "amount": 297500,
      "bookingCode": "HC-261121-ABC123",
      "description": "Quyết toán ca HC-261121-ABC123",
      "createdAt": "2026-11-22T03:00:00.000Z"
    },
    { "id": "…", "type": "WITHDRAW", "status": "COMPLETED", "balanceType": "AVAILABLE", "amount": -500000,
      "description": "Rút tiền về ngân hàng", "createdAt": "…" }
  ],
  "nextCursor": "WyIyMDI2LTExLTIy…"
}
```

`amount` is signed: **+ credit, − debit** (= `balance_after − balance_before`). `nextCursor = null` on the last page.

## GET `/wallets/me/earnings?range=week|month`

Vietnam time (UTC+7). `week` = this Monday → Sunday, labels `T2 … CN`. `month` = this month in 7-day weeks,
labels `Tuần 1 … Tuần 4/5`. Earnings = completed credits of `ESCROW_RELEASE`, `DEPOSIT_WITHHOLD`, `URGENT_BONUS`,
`TRAVEL_SUPPORT` (cash jobs are paid in hand and are not counted).

```json
{ "points": [{ "label": "T2", "amount": 350000 }, …, { "label": "CN", "amount": 0 }],
  "totalAmount": 3580000, "periodLabel": "Tuần này" }
```

`periodLabel` for a month: `"Tháng 11/2026"`.

## GET `/wallets/me/upcoming-settlements`

Transfer-paid shifts of this nurse that are checked out, `ESCROW_HELD`, not settled — oldest check-out first.

```json
[{ "bookingCode": "HC-261121-ABC123", "serviceName": "Chăm sóc vết thương",
   "grossAmount": 500000, "commissionAmount": 75000, "netAmount": 425000,
   "settleAt": "2026-11-23T05:00:00.000Z", "disputeOpen": false }]
```

`settleAt` = check-out + `SETTLEMENT_COOLING_HOURS`. `disputeOpen = true` (dispute `OPEN`/`UNDER_REVIEW`) means the
clock is stopped. `netAmount` is before any grace-period deposit withholding, which settlements applies.

## Errors

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | bad `range`, `limit`, or unknown `type` |
| 400 | `INVALID_CURSOR` | cursor not produced by this API |
| 401 | `UNAUTHORIZED` | no / invalid token |
| 403 | `FORBIDDEN` | role is not NURSE |

## Background job

`wallets-ledger.travel-support-sweep` (every 5 minutes): every `prescription_rejections` row with
`travel_support_status = 'PENDING'` (FR-BOOK-02 Layer 3) is paid from the operations fund into the nurse's
available balance — ONE `TRAVEL_SUPPORT` ledger row (key `travel-support:<rejection id>`) and
`travel_support_status = 'PAID'`, `travel_support_paid_at` in the same transaction. Idempotent.
