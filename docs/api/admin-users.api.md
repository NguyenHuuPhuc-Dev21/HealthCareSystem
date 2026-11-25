# Admin users API — search, lock / unlock accounts (BE-2 · Phase 7)

FR-ADMIN-01 "Quản lý Người dùng": an Admin searches, views and locks / unlocks customer and nurse accounts
(`ACTIVE` / `SUSPENDED` / `BANNED`). SRS §2.3 nurse lifecycle, CT-20. Module: `services/api/src/modules/admin-users`.
Migration `0027_admin_users.sql`. All routes: `ADMIN` role (Admin sessions exist only after TOTP 2FA).
Paths match `apps/admin-web/src/features/users/users.api.ts`.

## Two statuses

| | Customer | Nurse |
|---|---|---|
| What an Admin changes | `users.status` | `nurse_profiles.profile_status` (**only** source of truth for taking shifts) |
| `SUSPENDED` | signs in, sees / pays existing bookings, **cannot create bookings** (`403 ACCOUNT_SUSPENDED`) | signs in (to top up the deposit / pay commission), **cannot take shifts** |
| `BANNED` (permanent) | `users.status = BANNED`: no sign-in, sessions revoked | profile **and** account `BANNED`: no sign-in, sessions revoked |

`status` in the answers is the one that matters for the role (profile for a nurse, account otherwise);
`accountStatus` and `profileStatus` are also returned.

## `GET /admin/users?q=&role=&status=&limit=50&offset=0`

- `q`: a phone number (spaces, `+84` accepted), a user id, or part of the name / email.
- `role`: `PATIENT` | `NURSE` (Admin accounts are never listed). `status`: `PENDING` | `PENDING_VERIFICATION` |
  `ACTIVE` | `SUSPENDED` | `BANNED` (the status that matters). `limit` ≤ 100. Newest first.

```json
{ "items": [ { "id": "…", "role": "NURSE", "fullName": "Nguyễn Thị Hoa", "phone": "0905123456", "email": null,
               "status": "SUSPENDED", "accountStatus": "ACTIVE", "profileStatus": "SUSPENDED",
               "suspendedReason": "DEPOSIT_SHORTFALL", "tier": "TIER_2_SPECIALIST", "trustScore": 92,
               "kycStatus": "VERIFIED", "createdAt": "…" } ],
  "total": 1, "limit": 50, "offset": 0 }
```

`suspendedReason` (nurse): `DEPOSIT_SHORTFALL` (deposit trigger), `COMMISSION_OVERDUE` (cash commission > 24 h),
`TRUST_SCORE_BELOW_THRESHOLD`, `ADMIN_SUSPENDED`, `ADMIN_BANNED`.

## `GET /admin/users/:id`

The list item plus `avatarUrl`, `cccdMasked` (`••••••••1234`), `bookings { total, open, inProgress }`,
`statusHistory` (Admin changes, newest first: `at`, `actorId`, `actorName`, `from`, `to`, `reason`) and, for a nurse:

```json
"nurse": { "gphnNumber": "…", "gphnExpiryDate": "2027-05-01", "yearsOfExp": 6, "ratingAvg": 4.8, "isOnline": false,
           "depositBalance": 120000, "minDeposit": 300000, "overdueCommissionCount": 0,
           "reactivationBlockers": ["DEPOSIT_SHORTFALL"] }
```

`404 USER_NOT_FOUND` (also for Admin accounts).

## `PATCH /admin/users/:id/status`

`{ "status": "ACTIVE" | "SUSPENDED" | "BANNED", "reason": "5–500 characters", "waiveTrustScore": false }`
→ `200`:

```json
{ "updated": true, "userId": "…", "role": "NURSE", "previousStatus": "ACTIVE", "status": "SUSPENDED",
  "sessionsRevoked": false,
  "releasedBookings": [ { "id": "…", "bookingCode": "HC-261201-AB12CD" } ],
  "inProgressBookings": [ { "id": "…", "bookingCode": "HC-261125-XY34ZW" } ],
  "openCustomerBookings": [] }
```

What happens:

- **Nurse → SUSPENDED / BANNED:** every `CONFIRMED` shift that has not started goes back to `MATCHING` (nurse removed,
  no fee for the customer, escrow stays) and is re-dispatched (`matching-radar.redispatch`, the nurse is excluded);
  the customer is notified. Shifts already running are left alone and returned in `inProgressBookings`.
  The nurse goes offline. `suspended_reason = ADMIN_SUSPENDED`: a deposit top-up or a commission payment does **not**
  lift it — only an Admin does.
- **Nurse SUSPENDED → ACTIVE:** refused while the cause is still there — `409 REACTIVATION_BLOCKED`,
  `details.blockers`: `DEPOSIT_SHORTFALL` (deposit < `MIN_NURSE_DEPOSIT` outside the onboarding grace),
  `COMMISSION_OVERDUE` (a cash commission past its 24 h deadline), `TRUST_SCORE_BELOW_THRESHOLD`
  (< `TRUST_SUSPEND_BELOW`). Only the TrustScore can be waived with `waiveTrustScore: true` (SRS: retraining done,
  Admin review); the waiver is written to the audit log.
- **BANNED:** sessions revoked at once (`sessionsRevoked`); sign-in refused afterwards. A banned customer's unfinished
  bookings are returned in `openCustomerBookings` for the Admin to follow up (refunds through the existing flows).
- The user gets a notification (`ACCOUNT_SUSPENDED` / `ACCOUNT_ACTIVE` / `ACCOUNT_BANNED`) **including the reason** —
  write it for the user to read.
- Every change writes `audit_logs` `CHANGE_ACCOUNT_STATUS` (actor, IP, old / new status, reason, released bookings).

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | reason < 5 / > 500 characters, other status, unknown field |
| 403 | `TARGET_NOT_MANAGEABLE` | an Admin account, or yourself |
| 404 | `USER_NOT_FOUND` | no such user |
| 409 | `BANNED_IS_PERMANENT` | the account is banned |
| 409 | `ALREADY_IN_STATUS` | nothing to change |
| 409 | `PROFILE_PENDING_VERIFICATION` | nurse waiting for credential review: approve there (`PATCH /admin/nurses/:id/verify`) or ban |
| 409 | `NO_NURSE_PROFILE` | nurse account never onboarded (only a ban is possible) |
| 409 | `REACTIVATION_BLOCKED` | see above, `details.blockers` |

## For admin-web

- `searchUsers(params)` → `data` is `{ items, total, limit, offset }` (not a bare array).
- `updateUserStatus(id, status, reason)` → `data.updated === true`; show `releasedBookings` / `inProgressBookings` /
  `openCustomerBookings` after a lock, and `details.blockers` on `409 REACTIVATION_BLOCKED` (a "Đã đào tạo lại"
  checkbox sends `waiveTrustScore: true` when the only blocker is the TrustScore).
