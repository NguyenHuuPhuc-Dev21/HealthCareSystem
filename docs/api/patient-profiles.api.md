# API contract — `patient-profiles` (Phase 1, owner BE-2 / Dev B)

> **Baseline:** SRS v2.0 · FR-AUTH-03, FR-PRIV-01 §1 · BR-14 §2.1–2.2 · US-HP-06 · RTM TC-KYC-01
> **Consumers:** FE-1 (Patient Web + Admin Web) · BE-2 `bookings` (Phase 3, internal guard)
> **Status:** DRAFT (05/11/2026) — to be confirmed with FE-1 on day 1 of the phase.

Base path `/api/v1`. Shared envelope: `{ "success": true, "data": … }` or
`{ "success": false, "error": { "code": "…", "message": "…" } }`.
PATIENT routes act only on the caller's own data (`req.user.id`). ADMIN routes need a 2FA admin session.

---

## 1. Internal interface (for `bookings`, Phase 3)

```ts
import { assertCanBookForProfile } from '../patient-profiles/patient-profiles.service';

// Call inside the booking transaction, with its client.
assertCanBookForProfile(db: Queryable, customerId: string, patientProfileId: string): Promise<{
  patientProfileId: string;
  locationType: 'HOME' | 'HOSPITAL';
  weightKg: number | null;          // pricing: >= 80 kg → heavy-patient surcharge
  mobilityStatus: 'NORMAL' | 'PARTIAL' | 'BEDRIDDEN'; // BEDRIDDEN → heavy-patient surcharge
  lat: number | null; lng: number | null;
}>;
// profile not owned / deleted          -> 403 FORBIDDEN
// consent withdrawn (BE-3)             -> 403 CONSENT_REQUIRED
// HOME care and customer not VERIFIED  -> 403 EKYC_REQUIRED   (details.kycStatus)
// HOSPITAL care: phone + OTP is enough (FR-AUTH-03 §2)
```

---

## 2. Customer eKYC (FR-AUTH-03 §2)

Flow: `upload-urls` → app PUTs each file to private storage → `POST /patient/ekyc` → Admin reviews.
Status: `UNVERIFIED → PENDING → VERIFIED`; a rejection goes back to `UNVERIFIED` with a reason, and the customer may submit again.
Review is manual by an Admin in the MVP (vendor/method is open item OD-10).

### `POST /patient/ekyc/upload-urls` — PATIENT
```json
{ "files": [ { "purpose": "CCCD_FRONT", "contentType": "image/jpeg" },
             { "purpose": "CCCD_BACK",  "contentType": "image/jpeg" },
             { "purpose": "PORTRAIT",   "contentType": "image/jpeg" } ] }
```
`purpose`: `CCCD_FRONT` | `CCCD_BACK` | `PORTRAIT`; `contentType`: `image/jpeg` | `image/png` | `image/webp`.

`200` `{ "files": [ { "purpose": "CCCD_FRONT", "objectKey": "kyc-cccd/<userId>/…", "uploadUrl": "https://…", "expiresInSeconds": 600, "contentType": "image/jpeg" } ] }`

The PORTRAIT must be a live camera capture in the app (no gallery pick) — MVP rule instead of AI liveness.

### `POST /patient/ekyc` — PATIENT
```json
{ "cccdNumber": "079200001234",
  "identity": { "cccdFrontKey": "kyc-cccd/…", "cccdBackKey": "kyc-cccd/…", "portraitKey": "kyc-selfie/…" } }
```
The server checks every file (owner, purpose, uploaded, ≤ 10 MB, real image type by magic bytes) before anything is written.

`201`
```json
{ "kycStatus": "PENDING", "cccdNumberMasked": "********1234",
  "submittedAt": "2026-11-05T03:00:00.000Z", "reviewedAt": null, "rejectionReason": null }
```
**Errors:** `400 VALIDATION_ERROR` · `400 DUPLICATE_FILE` · `400 INVALID_FILE_KEY` / `FILE_NOT_UPLOADED` / `FILE_TOO_LARGE` / `FILE_TYPE_NOT_ALLOWED` (`details.purpose`) ·
`409 EKYC_ALREADY_SUBMITTED` · `409 EKYC_ALREADY_VERIFIED` · `409 CCCD_ALREADY_REGISTERED` (CCCD used by another account)

### `GET /patient/ekyc` — PATIENT
`200` same shape as above. `rejectionReason` is filled only while the status is back to `UNVERIFIED` after a rejection.
Object keys and the full CCCD number are never returned to the customer.

### `GET /admin/customers/ekyc-queue?limit=50&offset=0` — ADMIN
`200` `{ "items": [ { "customerId": "…", "fullName": "…", "phone": "…", "submittedAt": "…" } ], "limit": 50, "offset": 0 }` — oldest first.

