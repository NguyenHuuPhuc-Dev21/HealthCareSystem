# sos API (BE-3 · Phase 4 · FR-SHIFT-05 · TC-SOS-01 · BR-23)

Emergency during a shift. **The app assists; it never replaces 115**: the nurse app's SOS button opens the 115
dialer first (no network needed), then calls this API (or queues it offline and replays it).
Base path `/api/v1`, Bearer token.

## 1. Endpoints

| Method | Path | Who | Body / query | Answer `data` |
|---|---|---|---|---|
| POST | `/bookings/:id/sos` | nurse or family of the booking (CONFIRMED / IN_PROGRESS) | `{ lat?, lng? }` (patient-web) or `{ latitude?, longitude?, currentVitals? }` (nurse-app) | `SosAlert` + `{ triggered: true, emergency_id, created }` — 201 new, 200 already open |
| GET | `/bookings/:id/sos` | parties, Admin | — | the open (else latest) `SosAlert`, or `null` |
| GET | `/sos-alerts?status=OPEN\|ACTIVE\|ACKNOWLEDGED\|CLOSED\|ALL` | anyone signed in | default `OPEN` | `{ items: SosAlert[] }` — family / nurse: their bookings; Admin: all |
| POST | `/sos-alerts/:id/acknowledge` | family or Admin | — | `SosAlert` (`ACKNOWLEDGED`; idempotent) |
| POST | `/sos-alerts/:id/report` | nurse of the booking or Admin | `{ note, called115?, hospital? }` | `{ updated: true }` |
| GET | `/admin/sos-alerts?status=` · `/admin/sos-alerts/:id` | Admin | — | list · alert + `incidentLog[]` |
| POST | `/admin/sos-alerts/:id/close` | Admin | `{ outcome: TRANSFERRED_TO_HOSPITAL\|RESOLVED_ON_SITE\|FALSE_ALARM, note }` | `SosAlert` (`CLOSED`), audited `CLOSE_SOS_INCIDENT` |

`SosAlert` (patient-web `booking-tracking.types.ts`): `alertId, bookingId, bookingCode, patientName, nurseName,
raisedAt, raisedBy (NURSE|FAMILY), status (ACTIVE|ACKNOWLEDGED|CLOSED), lat, lng, latestVitals (VitalReading|null),
acknowledgedAt, closedAt` + `outcome, closeNote`.

Errors: `403 FORBIDDEN` (not a party; same answer for an unknown booking), `409 SHIFT_NOT_ACTIVE`,
`403 FAMILY_OR_ADMIN_ONLY` (the nurse cannot acknowledge her own alert), `409 SOS_CLOSED`, `404 SOS_NOT_FOUND`.

## 2. What happens on POST /bookings/:id/sos

1. Under the booking lock: one open alert per booking. Pressing again, the other party pressing, or the nurse app
   replaying its offline queue returns the open alert (`created: false`) — nobody is alerted twice.
2. Position: the phone's GPS, else the check-in position, else the care address. Vitals: `currentVitals` sent by
   the nurse app, else the latest reading of the shift log.
3. `RAISED` is appended to `shift_logs.emergency_incident_log` (the incident report, append-only).
4. After COMMIT, all at once: the family + every active Admin (+ the nurse when the family pressed; never the person
   who pressed) get notification **type `SOS`, priority HIGH**: in-app + WebSocket (`/ws/notifications`) + push,
   title `KHẨN CẤP · <patient> · ca <code>`, body with "call 115", a Google Maps link and the vitals,
   `data: { alertId, bookingId, bookingCode, lat, lng }`. **Unacknowledged after 60 s → one SMS** (core/notifications).
   Integration test: the family's socket receives it in < 2 s (TC-SOS-01).

Acknowledging (banner button, or reading the notification) stops that person's SMS fallback; the nurse then gets
`SOS_ACKNOWLEDGED`. Closing sends `SOS_CLOSED` to the family and the nurse. Ops alert `SOS_UNACKNOWLEDGED`
fires when an SOS stays unacknowledged > 2 min (`docs/runbooks/sos-response.md`).

## 3. For other modules

- **shift-logs (BE-2)** `GET /bookings/:id/tracking` → `emergency`: `emergencyForBooking(db, bookingId)` from
  `modules/sos/sos.service` returns the same `SosAlert` (or null).
- **nurse-app (FE-2)**: the SOS acknowledgement arrives as a `/ws/notifications` message of type `SOS_ACKNOWLEDGED`.
