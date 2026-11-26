# Dispute Intake & Adjudication Support

> BE-3 · module `disputes` (FR-DISP-01/02, ADR-0004 D3). Admin console: `GET /api/v1/admin/disputes`,
> `PATCH /api/v1/admin/disputes/:id/resolve`.

## What must stay true

- Open from `IN_PROGRESS` until check-out + `SETTLEMENT_COOLING_HOURS` (24); one open dispute per booking; ≤ 5 evidence
  files uploaded by the party itself. Opening sets `dispute_status = OPEN` → the settlement is frozen.
- The other party may rebut once within `DISPUTE_REBUTTAL_HOURS` (24) → `UNDER_REVIEW`.
- MVP outcomes only: `RESOLVED_CUSTOMER` (100% escrow refund, −25 TrustScore, optional deposit damages that are not
  appealable) or `RESOLVED_NURSE` (85% released now, or by the sweep after check-out). Partial splits are Phase 2.
- Every resolution writes `audit_logs` `RESOLVE_DISPUTE`; two Admins resolving at once → one wins, the other gets
  `409 DISPUTE_CLOSED` (`finance-concurrency.test.ts` §8).

## Before deciding — the evidence pack

1. Both statements and evidence (`GET /api/v1/disputes/:id`, signed links).
2. Check-in record: server time, GPS distance, stamped selfie (`shift_logs`, `checkin_attempts`).
3. Clinical log: assessment, vitals, care activities, check-out report (`shift_logs`).
4. Chat and call logs (`conversations_messages`; Admin reading is audited `VIEW_CHAT_HISTORY`).
5. Medical-record access: the nurse's window closes 12 h after check-out; any Admin re-grant is time-boxed and audited.

## After deciding — verify

```sql
SELECT d.status, d.refund_amount, d.release_amount, d.trust_score_delta, d.deposit_deducted, b.payment_status, b.dispute_status
  FROM disputes d JOIN bookings b ON b.id = d.booking_id WHERE d.id = '<dispute id>';
```

- `RESOLVED_CUSTOMER` + transfer booking → `payment_status = REFUNDED`, one `REFUND` row.
- `RESOLVED_NURSE` → `settlements` row (if checked out) or the sweep pays later; `dispute_status` stays
  `RESOLVED_NURSE` (the sweep accepts it).
- Both parties received `DISPUTE_RESOLVED`; the nurse also `DEPOSIT_PENALTY` when damages were taken.

## A dispute near its deadline / a stuck freeze

An open dispute has no timeout: the money waits for the Admin (BR-18 — no default decisions). Watch
`GET /api/v1/admin/disputes?status=OPEN` daily; oldest first.