### `GET /admin/customers/:id/ekyc` — ADMIN
`200`
```json
{ "customerId": "…", "fullName": "…", "phone": "…", "kycStatus": "PENDING", "cccdNumber": "079200001234",
  "submittedAt": "…",
  "identityFiles": { "cccdFrontUrl": "https://…", "cccdBackUrl": "https://…", "portraitUrl": "https://…" },
  "linksExpireInSeconds": 600 }
```
**Errors:** `404 CUSTOMER_NOT_FOUND`

### `PATCH /admin/customers/:id/ekyc` — ADMIN
```json
{ "decision": "APPROVED" }
{ "decision": "REJECTED", "rejectionReason": "Ảnh CCCD mặt sau bị mờ" }
```
`rejectionReason` 5–500 chars, required for `REJECTED`. Records reviewer + time in `users.kyc_documents` and writes
`audit_logs` **REVIEW_CUSTOMER_KYC** (actor = admin, no CCCD number in the audit row) in the same transaction.

`200` the customer's status view (§ `GET /patient/ekyc` shape).
**Errors:** `400 VALIDATION_ERROR` · `404 CUSTOMER_NOT_FOUND` · `409 EKYC_NOT_PENDING`

---

## 3. Patient (care-recipient) profiles — US-HP-06

One customer account can hold several profiles (self, parents …), reused by every booking.
Consent withdrawal and erasure are BE-3's endpoints: `POST /patient-profiles/:profileId/consent/withdraw`, `POST /privacy-requests`
(`docs/api/privacy-consent.api.md`). There is no DELETE here on purpose.

Apps send the device id in the **`X-Device-Id`** header (stored with the consent).

### `POST /patient-profiles` — PATIENT
```json
{
  "fullName": "Trần Văn B",
  "dob": "1948-05-02",
  "gender": "MALE",
  "weightKg": 82.5,
  "mobilityStatus": "BEDRIDDEN",
  "medicalHistory": "Tăng huyết áp, tiểu đường type 2",
  "isInfectious": false,
  "addressText": "12 Nguyễn Huệ, Q1, TP.HCM",
  "locationType": "HOME",
  "lat": 10.7769,
  "lng": 106.7009,
  "dataConsentAccepted": true
}
```
| Field | Rule |
|---|---|
| `fullName` | required, 1–150 |
| `dob` | optional `YYYY-MM-DD`, not in the future, ≥ 1900-01-01 |
| `gender` | optional `MALE` / `FEMALE` / `OTHER` |
| `weightKg` | optional, > 0, ≤ 400 (stored to 0.1 kg) |
| `mobilityStatus` | `NORMAL` (default) / `PARTIAL` / `BEDRIDDEN` |
| `medicalHistory` | optional, ≤ 5000 |
| `isInfectious` | boolean, default `false` |
| `addressText`, `locationType`, `lat`, `lng` | required; `locationType` `HOME` / `HOSPITAL` |
| `dataConsentAccepted` | must be exactly `true` (Decree 13/2023) |

Consent is checked **first**: anything but `true` → `400 CONSENT_REQUIRED` and nothing is written.
The server stores `data_consent_accepted`, `consent_timestamp` (server time), `consent_ip`, `consent_device_id`.

`201`
```json
{ "id": "…", "fullName": "Trần Văn B", "dob": "1948-05-02", "gender": "MALE", "weightKg": 82.5,
  "mobilityStatus": "BEDRIDDEN", "medicalHistory": "…", "isInfectious": false,
  "addressText": "…", "locationType": "HOME", "lat": 10.7769, "lng": 106.7009,
  "consent": { "accepted": true, "acceptedAt": "2026-11-05T03:00:00.000Z", "withdrawnAt": null },
  "createdAt": "…" }
```
**Errors:** `400 CONSENT_REQUIRED` · `400 VALIDATION_ERROR` · `400 DOB_IN_FUTURE` · `400 DOB_TOO_OLD` · `403 FORBIDDEN` (not a customer account)

### `GET /patient-profiles` — PATIENT
`200` `{ "items": [ …profile without "medicalHistory"… ] }` — the caller's live profiles, oldest first.

### `GET /patient-profiles/:profileId` — PATIENT (owner)
`200` full profile. **Errors:** `400 VALIDATION_ERROR` (not a UUID) · `403 FORBIDDEN` (not yours / deleted — no existence leak)

### `PATCH /patient-profiles/:profileId` — PATIENT (owner)
Any subset of the profile fields above (not `dataConsentAccepted`); `lat` and `lng` change together.
`200` full profile.
**Errors:** `400 VALIDATION_ERROR` · `400 DOB_IN_FUTURE` · `403 FORBIDDEN` · `403 CONSENT_REQUIRED` (consent withdrawn: no new processing, BR-17)

---

## 4. Open items

- **OD-10** eKYC method/vendor: MVP = manual Admin review of CCCD + live selfie.
- Re-giving consent after a withdrawal (US-HP-03 TC-USHP03-03) needs an endpoint in privacy-consent (BE-3).
