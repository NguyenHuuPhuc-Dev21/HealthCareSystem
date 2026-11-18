# Module `booking-expiry` (BE-3 / Dev C · Phase 3)

Bookings that ran out of time. Jobs only, no endpoint.

- **SRS:** FR-BOOK-01, FR-BOOK-03 · **Rules:** BR-04 §2.1, BR-08 §2.5, SRS §5.2 row 9 · **Contract:** [`docs/api/gateway-webhooks.api.md` §4](../../../../../docs/api/gateway-webhooks.api.md)
- **Jobs:** `booking-expiry.payment-timeout` (scheduled by BE-2 bookings; replaces the placeholder) · `booking-expiry.sweep` (every minute)

| File | Role |
|---|---|
| `booking-expiry.policy.ts` | **pure**: unpaid hold passed? unmatched deadline (30 min before start; urgent: 30 min after matching started)? refund due? |
| `booking-expiry.service.ts` | `expireIfDue` (one booking, one transaction), `handlePaymentTimeout`, `runSweep` |
| `booking-expiry.repo.ts` / `.jobs.ts` / `.types.ts` | SQL, queue handlers, shapes |

## Rules
- Each booking is re-checked under its row lock; a claim, the webhook and expiry can never both win.
- Prepaid (`ESCROW_HELD`) → 100% `REFUND` in the same transaction (`escrow-refund:unmatched:<id>`, exactly once). Cash → nothing to refund.
- All deadlines come from `system_configs` (`PAYMENT_TIMEOUT_MINUTES`, `UNMATCHED_EXPIRY_LEAD_MINUTES`, `URGENT_UNMATCHED_EXPIRY_MINUTES`).
- `bookings.matching_started_at` is stamped by a DB trigger (migration 0010) whenever a booking enters `MATCHING`.
