# BR-13: Advance Booking, Direct Selection & Shift Extension

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §2.2, §4.2 (FR-SEARCH-01), §4.3 (FR-BOOK-01, FR-BOOK-02, FR-BOOK-03), §4.4 (FR-SHIFT-03), §5.2  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Supersession Note:** The old advance-booking machinery (2h–14d horizon, per-day shift caps, T-24h/T-3h/T-2h reminder milestones, 30-minute nurse response window, deposit transfer on reschedule) is not part of SRS v2.0. Advance booking now runs on the **Job Board** mechanism, and the only in-flight time change SRS v2.0 defines is **shift extension**.

---

## 1. Context & Business Intent

1. **Planned Care via Broadcast:** Bookings made more than 6 hours ahead do not need radar pressure; they are published on the Job Board where eligible nurses claim them, and Customers may alternatively invite a nurse they have reviewed (FR-SEARCH-01).
2. **Controlled Flexibility:** Once a shift is running, the SRS allows exactly one time modification — extension by the Customer with the nurse's consent (FR-SHIFT-03). All other changes resolve through the cancellation/SLA matrix (§5.2).

---

## 2. Rule Specifications

### 2.1 Advance Booking Flow (FR-BOOK-03, Mechanism B)
- A booking whose shift starts in **> 6 hours** is published on the **Job Board** (`matching_mode = JOB_BOARD`) for eligible nurses (BR-08 filters) to claim first-come.
- The booking is created in `DRAFT`; for bank-transfer bookings it enters `MATCHING` once payment is locked in escrow (15-minute payment hold, BR-03 §2.3). Cash bookings are paid at the care location (FR-PAY-01).
- If still unclaimed **30 minutes before the shift start**, the booking expires with a 100% refund (§5.2 row 9).

### 2.2 Direct Selection of a Nurse (FR-SEARCH-01)
- Before booking, the Customer can search nurse profiles filtered by service type, geographic area, time slot, tier, and gender, viewing name, photo, tier, years of experience, retired-medical-staff badge, `rating_avg`, and past reviews.
- The Customer may send a **direct request** to one chosen nurse. That nurse has **15 minutes to respond**; on decline or timeout the booking is broadcast on the Job Board (no violation is recorded for declining a direct request).

### 2.3 Invasive Advance Bookings — Doctor's Order (FR-BOOK-02)
- If the service is invasive (`is_invasive = true`), the Customer **must attach a doctor's order (y lệnh) image** at booking creation — showing patient name, drug name/dosage, doctor's signature/stamp, and an issue date **≤ 7 days** old — and enter the order's issue date. Missing attachment → **HTTP 400** (RTM TC-BOOK-01).
- Such bookings are held for **Admin review of the y lệnh (`PENDING_ADMIN_REVIEW`)** before entering matching.
- The assigned Tier 2 nurse re-checks the order image before accepting, and verifies the original order and the actual medication on site at check-in, with a no-penalty refusal right if the order is invalid (FR-BOOK-02; Group C).

### 2.4 Shift Extension (FR-SHIFT-03)
- **30 minutes before the scheduled end**, the Customer may request an extension in **multiples of 1 hour** (`POST /api/v1/bookings/:id/extend`).
- The extension takes effect only if the nurse has **no conflicting next shift** (BR-14 §2.5) and **agrees** in the app.
- For bank-transfer bookings, the Customer pays the extension fee **additionally into escrow** before the extension is confirmed.

### 2.5 Cancellation Instead of Rescheduling (§5.2)
- SRS v2.0 defines **no self-service rescheduling flow**. A Customer who cannot keep a slot cancels under the §5.2 matrix (bank-transfer refunds):
  - **> 12 hours** before start: 0% fee, 100% refund.
  - **2–12 hours** before start: 20% fee, 80% refund (15% compensates the nurse, 5% to the platform).
  - **< 2 hours** before start (not yet checked in): 50% fee, 50% refund (40% to the nurse, 10% to the platform).
  - **Medical force majeure** (patient transferred to ICU / deceased, with confirmation documents): 100% fee waiver and refund; fixed 50,000 VNĐ travel support (`ICU_TRAVEL_SUPPORT`) to a nurse who already travelled.
- For cash bookings no refund arises (nothing was prepaid); customer cancellation fees are not collected through the system and the cancellation is recorded in the Customer's cancellation history (§5.2 note).

### 2.6 Open Items
- [Not specified in SRS v2.0 — open item] Rescheduling rules (eligibility window, per-booking reschedule limits, price-difference handling) are not specified; see §2.5 for the defined alternative.
- [Not specified in SRS v2.0 — open item] Automated reminder milestones before a shift (the old T-24h / T-3h / T-2h scheme) are not specified in SRS v2.0; notification channels are defined generically in FR-NOTIF-01.
- [Not specified in SRS v2.0 — open item] Maximum advance-booking horizon (the old 14-day cap) is not specified.

---

## 3. Traceability & Dependencies

- **SRS References:** §2.2 (booking state machine), §4.2 FR-SEARCH-01, §4.3 FR-BOOK-01 / FR-BOOK-02 / FR-BOOK-03, §4.4 FR-SHIFT-03, §5.1 (`ICU_TRAVEL_SUPPORT`), §5.2 rows 1–5 & 9, §10 RTM TC-BOOK-01
- **API Endpoints:** `POST /api/v1/bookings`, `GET /api/v1/nurses/search`, `POST /api/v1/bookings/:id/extend`
- **Related Rules:** BR-03 (windows & urgency), BR-08 (Job Board mechanics), BR-14 (prerequisites), Group D (payment & refund execution)
