# Disputes & Rebuttals API (`disputes`)

> **Specification Baseline:** SRS §7 Table 11, FR-DISP-01, ADR-0004 D3, Phase 6 BE-3 / FE-2  
> **Base path:** `/api/v1`  
> **Roles:** `NURSE`, `PATIENT` (Customer), `ADMIN`

---

## 1. Overview & Business Rules

1. **Two-Way Dispute Opening (FR-DISP-01):** Either a customer (`PATIENT`) or nurse (`NURSE`) can open a dispute for a shift:
   - Window: During shift execution (`IN_PROGRESS`) or within **24 hours** after check-out (`COMPLETED`).
   - Escrow freeze: Opening a dispute immediately freezes financial settlement release for the booking.
2. **Rebuttal Window:**
   - The counter-party has a defined rebuttal period (24 hours from opening) to submit a written explanation and up to 5 image/video evidence files.
   - Submitting a rebuttal advances the dispute status from `OPEN` to `UNDER_REVIEW`.
3. **Evidence Constraints:**
   - Maximum 5 files per party.
   - Supported formats: PNG, JPG, JPEG, MP4, MOV. Maximum 20 MB per file.
4. **Deposit Penalty Appeal (ADR-0004 D3):**
   - Nurses can appeal penalty deductions (`kind = 'PENALTY_APPEAL'`) within 3 business days of the deduction.
   - Upheld customer complaints (`DISPUTE_UPHELD`) cannot be appealed again.
5. **Resolution Outcomes:**
   - `RESOLVED_NURSE`: Complaint rejected. Escrow freeze is lifted; 85% net earnings released to nurse wallet. For penalty appeals: penalty amount refunded via `PENALTY_REVERSAL` transaction.
   - `RESOLVED_CUSTOMER`: Complaint upheld. Nurse receives −25 TrustScore deduction, deposit deduction for damages; 100% refund released to customer.

---

## 2. Endpoints

### 2.1 Get Disputes for Nurse (`GET /api/v1/nurse/disputes`)

Returns all disputes where the authenticated nurse is a participant (either opened by or opened against).

- **Role:** `NURSE`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "id": "disp-001",
      "bookingId": "job-1",
      "bookingCode": "BK-20261102-001",
      "openedBy": "PATIENT",
      "category": "PREMATURE_ABANDONMENT",
      "description": "Điều dưỡng kết thúc ca sớm 45 phút...",
      "status": "OPEN",
      "evidences": [],
      "rebuttalDueAt": "2026-11-18T12:00:00Z",
      "kind": "BOOKING",
      "createdAt": "2026-11-17T16:00:00Z"
    }
  ]
}
```

---

### 2.2 Get Dispute Detail (`GET /api/v1/disputes/:id`)

Retrieve full dispute detail, timeline, evidences, and resolution outcome.

- **Role:** `NURSE`, `PATIENT`, `ADMIN`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "id": "disp-001",
    "bookingId": "job-1",
    "bookingCode": "BK-20261102-001",
    "openedBy": "PATIENT",
    "category": "PREMATURE_ABANDONMENT",
    "description": "...",
    "status": "OPEN",
    "evidences": [],
    "nurseRebuttal": null,
    "rebuttalDueAt": "2026-11-18T12:00:00Z",
    "resolution": null,
    "kind": "BOOKING",
    "createdAt": "2026-11-17T16:00:00Z"
  }
}
```

---

### 2.3 Open Dispute for Shift (`POST /api/v1/bookings/:id/disputes`)

Open a new dispute for a shift in progress or within 24 hours of completion.

- **Role:** `NURSE` or `PATIENT`
- **Request Body:**
```json
{
  "category": "UNPROFESSIONAL_CONDUCT",
  "description": "Gia đình có hành vi to tiếng, yêu cầu công việc ngoài chuyên môn...",
  "evidenceUrls": ["https://storage.carenest.vn/evidence/file1.jpg"]
}
```

#### Success Response (`201 Created`):
```json
{
  "success": true,
  "data": {
    "dispute_id": "disp-20261117-009"
  }
}
```

---

### 2.4 Submit Dispute Rebuttal (`POST /api/v1/disputes/:id/rebuttal`)

Submit counter-explanation and evidence files before deadline.

- **Role:** `NURSE` (when respondent)
- **Request Body:**
```json
{
  "rebuttal": "Tôi đã đo lại 2 lần cách nhau 5 phút theo phác đồ...",
  "evidence_urls": ["https://storage.carenest.vn/evidence/rebuttal1.jpg"]
}
```

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": {
    "updated": true
  }
}
```

---

## 3. Implementation notes (BE-3 · Phase 6 — `services/api/src/modules/disputes`)

Additional endpoints and the exact rules as implemented:

| Method | Path | Role | Data |
|---|---|---|---|
| POST | `/disputes/:id/evidence-upload-urls` `{ "file_names": ["a.jpg"] }` | party | `PresignedUploadUrlDto[]` — `fileId` = `publicUrl` = storage key to send back as evidence |
| GET | `/patient/disputes` | PATIENT | `DisputeDto[]` (booking disputes on her bookings) |
| GET | `/admin/disputes?status=` | ADMIN | `DisputeDto[]`, open ones first (oldest first) |
| PATCH | `/admin/disputes/:id/resolve` `{ "resolution", "notes", "depositDeduction"? }` | ADMIN | `{ updated, outcome, refunded, released, trustScoreDelta, depositDeducted, penaltyReversed }` |

- `POST /bookings/:id/disputes` accepts `{ category?, description, evidenceUrls? }` (nurse-web) or
  `{ reason, evidence_urls? }` (patient-web). Window: while `IN_PROGRESS`, or ≤ `SETTLEMENT_COOLING_HOURS` (24 h) after
  check-out, not settled. One open dispute per booking (`409 DISPUTE_EXISTS`); outsiders `403`; late
  `409 DISPUTE_WINDOW_CLOSED`. Opening sets `bookings.dispute_status = OPEN` under the booking lock (settlement frozen).
- Evidence: ≤ 5 files per party, JPG / PNG / WEBP / PDF (video not supported by storage yet), keys must have been
  uploaded by the same user (`400 INVALID_EVIDENCE`). Detail responses return presigned download URLs.
- Rebuttal `{ rebuttal | content, evidence_urls | evidenceUrls }`: only the counter-party (`403 NOT_COUNTER_PARTY`), once
  (`409 ALREADY_SUBMITTED`), before `rebuttalDueAt` = opened + `DISPUTE_REBUTTAL_HOURS` (`409 REBUTTAL_WINDOW_CLOSED`).
  A penalty appeal has no rebuttal (`409 NOT_APPLICABLE`).
- Resolve (audited `RESOLVE_DISPUTE`; `409 DISPUTE_CLOSED` when already resolved; `notes` ≥ 10 characters):
  - `RESOLVED_NURSE`: freeze lifted, the 85% is released now when the shift is checked out, otherwise by the settlement
    sweep after check-out. Penalty appeal → `PENALTY_REVERSAL`.
  - `RESOLVED_CUSTOMER`: whatever the escrow holds is refunded 100%; TrustScore −`TRUST_PENALTY_DISPUTE_UPHELD` (25);
    optional `depositDeduction` → deposit penalty `DISPUTE_UPHELD` (not appealable). Penalty appeal → rejected, nothing moves.

