# disputes (BE-3 · Phase 6)

Two-way disputes on a shift, the counter-party's rebuttal, the Admin decision, and deposit-penalty appeals.
FR-DISP-01 · FR-DISP-02 (MVP outcomes) · ADR-0004 D3. Contract: [`docs/api/disputes.api.md`](../../../../../docs/api/disputes.api.md) ·
migration `0022_disputes.sql` (+ config `DISPUTE_REBUTTAL_HOURS`).

| File | Role |
|---|---|
| `disputes.types.ts` | rows, categories, bodies |
| `disputes.policy.ts` | pure: who / when may open, counter-party, rebuttal rules, evidence file types |
| `disputes.repo.ts` | SQL |
| `disputes.service.ts` | open, evidence upload URLs, rebuttal, lists, detail, Admin resolve |
| `disputes.routes.ts` | NURSE / PATIENT / ADMIN endpoints |

## Rules

- **Open** (customer or nurse of the booking): while `IN_PROGRESS`, or `COMPLETED` up to `SETTLEMENT_COOLING_HOURS` after
  check-out, not settled, one dispute per booking. Under the booking lock: `bookings.dispute_status = OPEN` — the
  settlement sweep and the customer's early confirmation both skip it (**freeze**).
- **Rebuttal**: only the other side, once, before `rebuttal_due_at` (opened + `DISPUTE_REBUTTAL_HOURS`) → `UNDER_REVIEW`.
- **Evidence**: ≤ 5 files per party, uploaded through `POST /disputes/:id/evidence-upload-urls` (presigned PUT,
  `dispute-evidence/<userId>/…`, JPG / PNG / WEBP / PDF — the formats `core/storage` accepts; video is not supported
  yet). A key is accepted only from the user who uploaded it. Detail responses carry presigned GET URLs.
- **Resolve** (Admin, `PATCH /admin/disputes/:id/resolve`, one transaction, audited `RESOLVE_DISPUTE`):

  | | Booking dispute | Penalty appeal (`reason_code = PENALTY_APPEAL`) |
  |---|---|---|
  | `RESOLVED_NURSE` | freeze lifted; checked-out transfer shift settled now (`settleShift … DISPUTE_RELEASED`), otherwise by the sweep after check-out | `reversePenalty` → `PENALTY_REVERSAL` |
  | `RESOLVED_CUSTOMER` | whatever the escrow holds refunded 100% (`REFUND`, booking `REFUNDED`); TrustScore −`TRUST_PENALTY_DISPUTE_UPHELD` (`applyTrustScoreChange`, BE-1); optional `depositDeduction` → `PENALTY_DEDUCT` `DISPUTE_UPHELD` (not appealable) | appeal rejected — nothing moves |

- A penalty appeal never changes `bookings.dispute_status` and has no rebuttal.

## Not here

- Notifications to the parties (Phase 6 `notifications`).
- `RESOLVED_PARTIAL` (Phase 2, FR-DISP-02).
