# BR-07: Geofenced Check-In & Shift Abandonment

> **Group:** Group C — Care Visit Execution  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** FR-SHIFT-01, FR-SHIFT-02, FR-BOOK-02, FR-BOOK-03, SRS §2.2, §5.1 (`CHECKIN_MAX_RADIUS_METERS`), §5.2 row 8, RISK-04, RISK-05  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **Verified Physical Presence:** Care is delivered at the patient's home or hospital bedside by an independent nurse. The platform must have fraud-resistant proof that the assigned nurse is physically at the booking address before the shift (and its payment clock) starts.
2. **No Silent Failures:** A confirmed booking must never fail silently. A nurse who does not show up triggers a deterministic replacement attempt and, failing that, the no-show sanctions of SRS §5.2 row 8 (see BR-02).

---

## 2. Rule Specifications

### 2.1 Valid Check-In (FR-SHIFT-01, RISK-05)

A check-in is valid if and only if **all** of the following checks pass, in order:

1. **Anti-Mock-Location Check:** If the OS reports a mock/simulated location flag (`Location.isFromMockProvider` on Android, `isSimulatedBySoftware` on iOS), check-in is rejected immediately and the attempt is recorded (`shift_logs.is_mock_location_detected = true`).
2. **Geofence Proximity:** The Haversine distance between the nurse's device GPS coordinates and the booking coordinates must be **≤ 200 m** (system config `CHECKIN_MAX_RADIUS_METERS = 200`).
3. **Live Selfie:** The nurse captures a facial photo directly through the in-app camera (gallery uploads are blocked), with a basic liveness action (slight head turn / blink) or, at minimum, a server timestamp + GPS coordinate watermark burned into the image. The selfie is pushed to the customer's app screen so the customer can visually cross-check the person at the door.

On success, `execution_status` transitions to `IN_PROGRESS` and the evidence is stored on the booking's `shift_logs` record (`checkin_time`, `checkin_lat`, `checkin_lng`, `checkin_selfie_url`).

**Session PIN:** SRS v2.0 does **not** define a PIN/code-based second factor for check-in; the customer-side confirmation in SRS v2.0 is the visual cross-check of the live selfie described above. A customer-issued session PIN is **[Not specified in SRS v2.0 — open item]**. Likewise, SRS v2.0 does not define an early check-in opening window (e.g., check-in enabled N minutes before the scheduled start) — **[Not specified in SRS v2.0 — open item]**.

### 2.2 First-30-Minutes On-Site Duties (FR-SHIFT-02, FR-BOOK-02, RISK-04)

Within the first 30 minutes after check-in, the nurse must:

- **Record the start-of-shift handover/condition confirmation:** confirm the patient's actual condition against the condition declared at booking (see BR-16 §2.3 for the mismatch rights that follow from this check).
- **For invasive services, verify the original medical order on site:** compare the paper doctor's order (y lệnh) and the actual medication against the image uploaded at booking. On any mismatch (forged, expired, altered order, or non-matching medication), the nurse invokes the "Reject shift — invalid medical order" action with photo evidence: the booking is cancelled immediately, the nurse receives **no penalty** (no deposit deduction, no TrustScore deduction) and is paid travel compensation (FR-BOOK-02 Rule 3; see BR-15 §2.2).

### 2.3 Nurse No-Show & Abandonment (SRS §5.2 row 8)

- If **30 minutes after the scheduled start time** the nurse has not arrived/checked in **and** the SOS Dispatch replacement search finds no substitute nurse, the booking is treated as a **nurse no-show**:
  - The nurse's profile is **BANNED immediately** (first offence; see BR-02).
  - The customer is refunded **100%** (transfer bookings; `payment_status = REFUNDED`).
  - A **50,000 VNĐ** fine (config `NO_SHOW_PENALTY`) is deducted from the nurse's deposit wallet (`PENALTY_DEDUCT`; shortfall is booked as debt against later income) and the full amount is converted into a **50,000 VNĐ voucher for the customer**.
- Before the 30-minute no-show threshold is reached, late cancellations and replacement dispatch follow BR-02 (SRS §5.2 rows 6–7), and a booking that cannot be matched at all expires per §5.2 row 9 (`EXPIRED`, 100% refund if prepaid).
- **Nurse lateness short of no-show** (nurse arrives, but late): SRS v2.0 §5.2 defines no customer remedy (free cancellation / lateness voucher) for this case — **[Not specified in SRS v2.0 — open item]**.
- **Mid-shift abandonment** (nurse leaves early without cause) is not a separate automatic mechanism in SRS v2.0; it is a dispute ground ("leaving early" / "Bỏ về sớm") adjudicated under BR-11 with the outcomes of BR-18. The former 24-hour auto-unlock safeguard (old Q-43) does not exist in SRS v2.0 and is not carried over.

### 2.4 Customer Absence on Arrival

SRS v2.0 does not specify a waiting period or an automatic full-pay rule for the case where the nurse arrives but the customer/patient is absent and unreachable — **[Not specified in SRS v2.0 — open item]**. The nurse's remedy path is the in-app dispute mechanism (BR-11). The former 15-minute patient-absence forfeiture rule of the hospital baseline is not carried over.

---

## 3. Traceability & Dependencies

- **SRS References:** FR-SHIFT-01, FR-SHIFT-02, FR-BOOK-02, FR-BOOK-03; SRS §2.2 (execution axis), §5.1, §5.2 rows 8–9; RISK-04, RISK-05
- **APIs:** `POST /api/v1/bookings/:id/check-in`; `POST /api/v1/bookings/:id/reject-invalid-prescription`
- **Related Rules:** BR-02 (cancellation & infractions), BR-15 (medical orders), BR-16 (mid-session stop), BR-11 (disputes)
