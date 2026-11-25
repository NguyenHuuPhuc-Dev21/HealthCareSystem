# check-out (BE-2 · Phase 4)

Closes the shift — FR-SHIFT-04 · FR-PAY-02 · FR-PRIV-01 · FR-RATE-01. Contract:
[`docs/api/shift-execution.api.md`](../../../../../docs/api/shift-execution.api.md) §6.

| File | Role |
|---|---|
| `check-out.types.ts` | problems, input |
| `check-out.policy.ts` | pure: when check-out opens, state problems |
| `check-out.schema.ts` | final vitals, completed activity ids, handover note (≥ 10 chars) |
| `check-out.service.ts` | `checkOut` |
| `check-out.routes.ts` | `POST /bookings/:id/check-out` |

## Rules

- Minimal care report or `400 CARE_REPORT_INCOMPLETE`: final vitals, every mandatory checklist item, handover note.
- Shift/hour-based: from scheduled end − `CHECKOUT_EARLY_TOLERANCE_MINUTES`. Task-based: any time once the checklist
  is done, paid 100% (amounts never change here). Stopping a shift earlier at the family's request is cancellation-policy
  row 4 (`CUSTOMER_STOP_AFTER_CHECKIN`, BE-1).
- One transaction under the booking lock: `shift_logs.checkout_time` (server time), report, booking `COMPLETED`, cash
  `commission_due_at = checkout + CASH_COMMISSION_DUE_HOURS`, open extension / surcharge requests expired.

## What `checkout_time` starts (no extra job: every consumer reads the anchor)

| Clock | Owner | How |
|---|---|---|
| 24h settlement (transfer) | settlements, BE-3 | `settlements.sweep` (shared queue, every 5 min) pays at checkout + `SETTLEMENT_COOLING_HOURS`, dispute `NONE` |
| 24h dispute window | disputes, BE-3 | accepted until checkout + `SETTLEMENT_COOLING_HOURS` |
| cash commission | cash-commission, BE-3 | `bookings.commission_due_at`; overdue job suspends |
| 12h record access | privacy-consent, BE-3 | `assertRecordAccess` on every read |
| reviews | reviews-trustscore, BE-1 | open when `COMPLETED` |

The integration test runs BE-3's `settleShift` on a checked-out 400,000 VND transfer shift: not before +24h, then
340,000 VND to the nurse.
