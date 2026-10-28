# BR-08: Matching Engine — Radar Dispatch & Job Board

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §4.2 (FR-SCHED-01, FR-SEARCH-01), §4.3 (FR-BOOK-03), §5.2, NFR-SEC-01  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Supersession Note:** SRS v2.0 defines **two explicitly separated matching mechanisms** instead of a single sequential-offer engine. Assignment is **first-come claim**, not sequential offering to a top-ranked nurse; matching is in MVP scope.

---

## 1. Context & Business Intent

1. **Speed for Urgent Care, Foresight for Planned Care:** Urgent requests need push-based dispatch within minutes; planned requests are better served by a broadcast board that nurses browse. Mixing the two degraded both, so FR-BOOK-03 separates them.
2. **Clinical Safety Before Speed:** No matching path may bypass tier gating, availability, or the deposit gate — eligibility filters are hard constraints evaluated before any push or listing.

---

## 2. Rule Specifications

### 2.1 Mechanism A — Radar Dispatch (Direct Radar Dispatch)
- **Applies to:** task-based bookings and urgent shifts starting within **≤ 6 hours**. `bookings.matching_mode = RADAR_DISPATCH`.
- **Wave 1 (minutes 0–5):** push notification to eligible nurses within **5 km** (BR-06).
- **Wave 2 (minutes 5–15):** if unclaimed, the push radius expands to **10 km**.
- **Claim rule:** the **first** eligible nurse to tap "Accept" is assigned. The claim is serialized with **Redis Lock / `SELECT FOR UPDATE`**; losing claims receive a "job already taken" result (NFR-SEC-01 race-condition controls also apply to all wallet-affecting APIs).

### 2.2 Mechanism B — Job Board Broadcast
- **Applies to:** advance bookings starting in **> 6 hours**. `bookings.matching_mode = JOB_BOARD`.
- The booking is listed on the **Job Board** tab of eligible nurses (Nurse Web/App) for first-come claim.
- **Direct request:** a Customer who selected a nurse via profile search (FR-SEARCH-01) sends the request to that nurse first; the nurse has **15 minutes to respond** before the booking is broadcast on the Job Board.

### 2.3 Hard Eligibility Filters (Both Mechanisms)
A nurse enters a push wave or sees a Job Board listing only if **all** hold:
1. `nurse_profiles.profile_status` = `ACTIVE` (single source of truth, BR-09 §2.8).
2. **Tier gate:** nurse tier ≥ the service's `required_tier`; invasive services (`is_invasive = true`) require `TIER_2_SPECIALIST` with a valid, in-scope GPHN (BR-09 §2.5, BR-21).
3. **Deposit gate:** `deposit_balance` ≥ 300,000 VNĐ (BR-14).
4. **Availability:** declared recurring availability covers the slot, no time-off block, and no schedule conflict (§2.4).
5. **Radius (Radar only):** nurse's current GPS position inside the active wave radius (BR-06).

### 2.4 Schedule-Conflict Protection (FR-SCHED-01)
- Overlapping bookings are prevented by a **schedule-conflict exclusion rule**: a nurse with a booking in `CONFIRMED` / `IN_PROGRESS` overlapping the candidate slot — including a **60-minute travel buffer** between consecutive shifts — is excluded from matching and from claiming.
- A nurse registered as off (time-off exception) never appears in matching results (RTM TC-MATCH-01).

### 2.5 Timeout & Replacement Behaviour
- Unmatched at the deadline (30 minutes before start; after 30 minutes for urgent bookings) → `EXPIRED`, 100% refund (BR-01 §2.2).
- When an assigned nurse cancels late (≤ 12h before start), the 20%-of-value penalty deducted from their deposit is added to the booking as an **Urgent Bonus** and the booking is pushed through **SOS Dispatch** to find a replacement (§5.2 row 7); an early cancellation returns the booking to `MATCHING` with no bonus (row 6).

### 2.6 Open Items
- [Not specified in SRS v2.0 — open item] A candidate ranking/scoring formula (the old baseline's priority score) is not defined; SRS v2.0 specifies eligibility filters, radius waves, and first-come claim only.
- [Not specified in SRS v2.0 — open item] Gender-preference matching and AI-assisted ranking (present in the old baseline) are not specified in SRS v2.0; profile search does expose a gender filter for Customers (FR-SEARCH-01) without making it an engine rule.

---

## 3. Traceability & Dependencies

- **SRS References:** §4.2 FR-SCHED-01 / FR-SEARCH-01, §4.3 FR-BOOK-03, §5.2 rows 6–9, §6 NFR-SEC-01, §7 (`bookings.matching_mode`, `nurse_availabilities`), §10 RTM TC-MATCH-01 / TC-MATCH-02
- **API Endpoints:** `PUT /api/v1/nurse/availabilities`, `GET /api/v1/nurses/search`
- **Related Rules:** BR-01 (assignment outcomes & TrustScore), BR-03 (urgency windows), BR-06 (radius), BR-14 (gates & conflicts)
