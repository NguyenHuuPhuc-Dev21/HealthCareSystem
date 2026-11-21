# API contract — `prescription-rejection` (Phase 4, owner BE-1 / Dev A)

Base URL: `/api/v1` · every request: `Authorization: Bearer <accessToken>` of a **NURSE** · FR-BOOK-02 Layer 3.

On site, the nurse compares the paper medical order and the medication with the image uploaded at booking.
If it is forged, altered, expired or does not match, she rejects the shift with a photo. **No penalty**:
no deposit deduction, no TrustScore change. She is owed the fixed travel support (`ICU_TRAVEL_SUPPORT`, 50,000 VND).

## Flow (Nurse App)

1. `POST /bookings/:id/reject-invalid-prescription/evidence-upload-url` → `uploadUrl` + `objectKey`
2. `PUT <uploadUrl>` with the photo as body and the header `Content-Type: <contentType>` (straight to storage)
3. `POST /bookings/:id/reject-invalid-prescription` with `reason` and `evidenceKey = objectKey`

Available from `PRESCRIPTION_REJECTION_WINDOW_MINUTES` (60) minutes before the scheduled start until the scheduled end.

---

### `POST /bookings/:id/reject-invalid-prescription/evidence-upload-url`
```json
{ "contentType": "image/jpeg" }
```
`contentType`: `image/jpeg` | `image/png` | `image/webp`. File size ≤ 10 MB.

`200`
```json
{ "success": true, "data": {
  "objectKey": "prescription-rejection/<nurseId>/<uuid>.jpg",
  "uploadUrl": "https://…",
  "expiresInSeconds": 600,
  "contentType": "image/jpeg"
} }
```
Same booking checks as the rejection below (so the photo is only taken for a booking she can reject).

### `POST /bookings/:id/reject-invalid-prescription`
```json
{ "reason": "Y lệnh bị tẩy xóa ngày kê, thuốc thực tế không khớp", "evidenceKey": "prescription-rejection/<nurseId>/<uuid>.jpg" }
```
`reason`: 10–1000 characters.

`200`
```json
{ "success": true, "data": {
  "bookingId": "…",
  "executionStatus": "CANCELLED",
  "paymentStatus": "REFUNDED",
  "refundedAmount": 350000,
  "travelSupportAmount": 50000,
  "travelSupportStatus": "PENDING"
} }
```
- Bank-transfer booking with the prepayment held: refunded 100% → `paymentStatus: "REFUNDED"`.
- Cash booking: nothing to refund → `refundedAmount: 0`, `paymentStatus` unchanged.
- `travelSupportStatus: "PENDING"`: owed to the nurse, paid by the wallet module (Phase 5).
- The customer receives a notice that the shift was cancelled because the medical order is invalid.

| Error | When |
|---|---|
| `400 VALIDATION_ERROR` | `reason` too short/long, unknown field |
| `400 INVALID_FILE_KEY` | `evidenceKey` is not an evidence upload of this nurse |
| `400 FILE_NOT_UPLOADED` | step 2 was skipped or failed |
| `400 FILE_TOO_LARGE` | empty file or larger than 10 MB |
| `400 FILE_TYPE_NOT_ALLOWED` | the file is not really a JPEG/PNG/WebP photo |
| `403 NOT_ASSIGNED_NURSE` | she is not the nurse of this booking |
| `404 BOOKING_NOT_FOUND` | unknown booking |
| `409 PRESCRIPTION_NOT_REQUIRED` | the service is not invasive (no medical order) |
| `409 ALREADY_CANCELLED` | the booking is already cancelled (also the loser of a double tap) |
| `409 BOOKING_NOT_ACTIVE` | the booking is not `CONFIRMED` / `IN_PROGRESS` |
| `409 TOO_EARLY_TO_REJECT` | before the window opens; `details.opensAt` (ISO time) |
| `409 SHIFT_ALREADY_ENDED` | after the scheduled end |

## Notes for FE-2
- The current shared contract `RejectPrescriptionRequest` sends `evidencePhotoBase64`. Use the 3-step flow above instead:
  photos never go through the API (body limit 1 MB, NFR-SEC-01).
- Use `details.opensAt` to show when the button becomes available; do not hardcode 60 minutes.
