# check-in (BE-2 · Phase 4)

Dual-verified arrival on site — FR-SHIFT-01 · SRS §4.4 · BR-07 · NFR-SEC-01. Contract:
[`docs/api/shift-execution.api.md`](../../../../../docs/api/shift-execution.api.md) §2 · Migration `0024_shift_execution.sql`.

| File | Role |
|---|---|
| `check-in.types.ts` | problems, selfie upload row, storage port, accepted photo types |
| `check-in.policy.ts` | pure: check-in window, Haversine distance, selfie freshness |
| `check-in.repo.ts` | `checkin_selfie_uploads`, `checkin_attempts` |
| `check-in.watermark.ts` | burns server time + GPS into the selfie (sharp) |
| `check-in.service.ts` | `requestSelfieUploadUrl`, `checkIn` |
| `check-in.routes.ts` | `POST /bookings/:id/check-in/selfie-upload-url`, `POST /bookings/:id/check-in` |

## Rules

1. **Window** — from start − `CHECKIN_OPENS_BEFORE_START_MINUTES` until the scheduled end; booking `CONFIRMED`; the
   assigned nurse only.
2. **Mock location** — the app sends `isMockLocation` (Android `isFromMockProvider` / iOS `isSimulatedBySoftware`).
   `true` → `403 MOCK_LOCATION_DETECTED`, a `checkin_attempts` row and `shift_logs.is_mock_location_detected = TRUE`
   (kept even if a later check-in succeeds: Admin sees the alert).
3. **Distance** — Haversine (`@healthcare-system/shared` `haversineDistanceMeters`) to the patient profile position
   ≤ `CHECKIN_MAX_RADIUS_METERS` (200 m inclusive), else `403 OUT_OF_RADIUS` (logged).
4. **Live selfie** — the app gets a presigned PUT (`checkin-selfie/<nurse>/<uuid>`). The key is recorded with the
   booking and nurse; the check-in accepts it only if unused and issued at most `CHECKIN_SELFIE_MAX_AGE_MINUTES` ago
   (a gallery photo or a photo of an earlier shift cannot be replayed), then checks it exists, its size and its magic
   bytes (JPEG / PNG / WebP). Camera-only capture is enforced by the app (gallery disabled).
5. **Stamp on the photo** (SRS RISK-05 / NFR-SEC-01 "đóng dấu Server Timestamp + tọa độ lên ảnh") — the server reads
   the upload, burns `HealthCareSystem · Check-in <code>` and `YYYY-MM-DD HH:mm:ss · lat, lng (GMT+7)` into a band at the
   bottom (sharp), re-encodes as JPEG ≤ 1080 × 1440 without metadata, and stores it under a new `checkin-selfie/` key:
   `shift_logs.checkin_selfie_url` is the stamped photo, the original upload stays in `checkin_selfie_uploads` as
   evidence. The stamp time = `shift_logs.checkin_time` (one server clock read). Not decodable → `400 SELFIE_UNREADABLE`.
   `core/storage` gained `readObject` / `putObject` for this (server-side processing only).
6. Under the booking lock: selfie marked used, `CONFIRMED → IN_PROGRESS`, `shift_logs` row + care checklist
   (`shift-logs.policy.defaultChecklist`), accepted attempt logged. After COMMIT: WebSocket `CHECKED_IN`, family notified.

No `requireNurseEligibility` on the routes (same as prescription-rejection): a nurse suspended after accepting must
still be able to honour a confirmed shift.

## Open items

1. **Liveness** (blink / turn the head) is done by the app; AI eKYC liveness is a commercial-phase upgrade (NFR-SEC-01).
2. **App change** — nurse-app still posts `multipart/form-data`; FE-2 to switch to upload URL → PUT → `selfieKey`.
3. **No-show** — cancellation row 8 (nurse not checked in `NO_SHOW_GRACE_MINUTES` after the start) can now use
   "booking still `CONFIRMED`" as its trigger (BE-1 / BE-3, Phase 5).
4. **prescription-rejection** (BE-1) can switch its time window to "after check-in" as its README planned.
5. **Admin view** of `checkin_attempts` (mock-location alerts) — Phase 7 admin-users.
