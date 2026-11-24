# cash-commission API (BE-3 · Phase 5 · FR-PAY-02 cash part)

Base path `/api/v1`. Role **NURSE**. Envelope `{ "success": true, "data": … }`. Integer VND.
FE caller: `apps/nurse-web/src/features/commission-payment/commission-payment.api.ts` (and nurse-app).
Shapes: `CommissionDebtDto`, `CommissionPaymentLinkDto` (`packages/shared` wallet.contracts).

## GET `/nurse/commission-debts`

Every commission of the nurse's completed cash shifts (with a deadline), OVERDUE first, then UNPAID by deadline,
then PAID newest first.

```json
[{ "bookingId": "…", "bookingCode": "HC-261121-ABC123", "serviceName": "Chăm sóc vết thương",
   "bookingAmount": 500000, "commissionAmount": 75000, "dueAt": "2026-11-25T10:00:00.000Z",
   "status": "OVERDUE" }]
```

`commissionAmount` = the booking's `platform_fee` (15%, priced in the app; tips are not included).
`status`: `UNPAID` before `dueAt`, `OVERDUE` from `dueAt` on, `PAID` with `paidAt`.

## POST `/bookings/:id/commission-payment-link`

No body. The same booking always gets the same transfer content.

```json
{ "checkoutUrl": "", "qrCode": "https://img.vietqr.io/image/970422-…-compact2.png?amount=75000&addInfo=HH7HX2M9QPA4TZ&…",
  "transferContent": "HH7HX2M9QPA4TZ", "dueTime": "2026-11-25T10:00:00.000Z", "amount": 75000,
  "bankName": "MB Bank (sandbox)", "accountNumber": "…" }
```

| HTTP | code | When |
|---|---|---|
| 400 | `NOT_CASH_BOOKING` | a bank-transfer booking (its commission is taken at settlement) |
| 403 | `FORBIDDEN` | not her booking (existence not revealed) |
| 409 | `COMMISSION_NOT_DUE` | not checked out yet (no deadline) |
| 409 | `COMMISSION_ALREADY_PAID` | already paid |
| 503 | `PAYMENT_NOT_CONFIGURED` | receiving account not configured |

When the transfer arrives (escrow webhook, `orderCode = transferContent`): one `COMMISSION_PAYMENT` ledger row that
**moves no balance** (never from the deposit or available balance), booking `SETTLED`. Webhook outcomes:
`COMMISSION_PAID`, `DUPLICATE`, `COMMISSION_RETURNED` (second payment of a paid commission), `AMOUNT_MISMATCH`,
`UNKNOWN_COMMISSION`.

## POST `/bookings/:id/confirm-commission` — dev / demo only

Only when `PAYMENT_SIMULATOR_ENABLED=true` (never in production): signs and runs the webhook a successful transfer
would send. → `{ "success": true, "paidAt": "…" }`.

## Background job `cash-commission.overdue-sweep` (every 5 minutes)

An `ACTIVE` nurse with a commission past `dueAt` and unpaid → `SUSPENDED`, `suspended_reason = COMMISSION_OVERDUE`
(no new jobs). Paying the last overdue commission lifts that suspension (`ACTIVE`). Suspensions for other reasons are
never lifted here. The wallet banner (`GET /wallets/me`) shows `suspendedReason = COMMISSION_OVERDUE`.
