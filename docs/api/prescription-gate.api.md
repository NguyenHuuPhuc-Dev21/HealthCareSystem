# API contract — `prescription-gate` (Phase 3, owner BE-1 / Dev A)

Base URL: `/api/v1` · every request: `Authorization: Bearer <accessToken>` · FR-BOOK-02 Layers 1–2.

Invasive services (`is_invasive = true`) can only be booked with a doctor's prescription.

## Layer 1 — the customer books (owned by `bookings`)

Upload and booking creation are `bookings` endpoints — see [`bookings.api.md`](bookings.api.md):
`POST /bookings/prescription/upload-url` (JPEG/PNG/WebP, ≤ 10 MB), then `POST /bookings` with
`prescription: { imageKey, issuedDate }`.

### The prescription rule (errors of `POST /bookings`)
All are `400`. Until `bookings` delegates to this module it uses its own copy of the rule:
`INVALID_PRESCRIPTION_DATE` and `details.maxAgeDays` only appear after the switch.

| Code | When |
|---|---|
| `PRESCRIPTION_REQUIRED` | invasive service without `prescription` |
| `INVALID_PRESCRIPTION_DATE` | the date is not a real `YYYY-MM-DD` date |
| `PRESCRIPTION_DATE_IN_FUTURE` | issue date after today (Vietnam time) |
| `PRESCRIPTION_EXPIRED` | older than `details.maxAgeDays` days (7 by default, from `system_configs`) |
| `INVALID_FILE_KEY` | the key is not a prescription upload of this customer |
| `FILE_NOT_UPLOADED` | step 2 was skipped or failed |
| `FILE_TOO_LARGE` | empty file or larger than 10 MB |
| `FILE_TYPE_NOT_ALLOWED` | the file content is not really a JPEG/PNG/WebP image |

Show the maximum age from `details.maxAgeDays`; do not hardcode 7.

---

## Layer 2 — reading the prescription (this module)

### `GET /bookings/:id/prescription`
A download link for the prescription image, valid for at most 10 minutes. Ask again for a new link; do not store it.

`200`
```json
{ "success": true, "data": {
  "url": "https://…",
  "expiresInSeconds": 600,
  "basis": "CANDIDATE_NURSE",
  "issuedDate": "2026-11-12"
} }
```
`basis`: `OWNER` (the customer) · `ADMIN` · `ASSIGNED_NURSE` · `CANDIDATE_NURSE` (Tier 2 nurse looking before accepting).

| Who | May view when |
|---|---|
| Customer | the booking is theirs |
| Admin | always (audited) |
| Assigned nurse | from `CONFIRMED` until 12 h after check-out, or with an Admin re-grant (audited) |
| Other nurse | the booking is still `MATCHING`, she has a live offer for it, and she is an active Tier 2 nurse with a valid GPHN (audited) |

| Error | When |
|---|---|
| `404 BOOKING_NOT_FOUND` | unknown booking — also what a customer gets for someone else's booking |
| `404 PRESCRIPTION_NOT_FOUND` | the booking has no prescription (non-invasive service) |
| `403 RECORD_ACCESS_DENIED` | assigned nurse outside the access window; `details.reason` |
| `403 PRESCRIPTION_ACCESS_DENIED` | other nurse; `details.reason` = `NOT_OFFERED` \| `BOOKING_NOT_OPEN` \| `TIER_2_REQUIRED` |

## Notes for FE
- **Nurse apps (Layer 2):** on the offer / job-board detail of an invasive booking, call this endpoint and show the image before enabling "Accept".
- The link is a private, short-lived URL — never log it, never put it in analytics.
