# admin-users (BE-2 · Phase 7)

FR-ADMIN-01 "Quản lý Người dùng" — Admin search, detail, lock / unlock of customer and nurse accounts.
Contract: [`docs/api/admin-users.api.md`](../../../../../docs/api/admin-users.api.md). Migration `0027_admin_users.sql`.

| File | Role |
|---|---|
| `admin-users.policy.ts` | pure rules: allowed transitions, reactivation blockers, search text, CCCD mask, notices |
| `admin-users.repo.ts` | SQL: list / detail, locks, status writes, nurse standing, release of future shifts |
| `admin-users.service.ts` | use cases, audit, after-commit side effects (sessions, re-dispatch, notifications) |
| `admin-users.routes.ts` | `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/status` |
| `admin-users.schema.ts` | validation |

## Rules

- Nurse: `nurse_profiles.profile_status` is the only source of truth for shifts (checklist §1.2). A suspension keeps
  `users.status` ACTIVE (the nurse must still sign in to top up / pay); a ban sets both to `BANNED`.
- `suspended_reason = ADMIN_SUSPENDED / ADMIN_BANNED`: the automatic lifts (deposit trigger 0025, cash-commission
  payment) only clear their own code, so an Admin suspension is lifted by an Admin only.
- Reactivation refused while the deposit is short (outside grace) or a commission is overdue; low TrustScore needs
  `waiveTrustScore` (retraining). BANNED is permanent.
- Suspend / ban a nurse: future `CONFIRMED` shifts → `MATCHING` + `matching-radar.redispatch` (same release as
  tier-lifecycle, no fee); running shifts untouched and reported.
- Customer: `users.status`; bookings refuse a `SUSPENDED` / `BANNED` customer (`403 ACCOUNT_SUSPENDED`,
  bookings.service, row read `FOR SHARE` against our `FOR UPDATE`).
- Locks: `users` row then `nurse_profiles` row, `FOR UPDATE`. Side effects after COMMIT never undo the decision.
- Audit: `CHANGE_ACCOUNT_STATUS` (enum value added in 0027) for every change; history read back from `audit_logs`.

## Open items

1. **Banned customer with open bookings** — returned to the Admin; cancelling / refunding them stays with the existing
   cancellation and refund flows (BE-3), no automatic cancellation (PO decision).
2. **Un-ban** — SRS calls BANNED "khóa vĩnh viễn"; a mistaken ban needs a PO-approved procedure (not in MVP).
3. **Banned nurse's deposit** — refund eligibility stays with `deposits` (BE-3).
