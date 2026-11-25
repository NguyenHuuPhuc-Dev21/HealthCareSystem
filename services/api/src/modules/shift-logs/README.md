# shift-logs (BE-2 · Phase 4)

The running shift — FR-SHIFT-02 · SRS §4.4 · BR-07 · BR-15 · FR-PRIV-01. Contract:
[`docs/api/shift-execution.api.md`](../../../../../docs/api/shift-execution.api.md) §1, §3–§5, §7 · Migration `0024`.
Also hosts what the three shift modules share: the shift row (`repo.findShift` / `lockShift`), the
`ShiftExecutionState` builder, the realtime publisher and the WebSocket.

| File | Role |
|---|---|
| `shift-logs.types.ts` | shift row, stored vitals / checklist / notes, surcharge row, DTOs, channel and notice types |
| `shift-logs.policy.ts` | pure: checklist, vitals, mismatch window, surcharge delta + statuses + `-PT<n>` code, watermark, state / tracking / list builders |
| `shift-logs.repo.ts` | SQL for shift_logs, the booking transitions and `CONDITION_SURCHARGE` adjustments |
| `shift-logs.service.ts` | `ShiftLogsService` + `confirmConditionSurchargePayment` (for gateway-webhooks) |
| `shift-logs.realtime.ts` | `ShiftHub`, `ShiftPublisher` (Redis pub/sub when `REDIS_URL`), `attachShiftSocket` (`/ws/shifts`) |
| `shift-logs.routes.ts` | nurse + family routes; dev simulator |

## Storage (shift_logs, one row per booking)

`vital_signs_log` `[StoredVital]` (kind `INITIAL | ROUTINE | FINAL`, server `recordedAt`, device `measuredAt`) ·
`care_activities_log` `[CareItem]` · `progress_notes` `[{id, at, text}]` · `initial_assessment`, `assessed_at`,
`condition_mismatch_reported`, `mismatch_reason`, `mismatch_option` · `final_vital_signs`, `handover_note`,
`checkout_time`. Arrays are appended under the booking lock; client UUIDs make the offline queue's retries idempotent.

## Condition mismatch

- Reported only in the first `CONDITION_MISMATCH_WINDOW_MINUTES` after check-in, inside the initial assessment.
- `SURCHARGE`: price delta = quote(real condition) − quote(declared) on the booked window (extensions excluded), with
  pricing-engine — today only the heavy-patient rule (BEDRIDDEN or ≥ 80 kg) changes the price, so other discrepancies
  (contagious disease, aggressive environment) get `SURCHARGE_NOT_APPLICABLE` and go to `REFUSE`.
- Family answer: CASH → applied at once; BANK_TRANSFER → `-PT<n>` transfer within `PAYMENT_TIMEOUT_MINUTES`, applied by
  the webhook; a late transfer is refunded 100%.
- `REFUSE`: booking `CANCELLED` (`CONDITION_MISMATCH`), no penalty, open requests expired, escrow refunded 100%.

## Notes for the team

- **BE-3 (gateway-webhooks):** the `-PT<n>` branch was added next to `-GH<n>` (two new outcomes in `WebhookOutcome`).
- **BE-3 (SOS, FR-SHIFT-05):** `ShiftRealtimeMessage` / `/ws/shifts` can carry an `SOS` change; latest vitals are
  `shift_logs.vital_signs_log` (last item). `tracking.emergency` stays `null` until `sos` exists.
- **BE-1 (shift-extend):** its README open item "check-in does not exist" is closed; `expireOpenAdjustments` expires
  open extensions at check-out / refusal (its payment handler then refunds a late transfer, as designed).
- Shift-state reads are not audit-logged (`VIEW_MEDICAL_RECORD`) — they are the nurse's own running shift, polled often;
  `privacy-consent.getMedicalRecord` stays the audited read of the full record.

## Open items

1. Per-service care checklists (catalogue, Phase 7 admin-catalog) — today one default checklist (+ order check for invasive).
2. PO: travel support for a nurse who refuses a mismatched shift (today: no payment, customer refunded 100%).
3. PO values: 30 min window (SRS), checkout tolerance 15 min, check-in opens 30 min before.
