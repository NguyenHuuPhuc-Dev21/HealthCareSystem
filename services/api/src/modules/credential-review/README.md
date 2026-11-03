# Module `credential-review` (BE-1 / Dev A · Phase 1)

Admin verification of nurse documents, tier assignment, and GPHN renewal.

- **SRS:** FR-AUTH-02, FR-AUTH-01 (renewal) · §8 `PATCH /api/v1/admin/nurses/:id/verify`, `PUT /api/v1/nurse/credentials/gphn`
- **Rules / stories:** BR-21 §2.2–2.4, §2.7 · US-HP-04 AC-02, AC-03, AC-05 · RTM TC-AUTH-01..03
- **API contract:** [`docs/api/credential-review.api.md`](../../../../../docs/api/credential-review.api.md)

## Files
| File | Role |
|---|---|
| `credential-review.policy.ts` | **pure** decision rules: `decideReviewOutcome`, `computeTier` |
| `credential-review.service.ts` | queue, dossier (+ 10-min links), verify (transaction + audit), GPHN renewal |
| `credential-review.repo.ts` | SQL — `PgReviewRepo` (writes, `FOR UPDATE`), `PgReviewReadRepo` |
| `credential-review.routes.ts` / `.schema.ts` / `.types.ts` | HTTP, validation, DTOs |

## Rules
- Tier is **derived**, never typed in by the Admin: Tier 2 ⇔ an approved GPHN with expiry after today.
  Retirement decision = badge only. (`computeTier` is the one rule — BE-2's `tier-lifecycle` sweep should use it.)
- First review: ACTIVE only if CCCD front + back and the degree are approved; otherwise the nurse resubmits.
  `users.kyc_status` = VERIFIED iff both CCCD sides were approved.
- Every pending document gets a decision in one call; `reviewed_by` / `reviewed_at` / `rejection_reason` recorded.
- Profile and pending credentials are locked (`FOR UPDATE`) — two Admins cannot review the same dossier concurrently.
- `nurse_profiles.gphn_number / gphn_expiry_date / scope_of_practice` hold **approved** values only.
- Approving a GPHN writes `APPROVE_GPHN` to `audit_logs` in the same transaction.
- Renewal: an ACTIVE/SUSPENDED nurse sends a new GPHN → PENDING; on approval the tier goes back to Tier 2 automatically.

## Notes for the team
- **BE-2 (`tier-lifecycle`)**: import `computeTier` from `credential-review.policy.ts` for the daily sweep so the
  demote rule and the approve rule can never disagree.
- **Audit**: GPHN approvals go through BE-3's `writeAuditLog(tx, …)` (`core/audit`) on the review transaction.
  Only `APPROVE_GPHN` exists in `audit_action_enum`; rejections and dossier views are not audited yet —
  adding actions (e.g. `REJECT_CREDENTIAL`, `VIEW_NURSE_DOSSIER`) needs BE-3 to extend the enum + `AuditAction`.
- Wallet creation on activation (deposit) is BE-3's `wallets-ledger` / BE-2's `deposits`.
