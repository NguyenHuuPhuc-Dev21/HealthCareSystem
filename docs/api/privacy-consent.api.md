# privacy-consent — API contract (BE-3 · Phase 1)

> **Baseline:** SRS v2.0 · FR-PRIV-01, NFR-PRIV-01/02, NFR-SEC-01.6 · US-HP-03, US-HP-18 · TC-PRIV-01
> **Owner:** BE-3 (Dev C) · **Consumers:** BE-2 `patient-profiles`, `bookings`, `shift-logs`; BE-1 `prescription-gate`; FE-1 (Patient + Admin Web); FE-2 (Nurse Web/App)
> **Status:** AGREED (03/11/2026) — see §6.

All HTTP responses use the shared envelope: `{ "success": true, "data": … }` or
`{ "success": false, "error": { "code": "…", "message": "…" } }`. Prefix: `/api/v1`.
Business numbers come from `system_configs` (never hard-coded).

---

## 1. Internal interface (TypeScript, for other backend modules)

```ts
import {
  captureConsent, assertConsentActive, assertRecordAccess,
} from '../privacy-consent/privacy-consent.service';

/** BE-2 patient-profiles: call when creating a profile; spread the result into the INSERT. */
captureConsent(input: { accepted: unknown; ip: string | null; deviceId: string | null }): {
  data_consent_accepted: true;
  consent_timestamp: Date;      // SERVER time, never the client's clock
  consent_ip: string | null;
  consent_device_id: string | null;
};
// accepted !== true  -> AppError 400 CONSENT_REQUIRED

/** BE-2 bookings (Phase 3): call before creating a booking for this profile. */
assertConsentActive(db: Queryable, patientProfileId: string): Promise<void>;
// profile missing / soft-deleted -> 404 PATIENT_PROFILE_NOT_FOUND
// consent false (withdrawn)      -> 403 CONSENT_REQUIRED

/** Any module that returns medical data or a prescription image to a nurse. */
assertRecordAccess(db: Queryable, args: { bookingId: string; nurseId: string }): Promise<{
  patientProfileId: string;
  basis: 'ACTIVE_BOOKING' | 'POST_CHECKOUT_WINDOW' | 'ADMIN_GRANT';
  accessUntil: Date | null;     // null while CONFIRMED / IN_PROGRESS
}>;
// Allowed only when ALL hold:
//   a) bookings.nurse_id = nurseId                                  else NOT_ASSIGNED
//   b) patient_profiles.data_consent_accepted = true, not deleted   else CONSENT_WITHDRAWN
//   c) one of:
//      - execution_status IN ('CONFIRMED','IN_PROGRESS')
//      - shift_logs.checkout_time + RECORD_ACCESS_EXPIRY_HOURS > now()
//      - an unexpired record_access_grants row for (bookingId, nurseId)
//                                                                   else WINDOW_CLOSED
// Denied -> AppError 403 RECORD_ACCESS_DENIED with details.reason = one of the three above.
// CANCELLED / EXPIRED bookings or a reassigned nurse fail (a) or (c) -> 403 (US-HP-18 AC-04).
```

Apps send the device identifier in the **`X-Device-Id`** header; BE-2 passes `req.get('x-device-id')` as `deviceId`.

---

## 2. Nurse — view medical record (US-HP-18)

### `GET /nurse/bookings/:bookingId/medical-record`

Auth: `NURSE`. Runs `assertRecordAccess`, then writes `audit_logs` **VIEW_MEDICAL_RECORD**
(actor = nurse, target = `patient_profiles`/id) in the same transaction — **every view is audited** (§6-4).

**200**

```json
{
  "success": true,
  "data": {
    "bookingId": "…",
    "access": { "basis": "ACTIVE_BOOKING", "accessUntil": null },
    "patient": {
      "fullName": "Trần Văn B",
      "dob": "1948-05-02",
      "gender": "MALE",
      "weightKg": 62.5,
      "mobilityStatus": "BEDRIDDEN",
      "medicalHistory": "Tăng huyết áp, tiểu đường type 2",
      "isInfectious": false,
      "addressText": "…",
      "lat": 10.77,
      "lng": 106.69
    },
    "prescription": {
      "issuedDate": "2026-11-01",
      "imageUrl": "https://…signed…",
      "imageUrlExpiresInSeconds": 600
    }
  }
}
```

`prescription` is `null` when the service is not invasive or no image exists. The image URL is a
10-minute presigned URL from `core/storage` (BE-1).

**Errors:** `400 VALIDATION_ERROR` (bookingId is not a UUID) · `401 UNAUTHORIZED` · `403 FORBIDDEN` (not a nurse) · `403 RECORD_ACCESS_DENIED`
(`details.reason`: `NOT_ASSIGNED` | `WINDOW_CLOSED` | `CONSENT_WITHDRAWN`) · `404 BOOKING_NOT_FOUND`

---

## 3. Admin — temporary re-grant (FR-PRIV-01 §3, US-HP-28)

### `POST /admin/bookings/:bookingId/record-access-grants`

Auth: `ADMIN` (2FA session). Inserts `record_access_grants` and writes `audit_logs`
**GRANT_RECORD_ACCESS** (actor = admin, target = `record_access_grants`/id, new_value = grant) in one transaction.

**Body**

```json
{
  "nurseId": "…",
  "reason": "Đối chiếu khiếu nại #D-102",
  "expiresAt": "2026-11-05T10:00:00Z"
}
```

