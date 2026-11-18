# API contract — `job-board` (Phase 3, owner BE-3 / Dev C)

> **Baseline:** SRS v2.0 · FR-BOOK-03 Mechanism B · BR-08 §2.2/§2.3 · FR-PAY-03 rule 6 / ADR-0004 D2 · RTM TC-MATCH-01/02
> **Consumers:** FE-2 (Nurse Web/App — paths and shapes follow `apps/nurse-web/src/features/job-board/job-board.api.ts`
> and `packages/shared/src/contracts/job-board.contracts.ts`)
> **Status:** DRAFT (17/11/2026).

Base path `/api/v1`. NURSE only. Envelope as usual.

---

## 1. Who sees a job

A booking is on the board when: `MATCHING`, no nurse, `matching_mode = JOB_BOARD` (start > 6 h away), paid (`CASH`, or
`BANK_TRANSFER` in `ESCROW_HELD`), not started, and **no direct request is open** for it.

A nurse sees it only if she could claim it right now — the same gate the claim re-checks (BE-2 `eligibilityBlocker`) plus availability:

| Check | Rule |
|---|---|
| Status | profile + account `ACTIVE`; no account-closure request (`closure_requested_at`) |
| Tier | invasive / Tier-2 services need Tier 2 with a GPHN valid **on the shift date** |
| Deposit (ADR-0004 D2) | `deposit_balance ≥ MIN_NURSE_DEPOSIT` → every job. Short deposit → **only `BANK_TRANSFER` jobs**, while `now < deposit_grace_expires_at` and completed grace shifts + transfer shifts held < `DEPOSIT_GRACE_MAX_SHIFTS` (3). Cash jobs always need the full deposit. |
| Availability | `availability-engine`: declared schedule − time-off − bookings ± 60 min |

Jobs a nurse cannot take are **not listed** (BR-08 §2.3 is a hard filter), so `isLockedForTier1` is never `true`.

---

## 2. Endpoints

### `GET /nurse/job-board` → `200 JobItem[]`
Sorted by start time, at most 100. Need-to-know only before the claim: patient **given name**, age, gender, weight, mobility,
date/time, amounts (`netAmount` = total − platform fee + urgent bonus), distance from the nurse's last position. No address, phone, history.

### `GET /nurse/job-board/:id` → `200 JobItem`
One job from the list, or the nurse's own open direct request (then `isDirectInvite: true`, `inviterName`, `directInviteExpiresAt`).
`404 JOB_NOT_FOUND` otherwise.

### `POST /bookings/:id/accept` → `200 { "success": true, "booking_id": "…", "bookingCode": "…" }`
First accept wins: BE-2 `claimBooking(nurseId, id, 'JOB_BOARD')` (locks nurse → booking, re-checks the whole gate and availability).

| HTTP | code | When |
|---|---|---|
| 409 | `NOT_ON_JOB_BOARD` | urgent booking (Radar) — claim it with `POST /bookings/:id/claim-radar` |
| 409 | `DIRECT_REQUEST_PENDING` | the invited nurse's 15-minute window is still open |
| 409 | `ALREADY_CLAIMED` | someone else got it / no longer `MATCHING` |
| 403 | `NURSE_NOT_ACTIVE` · `ACCOUNT_CLOSING` · `TIER_MISMATCH` · `DEPOSIT_SHORTFALL` | gate (`DEPOSIT_SHORTFALL.details`: `minDeposit`, `paymentMethod`) |
| 409 | `SCHEDULE_CONFLICT` | not free (`details.reason`) |
| 409 | `PAYMENT_NOT_SECURED` · 404 `BOOKING_NOT_FOUND` | |

### `GET /nurse/direct-invitation` → `200 DirectInvitation | null`
The nurse's newest direct request whose window is still open (`expiresAt`, `expiresInSeconds`). `inviterName` is the customer's given name.

### `POST /bookings/:id/accept-direct-invite` → `200 { "success": true, "booking_id", "bookingCode" }`
Only while the window is open: `403 NO_ACTIVE_OFFER` after it. Then the same claim as above with `via = 'DIRECT_REQUEST'` (same errors).

### `POST /bookings/:id/decline-direct-invite` → `200 { "success": true }`
`404 NO_DIRECT_INVITATION` if there is no open request. The booking is released at once (§3).

---

## 3. Direct request window (BR-08 §2.2)

- The customer invites a nurse at `POST /bookings` (`invitedNurseId`, BE-2). The **15-minute window**
  (`DIRECT_REQUEST_WINDOW_MINUTES`) starts when matching starts — creation for cash, the escrow webhook for transfers —
  set by a DB trigger on `booking_offers.expires_at`.
- While it is open the booking is exclusive: not on the board, not on Radar.
- Declined, or window over (`job-board.direct-request-sweep`, every minute): offer → `DECLINED` / `EXPIRED`, then
  start > 6 h away → the booking appears on the Job Board; start ≤ 6 h → `RADAR_DISPATCH` and Radar starts **without the invited nurse**.
- Unclaimed bookings still expire through `booking-expiry` (see `gateway-webhooks.api.md` §4).

---

## 4. Open items
- **Invited nurse in grace on a cash booking:** `POST /bookings` (BE-2) only checks that the invited nurse is `ACTIVE`; she will get
  `DEPOSIT_SHORTFALL` when accepting. Suggest BE-2 applies `depositAllows` at creation.
- `district` stays `""` (not stored on patient profiles).
- No radius filter on the board (FR-BOOK-03 says "in district"; no district data yet) — `distanceKm` is returned for client-side "near" filtering.
- Push notifications for direct requests wait for the shared notification service (same as Radar).
