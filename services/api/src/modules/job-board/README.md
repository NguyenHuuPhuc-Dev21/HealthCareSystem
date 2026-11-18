# Module `job-board` (BE-3 / Dev C · Phase 3)

Advance bookings (> 6 h) and direct requests to a chosen nurse.

- **SRS:** FR-BOOK-03 Mechanism B · **Rules:** BR-08 §2.2/§2.3, FR-PAY-03 rule 6 (ADR-0004 D2) · **Contract:** [`docs/api/job-board.api.md`](../../../../../docs/api/job-board.api.md)
- **Endpoints (NURSE):** `GET /nurse/job-board`, `GET /nurse/job-board/:id`, `POST /bookings/:id/accept`,
  `GET /nurse/direct-invitation`, `POST /bookings/:id/accept-direct-invite`, `POST /bookings/:id/decline-direct-invite`
- **Job:** `job-board.direct-request-sweep` (every minute)

| File | Role |
|---|---|
| `job-board.policy.ts` | **pure**: gate (= matching-radar `eligibilityBlocker`), `JobItem` / `DirectInvitation` mapping (need-to-know) |
| `job-board.service.ts` | list / get / accept / direct invitation / decline / sweep |
| `job-board.repo.ts` / `.routes.ts` / `.jobs.ts` / `.types.ts` | SQL, HTTP, queue handler, shapes |

## Rules
- **No second claim:** accepting always goes through BE-2 `claimBooking` (`JOB_BOARD` / `DIRECT_REQUEST`).
- The board lists only jobs the nurse could claim now (same gate + `availability-engine`). Deposit (ADR-0004 D2): a nurse
  short of the deposit sees `BANK_TRANSFER` jobs only, within the grace limits; a nurse closing her account sees nothing.
- Direct request: 15-minute exclusive window from the start of matching; then the board (or Radar without the invited nurse when urgent).
