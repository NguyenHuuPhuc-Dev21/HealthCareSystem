# Module `gateway-webhooks` (BE-3 / Dev C · Phase 3)

Prepaid bank transfer → escrow → matching, and the escrow ledger.

- **SRS:** FR-PAY-01 · **Rules:** BR-04 §2.1, SEC-5.2–5.6 · RTM TC-PAY-01/02 · **Contract:** [`docs/api/gateway-webhooks.api.md`](../../../../../docs/api/gateway-webhooks.api.md)
- **Endpoints:** `POST /payments/escrow-webhook` (gateway, HMAC) · `GET /bookings/:id/payment-link` (PATIENT) · `POST /payments/dev/simulate-escrow` (dev only)
- **Tables:** `wallet_transactions` (`ESCROW_HOLD`, `REFUND`), `wallets.escrow_locked_balance` of the customer, `payment_webhook_events` (migration 0010)

| File | Role |
|---|---|
| `gateway-webhooks.policy.ts` | **pure**: canonical string + HMAC, what a verified payment does, VietQR link |
| `gateway-webhooks.ledger.ts` | `holdEscrow` / `refundEscrow` — one append-only row per idempotency key, wallet row locked (also used by booking-expiry) |
| `gateway-webhooks.service.ts` | webhook handler, payment link, dev simulator |
| `gateway-webhooks.repo.ts` / `.schema.ts` / `.routes.ts` / `.types.ts` | SQL, validation, HTTP, shapes |

## Rules
- Signature first: a wrong signature changes nothing (401). Everything verified answers 200 so the gateway stops retrying.
- One transaction under the booking lock: ledger + `ESCROW_HELD` + `activateMatching` (BE-2). Radar starts after COMMIT.
- Money that arrives too late (or twice) is booked and refunded 100% in the same transaction — never silently kept.
- Escrow and the nurse deposit (ADR-0004) are separate balances; nothing here touches `deposit_balance`.

## Env
`PAYMENT_GATEWAY_WEBHOOK_SECRET` (required, otherwise every webhook is 401) · `PAYMENT_RECEIVING_BANK_BIN`, `_BANK_NAME`,
`_ACCOUNT_NO`, `_ACCOUNT_NAME` (VietQR) · `PAYMENT_SIMULATOR_ENABLED=true` for demos (ignored in production).