- `reason`: 10–500 chars, required.
- `expiresAt`: in the future and ≤ now + `RECORD_ACCESS_GRANT_MAX_HOURS` (§6-1).
- `nurseId` must be the booking's nurse.

**201** `{ "success": true, "data": { "grantId": "…", "expiresAt": "…" } }`
**Errors:** `400 VALIDATION_ERROR` · `403 FORBIDDEN` · `404 BOOKING_NOT_FOUND` · `409 NURSE_NOT_ON_BOOKING`

---

## 4. Customer — consent withdrawal & data-subject requests (US-HP-03)

Ownership for every `PATIENT` route: `patient_profiles.customer_id = req.user.id AND deleted_at IS NULL`;
otherwise **403 FORBIDDEN** (§6-5).

### `POST /patient-profiles/:profileId/consent/withdraw`

Auth: `PATIENT` (owner). Sets `data_consent_accepted = FALSE`, `consent_withdrawn_at = now()`.
From then on `assertConsentActive` and `assertRecordAccess` deny.
**200** `{ "success": true, "data": { "consent": "WITHDRAWN", "withdrawnAt": "…" } }`
**Errors:** `403 FORBIDDEN` (not owner / deleted) · `409 CONSENT_ALREADY_WITHDRAWN`

### `POST /privacy-requests`

Auth: `PATIENT` (owner of the profile).
**Body** `{ "patientProfileId": "…", "requestType": "DELETE" | "ANONYMIZE" }`
**201** `{ "success": true, "data": { "requestId": "…", "status": "PENDING" } }`
**Errors:** `400 VALIDATION_ERROR` · `403 FORBIDDEN` · `409 REQUEST_ALREADY_PENDING`

### `GET /privacy-requests`

Auth: `PATIENT`. The caller's own requests, newest first.
**200** `{ "success": true, "data": [ { "requestId", "customerId", "patientProfileId", "requestType", "status", "createdAt", "processedAt" } ] }`

### `GET /admin/privacy-requests?status=PENDING&limit=20&offset=0`

Auth: `ADMIN`. Oldest first (work queue). `status` optional; `limit` 1–100 (default 20); `offset` ≥ 0 (default 0).
**200** `{ "success": true, "data": { "items": [ …same item shape… ], "total": 42, "limit": 20, "offset": 0 } }`
**Errors:** `400 VALIDATION_ERROR`

### `PATCH /admin/privacy-requests/:requestId`

Auth: `ADMIN`. **Body** `{ "decision": "DONE" | "REJECTED", "note": "…" }`
`note` is optional (≤ 500 chars). `privacy_requests` has no note column: the note is kept in the `DELETE_PATIENT_DATA` audit row (`new_value.note`) when the decision is `DONE`.

- `DONE` → in ONE transaction: anonymize the profile (`full_name` → `"Đã ẩn danh"`; `dob`, `medical_history`,
  `address_text`, `lat`, `lng`, `weight_kg`, `consent_ip`, `consent_device_id` → NULL; `deleted_at = now()`),
  mark the request `DONE` with `processed_by/processed_at`, write `audit_logs` **DELETE_PATIENT_DATA**
  (actor = admin, target = `patient_profiles`/id, ip). Bookings, ledger and audit rows are kept (financial/legal records).
- Refused while the profile has a booking with an `OPEN`/`UNDER_REVIEW` dispute (NFR-PRIV-01).

**200** `{ "success": true, "data": { "requestId": "…", "status": "DONE" } }`
**Errors:** `404 REQUEST_NOT_FOUND` · `409 REQUEST_NOT_PENDING` · `409 PROFILE_UNDER_DISPUTE`

---

## 5. Background job (shared job queue, BE-2)

| Job                       | Schedule                    | Effect                                                                                                                                                                                                                    |
| ------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `privacy.retention-sweep` | daily (`scheduleRecurring`) | Anonymizes profiles whose most recent shift check-out is older than `MEDICAL_RECORD_RETENTION_MONTHS` and that have no open dispute; one `DELETE_PATIENT_DATA` audit row per profile (actor `NULL` = system). Idempotent. |

---

## 6. Các điểm đã thống nhất với nhóm (03/11/2026)

1. **`RECORD_ACCESS_GRANT_MAX_HOURS` = 24 giờ** (migration 0006, BE-1). SRS chưa quy định, nên đây là giá trị **đề xuất**, khớp với cửa sổ khiếu nại 24 giờ (BR-09 §2.3). Đã ghi thành **OD-13** chờ PO duyệt. PO đổi số thì chỉ sửa `system_configs`, không sửa code.
2. **`MEDICAL_RECORD_RETENTION_MONTHS` = 24 tháng** (NFR-PRIV-02, migration 0006).
3. **`patient_profiles.consent_withdrawn_at`** (migration 0006): lưu lần rút đồng ý gần nhất. Rút đồng ý = `data_consent_accepted = FALSE` + `consent_withdrawn_at = now()`. Đồng ý lại (TC-USHP03-03) = `TRUE` + `consent_timestamp = now()`; DB bắt buộc `consent_timestamp > consent_withdrawn_at`.
4. **Ghi audit `VIEW_MEDICAL_RECORD` cho MỌI lần xem bệnh án** (NFR-SEC-01.6), bắt buộc, BE-3 làm.
5. **Kiểm tra chủ hồ sơ** cho các API của `PATIENT`: `customer_id = req.user.id AND deleted_at IS NULL`. Sai chủ trả **HTTP 403** (checklist PR); hồ sơ đã xóa/ẩn danh không truy cập được nữa. BE-2 đã xác nhận.
