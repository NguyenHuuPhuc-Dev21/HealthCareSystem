# deposits API (BE-3 · Phase 5 · ADR-0004)

Base path `/api/v1`. Role **NURSE**, `Authorization: Bearer <access token>`. Envelope `{ "success": true, "data": … }`.
Integer VND. Shapes from `packages/shared/src/contracts/wallet.contracts.ts`; FE callers
`apps/nurse-web/src/features/wallet/deposit.api.ts` and `wallet.api.ts` (bank account).

| Method | Path | Data |
|---|---|---|
| GET | `/wallets/me/deposit` | `DepositStatusDto` |
| POST | `/wallets/deposit/topup-link` | `DepositTopupLinkDto` (201) |
| GET | `/wallets/deposit/topups/:id` | `{ status: "PENDING" \| "COMPLETED" \| "FAILED" }` |
| GET | `/wallets/me/deposit/penalties` | `DepositPenaltyDto[]` |
| POST | `/wallets/me/deposit/penalties/:txId/appeal` | `{ disputeId }` (201) |
| GET | `/wallets/me/deposit/refund-request` | `DepositRefundRequestDto \| null` |
| POST | `/wallets/me/deposit/refund-request` | `DepositRefundRequestDto` (201) |
| POST | `/wallets/me/deposit/refund-request/:id/cancel` | `{ success: true }` |
| GET | `/nurse/bank-account` | `BankAccountDto \| null` |
| PUT | `/nurse/bank-account` | `BankAccountDto` |
| POST | `/wallets/deposit/topups/:id/dev/simulate` | dev only (`PAYMENT_SIMULATOR_ENABLED=true`) |

## GET `/wallets/me/deposit`

```json
{
  "depositBalance": 127500,
  "minDeposit": 300000,
  "shortfall": 172500,
  "grace": { "active": true, "shiftsUsed": 1, "maxShifts": 3, "expiresAt": "2026-12-16T03:00:00.000Z", "withholdRate": 0.3 },
  "canAcceptCash": false,
  "canAcceptTransfer": true,
  "custodyPartnerName": "Ngân hàng đối tác lưu ký (mô phỏng)"
}
```

- `shortfall = max(minDeposit − depositBalance, 0)` (a debt counts as missing).
- `grace.active`: deposit short, `expiresAt` in the future, `shiftsUsed < maxShifts` (ADR-0004 D2). Grace starts when
  the profile first becomes ACTIVE (`DEPOSIT_GRACE_DAYS`).
- `canAcceptCash`: full deposit and no closure in progress. `canAcceptTransfer`: (full or grace) and no closure.

## POST `/wallets/deposit/topup-link`

Body `{ "amount": 172500 }` — integer, 1 … `shortfall`. Earlier unpaid links of the nurse stop being valid.

```json
{
  "topupId": "1f0c…",
  "amount": 172500,
  "qrImageUrl": "https://img.vietqr.io/image/970418-12410006899999-compact2.png?amount=172500&addInfo=KQ7HX2M9QPA4TZ&…",
  "bankName": "BIDV (lưu ký)",
  "accountNumber": "12410006899999",
  "transferContent": "KQ7HX2M9QPA4TZ",
  "expiresAt": "2026-11-23T13:15:00.000Z"
}
```

The money goes to the **custody partner's** account (env `DEPOSIT_CUSTODY_*`, sandbox falls back to
`PAYMENT_RECEIVING_*`), never the platform's. `transferContent` must be kept as is. Valid for `PAYMENT_TIMEOUT_MINUTES`.

When the transfer arrives (escrow webhook, `orderCode = transferContent`), at most the **current** shortfall is
credited as one `TOPUP` (`external_ref` = gateway reference); the rest is returned by the custody partner. Webhook
outcomes: `TOPUP_CREDITED`, `TOPUP_EXCESS_RETURNED`, `TOPUP_RETURNED`, `DUPLICATE`, `AMOUNT_MISMATCH`, `UNKNOWN_TOPUP`
(see `gateway-webhooks.api.md`).

