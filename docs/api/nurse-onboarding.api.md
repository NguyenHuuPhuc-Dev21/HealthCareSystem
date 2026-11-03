# API contract — `nurse-onboarding` (Phase 1, owner BE-1 / Dev A)

Base path `/api/v1`. All routes need `Authorization: Bearer <accessToken>` of a **NURSE** account
(see `accounts-otp.api.md`; a new nurse registers with `complete-registration` + `role: "NURSE"`).
Pending nurses can use these routes; job features stay locked until an Admin approves (FR-AUTH-01).

## Flow (Nurse Web / Nurse App — FE-2)

```
1. POST /nurse/onboarding/upload-urls   → one presigned URL per file
2. PUT <uploadUrl> (straight to storage, header Content-Type = the one you declared)
3. POST /auth/nurse-onboarding          → dossier submitted, profile PENDING_VERIFICATION
4. GET  /nurse/onboarding               → status + each document's review result
```

Required documents: CCCD front, CCCD back, live portrait, degree. Optional: GPHN (needed for Tier 2), retirement decision (badge only — never Tier 2).
The **portrait must be taken with the camera** in the app (no gallery picker) — the server cannot check this.

---

### 1. `POST /nurse/onboarding/upload-urls`
```json
{ "files": [
  { "purpose": "CCCD_FRONT", "contentType": "image/jpeg" },
  { "purpose": "CCCD_BACK",  "contentType": "image/jpeg" },
  { "purpose": "PORTRAIT",   "contentType": "image/jpeg" },
  { "purpose": "DEGREE",     "contentType": "application/pdf" },
  { "purpose": "GPHN",       "contentType": "image/png" }
] }
```
`purpose`: `CCCD_FRONT` · `CCCD_BACK` · `PORTRAIT` · `DEGREE` · `GPHN` · `RETIREMENT_DECISION` (1–6 files per call).
`contentType`: `image/jpeg` · `image/png` · `image/webp` · `application/pdf` (PDF only for DEGREE / GPHN / RETIREMENT_DECISION).

`200`
```json
{ "files": [ { "purpose": "CCCD_FRONT", "objectKey": "kyc-cccd/<userId>/<uuid>.jpg",
               "uploadUrl": "http://localhost:9000/…", "expiresInSeconds": 600, "contentType": "image/jpeg" } ] }
```
Upload within 10 minutes: `PUT uploadUrl` with the file as body and `Content-Type: <contentType>`. Max **10 MB** per file.

| Error | When |
|---|---|
| `400 CONTENT_TYPE_NOT_ALLOWED` | e.g. a PDF for PORTRAIT or CCCD |

### 2. `POST /auth/nurse-onboarding` (SRS §8)
```json
{
  "cccdNumber": "079123456789",
  "gender": "FEMALE",
  "yearsOfExp": 12,
  "identity": { "cccdFrontKey": "kyc-cccd/…", "cccdBackKey": "kyc-cccd/…", "portraitKey": "kyc-selfie/…" },
  "degree": { "fileKey": "nurse-degree/…", "issuedDate": "2010-06-30" },
  "gphn": { "fileKey": "nurse-gphn/…", "number": "000123/HCM-GPHN", "issuedDate": "2021-01-15",
            "expiryDate": "2031-01-15", "issuingAuthority": "Sở Y tế TP.HCM", "scopeOfPractice": "Điều dưỡng đa khoa" },
  "retirementDecision": { "fileKey": "nurse-retirement/…", "issuedDate": "2022-09-01" }
}
```
`gender`, `degree.issuedDate`, `gphn`, `retirementDecision` are optional. Dates are `YYYY-MM-DD`.

`201` → same body as `GET /nurse/onboarding` (below), with `profileStatus: "PENDING_VERIFICATION"`.

| Error | When |
|---|---|
| `400 VALIDATION_ERROR` | CCCD not 12 digits, invalid date, unknown field… (`details`) |
| `400 ISSUED_DATE_IN_FUTURE` | an issue date after today (Vietnam time) |
| `400 GPHN_EXPIRED` | GPHN expiry today or earlier — send a valid one or omit `gphn` |
| `400 INVALID_FILE_KEY` | key not from this account, or used for the wrong document |
| `400 FILE_NOT_UPLOADED` | the PUT to storage did not happen |
| `400 FILE_TOO_LARGE` | over 10 MB |
| `400 FILE_TYPE_NOT_ALLOWED` | real file content is not an accepted image/PDF |
| `400 DUPLICATE_FILE` | same file used for two documents |
| `409 ONBOARDING_ALREADY_SUBMITTED` | documents are already waiting for review |
| `409 ALREADY_VERIFIED` | profile already approved — renew GPHN via `PUT /nurse/credentials/gphn` |
| `409 CCCD_ALREADY_REGISTERED` | CCCD number linked to another account |
| `403 ACCOUNT_BANNED` | account permanently locked |

After an Admin **rejects** the documents, the nurse can submit again (new upload keys).

### 3. `GET /nurse/onboarding`
`200`
```json
{
  "profileStatus": "PENDING_VERIFICATION",
  "tier": null,
  "kycStatus": "PENDING",
  "credentials": [
    { "id": "…", "docType": "CCCD", "side": "FRONT", "documentNumber": "079123456789",
      "issuedDate": null, "expiryDate": null, "verificationStatus": "PENDING",
      "rejectionReason": null, "submittedAt": "2026-11-03T12:20:54Z" },
    { "id": "…", "docType": "GPHN", "side": null, "documentNumber": "000123/HCM-GPHN",
      "issuedDate": "2021-01-15", "expiryDate": "2031-01-15", "verificationStatus": "PENDING",
      "rejectionReason": null, "submittedAt": "2026-11-03T12:20:54Z" }
  ]
}
```
`profileStatus: null` → the nurse has not submitted yet (show the wizard). Show `rejectionReason` next to a `REJECTED` document.
`tier` is `null` until an Admin approves the profile; then `TIER_1_BASIC` or `TIER_2_SPECIALIST`.
