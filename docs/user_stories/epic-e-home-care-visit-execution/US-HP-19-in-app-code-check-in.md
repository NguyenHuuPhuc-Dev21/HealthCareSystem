# User Story US-HP-19: Nurse Checks In with GPS Verification & Live Selfie at the Care Address

> **Epic:** EPIC E — Shift Execution  
> **Bounded Context:** `Shift Execution`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-19`
- **Story Title:** Nurse Checks In with GPS Verification & Live Selfie at the Care Address
- **Bounded Context:** `Shift Execution`
- **Primary Persona:** Nurse, Customer
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-SHIFT-01 · RISK-05 · NFR-SEC-01 · SRS §5.1 `CHECKIN_MAX_RADIUS_METERS` · SRS §7 (`shift_logs`) · SRS §8 `POST /api/v1/bookings/:id/check-in` · SRS §10 TC-SEC-01

---

## 💡 Real-World Context & Problem Statement

1. **Phantom check-ins destroy trust in a marketplace:** A nurse who can check in remotely — using fake-GPS apps or a pre-taken photo — gets paid for care that never happened and leaves a patient unattended.
2. **Dual verification is the SRS control (FR-SHIFT-01 / RISK-05):** Check-in must prove, at the same moment, that the nurse's device is physically within range of the booking address (GPS with mock-location detection) and that the nurse is personally present (live selfie, never a gallery image), with the selfie shown to the customer for cross-checking.

---

## 📖 User Story Statement

> As an **Assigned Nurse**,  
> I want to check in at the care address with GPS verification (≤ 200 m) and a live selfie that the customer can cross-check on their screen,  
> So that my physical presence and the shift start time are verified indisputably and the shift can begin.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Mock-Location Detection Blocks Check-In
- **Given** a nurse device whose operating system reports a mock/simulated location (`isFromMockProvider = true` on Android / `isSimulatedBySoftware` on iOS),
- **When** the nurse attempts to check in,
- **Then** the check-in is rejected immediately, and the attempt is recorded in `shift_logs` with `is_mock_location_detected = true` (SRS §10 TC-SEC-01).

### AC-02: GPS Distance Must Be Within 200 m of the Booking Address
- **Given** a booking in `execution_status = CONFIRMED` and the nurse at the care address,
- **When** the nurse submits a check-in via `POST /api/v1/bookings/:id/check-in`,
- **Then** the backend computes the Haversine distance between the device GPS coordinates and the booking coordinates and accepts the location only if it is ≤ 200 m (`CHECKIN_MAX_RADIUS_METERS = 200`); check-ins from farther away are rejected.

### AC-03: Live Selfie — No Gallery Uploads, Server-Stamped
- **Given** a location-valid check-in attempt,
- **When** the nurse captures the check-in selfie,
- **Then** the image must be captured live through the in-app camera (gallery selection is disabled), with a basic liveness action (e.g. slight head turn / blink) or a server timestamp + GPS coordinate watermark stamped on the image (RISK-05, NFR-SEC-01).

### AC-04: Customer Cross-Check & Shift Start
- **Given** a valid GPS result and live selfie,
- **When** the check-in is submitted,
- **Then** the selfie is sent to the customer's screen for visual cross-check against the arriving nurse, `checkin_time`, `checkin_lat`, `checkin_lng`, and `checkin_selfie_url` are recorded in `shift_logs`, and the booking transitions to `execution_status = IN_PROGRESS`.

### AC-05: On-Site Prescription Cross-Check for Invasive Services
- **Given** an invasive-service booking (`is_invasive = true`) at check-in,
- **When** the TIER_2_SPECIALIST nurse compares the original paper prescription and the actual medication against the image attached to the booking,
- **Then** any mismatch is handled through the no-penalty rejection flow (FR-BOOK-02, see US-HP-24) instead of starting care.

### Open Items
- A customer-provided session PIN/code as an additional check-in factor, and a defined earliest check-in moment (e.g. a window opening before the scheduled start), are **[Not specified in SRS v2.0 — open item]**. SRS v2.0 specifies the dual GPS + live-selfie verification above as the check-in mechanism (FR-SHIFT-01).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP19-01` | Successful check-in within 200 m with live selfie | Functional | Booking moves to `IN_PROGRESS`; `shift_logs` records time, coordinates, selfie URL |
| `TC-USHP19-02` | Check-in with mock location enabled (SRS TC-SEC-01) | Security / Anti-fraud | Check-in blocked; `is_mock_location_detected = true` logged |
| `TC-USHP19-03` | Check-in from beyond 200 m | Functional | Check-in rejected; booking remains `CONFIRMED` |
| `TC-USHP19-04` | Gallery image submitted instead of live capture | Security / Anti-fraud | Upload rejected; live camera capture required |
| `TC-USHP19-05` | Selfie delivered to customer for cross-check | Functional | Customer app displays the check-in selfie for the booking |
