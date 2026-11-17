# Two-Way Reviews & TrustScore API (`reviews`)

> **Specification Baseline:** SRS §7 Table 12, FR-RATE-01, Phase 6 BE-1 / FE-2  
> **Base path:** `/api/v1`  
> **Roles:** `NURSE`, `PATIENT` (Customer)

---

## 1. Overview & Business Rules

1. **Immediate availability (FR-RATE-01):** Reviews open immediately once the booking transitions to `execution_status = COMPLETED` (after check-out report submission). They do **NOT** depend on financial settlement (`SETTLED`).
2. **Two-Way Blind Review (Double-Blind 7 days):**
   - When one party submits a review, its visibility is set to `is_visible = false`.
   - The review becomes public (`is_visible = true`) **ONLY** when:
     - The second party submits their review for the same booking, OR
     - 7 days elapse from shift completion (flipped by the scheduled background job).
3. **One review per party:** A user can review a specific booking at most once (`UNIQUE(booking_id, reviewer_id)`).
4. **No self-review:** `reviewer_id <> reviewee_id`.
5. **Rating window:** Reviews must be submitted within 7 days of shift completion (`completed_at`). After 7 days, submissions fail with `REVIEW_WINDOW_CLOSED`.
6. **TrustScore Impact:**
   - A customer rating of $\ge 4$ stars for a nurse triggers a `+2` TrustScore recovery points (capped at 100).
   - A nurse rating the customer does **not** modify the nurse's own TrustScore.

---

## 2. Endpoints

### 2.1 Submit Rating for Booking (`POST /api/v1/bookings/:id/reviews`)

Submit rating (1–5 stars), optional comment (max 500 characters), and optional quick tags.

- **Role:** `NURSE` or `PATIENT`
- **Path Param:** `id` (UUID of the booking)

#### Request Body (`CreateReviewInput`):
```json
{
  "rating": 5,
  "comment": "Gia đình hỗ trợ rất chu đáo, chuẩn bị sẵn vật tư y tế.",
  "tags": ["Hợp tác tốt", "Thông tin đúng", "Môi trường sạch sẽ"]
}
```

#### Success Response (`201 Created`):
```json
{
  "success": true,
  "data": {
    "review_id": "8a065c71-3312-4217-910a-3ec663df5692"
  }
}
```

#### Error Codes:
- `400 Bad Request` / `INVALID_RATING`: Rating is not an integer between 1 and 5.
- `400 Bad Request` / `COMMENT_TOO_LONG`: Comment exceeds 500 characters.
- `409 Conflict` / `REVIEW_ALREADY_SUBMITTED`: Reviewer already submitted a review for this booking.
- `410 Gone` / `REVIEW_WINDOW_CLOSED`: 7-day review window after completion has expired.
- `403 Forbidden` / `NOT_BOOKING_PARTICIPANT`: User is not the assigned nurse or patient of this booking.
- `409 Conflict` / `SHIFT_NOT_COMPLETED`: Booking has not reached `COMPLETED` execution status.

---

### 2.2 Get Pending Reviews for Nurse (`GET /api/v1/nurse/reviews/pending`)

List completed shifts where the nurse has not yet submitted a review and the review window is still open.

- **Role:** `NURSE`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "bookingId": "job-1",
      "bookingCode": "BK-20261102-001",
      "customerName": "Anh Nguyễn Minh Tuấn",
      "completedAt": "2026-11-13T10:30:00Z",
      "expiresAt": "2026-11-20T10:30:00Z"
    }
  ]
}
```

---

### 2.3 Get Sent Reviews by Nurse (`GET /api/v1/nurse/reviews/sent`)

List all reviews submitted by the authenticated nurse, including visibility status (`isVisible`).

- **Role:** `NURSE`

#### Success Response (`200 OK`):
```json
{
  "success": true,
  "data": [
    {
      "id": "rev-sent-1",
      "bookingCode": "BK-20261028-011",
      "customerName": "Bác sĩ Vũ Hoàng Hải",
      "rating": 5,
      "comment": "Gia đình hỗ trợ rất chu đáo, chuẩn bị sẵn vật tư y tế.",
      "tags": ["Hợp tác tốt", "Thông tin đúng"],
      "isVisible": true,
      "createdAt": "2026-10-28T18:15:00Z"
    },
    {
      "id": "rev-sent-3",
      "bookingCode": "BK-20261112-033",
      "customerName": "Anh Đỗ Quang Vinh",
      "rating": 5,
      "isVisible": false,
      "createdAt": "2026-11-12T09:20:00Z"
    }
  ]
}
```
