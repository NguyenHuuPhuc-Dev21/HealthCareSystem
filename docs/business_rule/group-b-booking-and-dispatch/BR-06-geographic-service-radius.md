# BR-06: Geographic Service Radius & Distance Limits

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §4.3 (FR-BOOK-03), §7, §9.3  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Supersession Note:** There is no hospital facility to measure distance from. The radius is measured between the **care location** (patient profile coordinates) and the **nurse's current GPS position**, and it drives the Radar Dispatch waves. The old 15 km / 45-minute per-hospital radius is abolished.

---

## 1. Context & Business Intent

1. **Travel Time Realism:** Urgent dispatch only works if the nurse can physically arrive in time. Radar matching therefore expands in controlled radius waves around the care location.
2. **Care Location over Registered Domicile:** Service availability is determined by the actual care address on the patient profile (home or hospital), never by legal domicile or birthplace.

---

## 2. Rule Specifications

### 2.1 Radar Radius Waves (FR-BOOK-03)
- **Wave 1:** nurses within **5 km** of the care location are pushed the booking during **minutes 0–5**.
- **Wave 2:** if unclaimed, the radius expands to **10 km** during **minutes 5–15**.
- No further expansion beyond 10 km is defined; a booking that stays unclaimed expires per BR-01 §2.2 (100% refund for bank-transfer bookings).

### 2.2 Distance Basis & Computation (SRS §7, §9.3)
- The care location's coordinates come from the patient profile (`patient_profiles.lat` / `lng`), produced by **Geocoding** of the care address when the profile is created (§9.3).
- The nurse's position is the nurse profile's current GPS coordinates (`nurse_profiles.current_lat` / `current_lng`).
- The backend filters nurses inside the 5 km / 10 km radius using a **spatial index (PostGIS / EarthDistance)** with a target query time under 500 ms (§9.3).

### 2.3 Distinction from the Check-In Radius
- The matching radius (5 km / 10 km) governs **who is offered** a job.
- The **check-in radius of 200 m** (`CHECKIN_MAX_RADIUS_METERS`, SRS §5.1) is a separate anti-fraud control applied when the assigned nurse checks in at the care location (FR-SHIFT-01). The two radii must not be conflated.

### 2.4 Open Items
- [Not specified in SRS v2.0 — open item] A travel-time-based limit (the old baseline's 45-minute rule) is not specified in SRS v2.0; distance is the only geographic criterion.
- [Not specified in SRS v2.0 — open item] Any radius rule for Job Board (advance) bookings or direct selection — SRS v2.0 defines radius waves only for Radar Dispatch; profile search filters by geographic area (FR-SEARCH-01) without a fixed kilometre cap.

---

## 3. Traceability & Dependencies

- **SRS References:** §4.2 FR-SEARCH-01, §4.3 FR-BOOK-03, §5.1 (`CHECKIN_MAX_RADIUS_METERS`), §7 (`patient_profiles.lat/lng`, `nurse_profiles.current_lat/current_lng`), §9.3 (Maps & geolocation integration), §10 RTM TC-MATCH-02
- **Related Rules:** BR-03 (booking windows), BR-08 (matching engine), BR-13 (advance booking)