## GET `/wallets/deposit/topups/:id`

`PENDING` while the link is valid and unpaid · `COMPLETED` once credited · `FAILED` when expired, replaced or returned.
Another nurse's id → 404.

## GET `/wallets/me/deposit/penalties`

Newest first, every `PENALTY_DEDUCT` with its explanation:

```json
[{
  "transactionId": "8a1e…", "amount": 60000, "reason": "NURSE_LATE_CANCEL", "slaRuleRef": "SRS §5.2 row 7",
  "bookingId": "…", "bookingCode": "HC-261121-ABC123", "createdAt": "…",
  "appealDeadline": "2026-11-26T13:00:00.000Z", "appealDisputeId": "…", "reversed": false
}]
```

`appealDeadline = null` → not appealable (`DISPUTE_UPHELD`). `reversed = true` → a `PENALTY_REVERSAL` credited it back.

## POST `/wallets/me/deposit/penalties/:txId/appeal`

Body `{ "reason": "≥ 20 characters", "evidenceKeys": ["dispute-evidence/…"] }` (≤ 5 keys uploaded via presigned URL).
Creates a dispute with `reason_code = PENALTY_APPEAL` (decided in `disputes`, Phase 6; upheld → `PENALTY_REVERSAL`).

| HTTP | code | When |
|---|---|---|
| 404 | `PENALTY_NOT_FOUND` | not this nurse's penalty |
| 409 | `NOT_APPEALABLE` | decided by a dispute, or no booking |
| 409 | `APPEAL_WINDOW_CLOSED` | after `appealDeadline` (`PENALTY_APPEAL_DAYS`) |
| 409 | `ALREADY_APPEALED` / `ALREADY_REVERSED` | |

## Account closure → deposit refund

`POST /wallets/me/deposit/refund-request` (no body): needs a registered bank account (409 `BANK_ACCOUNT_REQUIRED`),
one open request at a time (409 `REFUND_REQUEST_EXISTS`). From now on the nurse gets **no new jobs**. Evaluated at
once, then daily (02:15):

| Status | Meaning |
|---|---|
| `WAITING_HOLD` | `pendingReasons` ⊂ `ACTIVE_BOOKING`, `HOLD_DAYS` (7 days since last check-out; `eligibleAt` = when), `OPEN_DISPUTE`, `UNPAID_COMMISSION` |
| `READY` | all clear; `refundAmount = max(deposit, 0)`, `debtAmount` = what is still owed; paid by `dueBy` (5 working days) |
| `REFUNDED` | paid (one `DEPOSIT_REFUND`) |
| `REJECTED` | Admin wrote `rejectReason` (e.g. account holder mismatch); the money is not forfeited, a new request can be made |
| `CANCELLED` | the nurse cancelled before READY (`POST …/:id/cancel`; 409 `REFUND_NOT_CANCELLABLE` after) |

`GET` returns the latest request that is not cancelled, or `null`.

## Bank account

`PUT /nurse/bank-account` body `{ "bankName": "Vietcombank", "accountNumber": "0071006899", "accountHolder": "NGUYEN THI LAN" }`
(account number: 6–30 digits). `GET` → `{ "bankName", "accountMasked": "•••• 6899", "accountHolder" }` or `null`.

## Background jobs (Vietnam time)

- `deposits.reconciliation` 01:30 — each wallet's `deposit_balance` vs its DEPOSIT ledger rows, totals vs the custody
  statement (simulated = ledger). `MISMATCH` → job error (DLQ alert) and **refund payouts frozen** until an Admin
  resolves it with a note.
- `deposits.refund-eligibility` 02:15 — re-evaluates `REQUESTED` / `WAITING_HOLD` requests.

## Errors (common)

400 `VALIDATION_ERROR` · 400 `TOPUP_EXCEEDS_SHORTFALL` (`details.shortfall`) · 409 `DEPOSIT_FULL` ·
409 `ACCOUNT_CLOSING` · 503 `CUSTODY_NOT_CONFIGURED` · 401 / 403 as usual.
