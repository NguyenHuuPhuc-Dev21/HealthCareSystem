# API contract — `credential-review` (Phase 1, owner BE-1 / Dev A)

Base path `/api/v1`. Admin routes need an **ADMIN** access token (obtained only after TOTP 2FA — see `accounts-otp.api.md`).
The nurse route needs a **NURSE** token.

## Admin flow (Admin Web — FE-1)
```
GET   /admin/nurses/verification-queue   → who is waiting (oldest first)
GET   /admin/nurses/:id/dossier          → documents + 10-minute file links
PATCH /admin/nurses/:id/verify           → approve / reject each pending document
```

### `GET /admin/nurses/verification-queue?limit=50&offset=0`
`200`
```json
{ "items": [ { "nurseId": "…", "fullName": "Dieu Duong Thu", "phone": "0988000111",
               "profileStatus": "PENDING_VERIFICATION", "tier": "TIER_1_BASIC",
               "pendingCount": 3, "hasPendingGphn": false,
               "oldestPendingAt": "2026-11-03T13:10:12Z", "kind": "ONBOARDING" } ],
  "limit": 50, "offset": 0 }
```
`kind`: `ONBOARDING` (first dossier) or `RENEWAL` (approved nurse sent a new GPHN). Ignore `tier` for `ONBOARDING`.

### `GET /admin/nurses/:id/dossier`
`200`
```json
{
  "nurseId": "…", "fullName": "…", "phone": "…", "gender": "FEMALE", "cccdNumber": "079200000111", "kycStatus": "PENDING",
  "identityFiles": { "cccdFrontUrl": "https://…", "cccdBackUrl": "https://…", "portraitUrl": "https://…" },
  "profile": { "profileStatus": "PENDING_VERIFICATION", "tier": "TIER_1_BASIC", "gphnNumber": null, "gphnExpiryDate": null,
               "scopeOfPractice": null, "isRetiredMedicalStaff": false, "yearsOfExp": 3, "trustScore": 100 },
  "credentials": [ { "id": "…", "docType": "GPHN", "side": null, "documentNumber": "000123/HCM-GPHN",
                     "issuedDate": "2021-01-15", "expiryDate": "2031-01-15", "issuingAuthority": "Sở Y tế TP.HCM",
                     "scopeOfPractice": "Điều dưỡng đa khoa", "verificationStatus": "PENDING", "rejectionReason": null,
                     "reviewedBy": null, "reviewedAt": null, "submittedAt": "…", "fileUrl": "https://…" } ],
  "linksExpireInSeconds": 600
}
```
Credentials are newest first (history of earlier, reviewed submissions included). File links expire after 10 minutes — reload the dossier for fresh links.

### `PATCH /admin/nurses/:id/verify` (SRS §8)
```json
{ "decisions": [
  { "credentialId": "…", "decision": "APPROVED" },
  { "credentialId": "…", "decision": "REJECTED", "rejectionReason": "Ảnh GPHN bị mờ, không đọc được số" }
] }
```
**Every `PENDING` document of the nurse must get a decision** in one call. `rejectionReason` (5–500 chars) is required for `REJECTED`.
The Admin does **not** choose the tier — the server derives it:

| Approved documents | Result |
|---|---|
| CCCD front + back + degree (+ valid GPHN) | `ACTIVE`, `TIER_2_SPECIALIST` |
| CCCD front + back + degree, no/rejected GPHN | `ACTIVE`, `TIER_1_BASIC` |
| + retirement decision | `isRetiredMedicalStaff: true` (badge only — never Tier 2) |
| any CCCD side or degree rejected | stays `PENDING_VERIFICATION`, nurse resubmits |
| renewal: new GPHN approved (nurse already ACTIVE) | tier back to `TIER_2_SPECIALIST` |

`200`
```json
{ "nurseId": "…", "profileStatus": "ACTIVE", "tier": "TIER_2_SPECIALIST", "activated": true, "isRetiredMedicalStaff": false }
```
Each decision stores `reviewed_by` = this Admin. Approving a GPHN writes an `APPROVE_GPHN` audit entry.

| Error | When |
|---|---|
| `400 INCOMPLETE_REVIEW` | a pending document has no decision (`details.credentialIds`) |
| `400 UNKNOWN_CREDENTIAL` | a decision is for a document that is not pending for this nurse |
| `400 DUPLICATE_DECISION` | the same document twice |
| `400 GPHN_EXPIRED` | trying to approve a GPHN that is expired today — reject it instead |
| `404 NURSE_NOT_FOUND` · `409 NOTHING_TO_REVIEW` · `409 PROFILE_BANNED` | |

## Nurse: GPHN renewal (Nurse Web / App — FE-2)

1. Get an upload URL with `POST /nurse/onboarding/upload-urls` and `purpose: "GPHN"` (same as onboarding), PUT the file.
2. `PUT /nurse/credentials/gphn` (SRS §8)
```json
{ "fileKey": "nurse-gphn/…", "number": "000456/HCM-GPHN", "issuedDate": "2026-10-01", "expiryDate": "2031-10-01",
  "issuingAuthority": "Sở Y tế TP.HCM", "scopeOfPractice": "Điều dưỡng đa khoa" }
```
`202` → `{ "status": "PENDING_REVIEW" }`. The nurse keeps working at the current tier until an Admin approves; then the tier goes back to Tier 2 automatically.
Show the result with `GET /nurse/onboarding` (the new GPHN appears in `credentials`).

| Error | When |
|---|---|
| `400 GPHN_EXPIRED` · `400 ISSUED_DATE_IN_FUTURE` | dates |
| `400 INVALID_FILE_KEY` / `FILE_NOT_UPLOADED` / `FILE_TOO_LARGE` / `FILE_TYPE_NOT_ALLOWED` | same file checks as onboarding |
| `409 GPHN_RENEWAL_PENDING` | a GPHN is already waiting for review |
| `409 NOT_ONBOARDED` | onboarding not submitted or still under review |
| `403 ACCOUNT_BANNED` | |
