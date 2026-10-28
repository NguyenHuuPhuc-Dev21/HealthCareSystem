# BR-03: Booking Windows, Shift Types & Night Hours

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §1.2, §2.2, §4.2 (FR-SCHED-01), §4.3 (FR-BOOK-01, FR-BOOK-03), §5.1  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Supersession Note:** The marketplace has **no hospital operating hours**. The old fixed windows (weekdays 17:00–21:30, weekends 07:00–21:30) are abolished; bookable time is defined by service/shift types, nurse-declared availability, and the pricing definition of night hours.

---

## 1. Context & Business Intent

1. **Availability-Driven Scheduling:** Care is delivered by independent nurses who declare their own free time (FR-SCHED-01). A slot is bookable when a nurse's declared availability covers it and no conflicting booking exists — at any hour of the day.
2. **Night Work Is Priced, Not Prohibited:** Hours worked at night attract a surcharge instead of falling outside an operating window (FR-BOOK-01).

---

## 2. Rule Specifications

### 2.1 Bookable Service & Shift Types (SRS §1.2, §4.2)
- **Task-based bookings:** single procedures/services priced per time (`PER_TIME`).
- **Shift-based bookings:** **4h, 8h, 12h, and 24h** shifts, priced per hour or per shift per the service catalog (`service_categories.unit`).
- Long-term weekly/monthly contracts are **Phase 2** (FR-BOOK-04 / FR-BOOK-05) and are out of MVP scope.

### 2.2 Night Hours & Night Surcharge (FR-BOOK-01, §5.1)
- **Night hours are 22:00–06:00** (the following morning). Hours of a shift falling inside this window are charged a **+20% surcharge** (`SURCHARGE_NIGHT_SHIFT = 0.20`), calculated per hour segment **on the base price**; surcharges are additive on the base price, never compounded.
- *Worked example (FR-BOOK-01):* a shift 20:00–06:00 at 50,000 VNĐ/hour → base 500,000 VNĐ; the 8 night hours (22:00–06:00) add 80,000 VNĐ; total 580,000 VNĐ.
- A typical night shift therefore spans e.g. **20:00–06:00**, with only its 22:00–06:00 portion surcharged.

### 2.3 Booking Creation & Payment Window (SRS §2.2, §5.1)
- A new booking is created in `execution_status = DRAFT` and held for **15 minutes** awaiting payment (`PAYMENT_TIMEOUT_MINUTES = 15`).
- If payment is not completed within 15 minutes, the booking transitions to `EXPIRED` (§5.2 row 9).
- The 15-minute hold applies to **bank-transfer** bookings (escrow prepayment, FR-PAY-01); cash bookings are paid at the care location at shift end.

### 2.4 Urgency Classification & Matching Windows (FR-BOOK-03)
- **Urgent bookings** (shift starts within **≤ 6 hours**): matched by Radar Dispatch in radius waves (BR-08).
- **Advance bookings** (shift starts in **> 6 hours**): posted on the Job Board; a directly invited nurse has 15 minutes to respond before broadcast (BR-13).
- A booking that remains unclaimed **30 minutes before its start** (or after 30 minutes for urgent bookings) expires with a 100% refund (BR-01 §2.2).

### 2.5 Nurse Availability Windows (FR-SCHED-01)
- Nurses declare **recurring weekly free slots** (e.g., Mon–Fri 18:00–06:00, Sat–Sun all day) and **time-off blocks** (exceptions) in `nurse_availabilities` via Nurse Web/App (`PUT /api/v1/nurse/availabilities`).
- Effective availability = declared availability **minus** bookings in `CONFIRMED` / `IN_PROGRESS`, applying a **60-minute travel buffer** between consecutive shifts (BR-14 §2.5).
- Only nurses whose effective availability covers the requested slot enter matching or search results.

### 2.6 Open Items
- [Not specified in SRS v2.0 — open item] A distinct **T-24h matching trigger** for scheduled bookings is not defined in the SRS text; scheduled bookings are published on the Job Board per FR-BOOK-03 and expire 30 minutes before start (§2.4).
- [Not specified in SRS v2.0 — open item] Maximum advance-booking horizon, latest allowable shift start, and per-day shift caps (all present in the old baseline) are not specified in SRS v2.0.

---

## 3. Traceability & Dependencies

- **SRS References:** §1.2 (scope & shift types), §2.2 (DRAFT / EXPIRED), §4.2 FR-SCHED-01, §4.3 FR-BOOK-01 / FR-BOOK-03, §5.1 (`SURCHARGE_NIGHT_SHIFT`, `PAYMENT_TIMEOUT_MINUTES`), §5.2 row 9, §10 RTM TC-PRICE-01
- **API Endpoints:** `PUT /api/v1/nurse/availabilities`, `POST /api/v1/bookings`
- **Related Rules:** BR-06 (radar radius), BR-08 (matching engine), BR-13 (advance booking & extension), BR-14 (schedule conflicts)
