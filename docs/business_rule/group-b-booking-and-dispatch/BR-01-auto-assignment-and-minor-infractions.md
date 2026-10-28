# BR-01: Matching, Assignment & Minor Infractions

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §2.3, §4.3 (FR-BOOK-03), §4.6 (FR-RATE-01), §5.2  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Supersession Note:** The old model (mandatory acceptance for idle nurses, 5-minute confirm SLA, 3-strike counters, zero platform fines) is replaced in full. In SRS v2.0 nurses **claim jobs voluntarily** (first-come), and infractions are handled through **TrustScore** and the SLA penalty matrix — including monetary penalties deducted from the deposit wallet.

---

## 1. Context & Business Intent

1. **Two Distinct Assignment Paths:** SRS v2.0 separates matching into **Radar Dispatch** for urgent work and the **Job Board** for advance bookings (FR-BOOK-03). A third path, **Direct selection**, lets a Customer invite a specific nurse from search results (FR-SEARCH-01). Engine mechanics are specified in BR-08; this rule covers assignment outcomes and the consequences of minor infractions.
2. **Reputation-Driven Discipline:** Instead of strike counters, the platform maintains a **TrustScore** (0–100) per nurse. Infractions deduct points; good performance restores them; crossing the threshold suspends the profile (FR-RATE-01, §2.3).

---

## 2. Rule Specifications

### 2.1 Assignment Paths (FR-BOOK-03)
- **Radar Dispatch (urgent — shift starts within ≤ 6 hours):** the system pushes the booking to eligible nurses in radius waves — **wave 1: 5 km during minutes 0–5; wave 2: radius expands to 10 km during minutes 5–15**. The **first nurse to claim** wins the booking, protected by Redis Lock / `SELECT FOR UPDATE` so exactly one nurse is assigned (BR-08).
- **Job Board (advance — shift starts in > 6 hours):** the booking is posted on the Job Board tab for all eligible nurses to claim, first-come.
- **Direct selection:** the Customer picks a nurse from profile search (FR-SEARCH-01) and sends a direct request; that nurse has **15 minutes to respond** before the booking is broadcast on the Job Board.
- **Deposit gate (all paths):** a nurse may claim/accept only if `deposit_balance` ≥ 300,000 VNĐ (BR-14).

### 2.2 Matching Timeout
- If no nurse has claimed the booking **30 minutes before the shift start** (or **after 30 minutes** for urgent bookings), the booking transitions to `execution_status = EXPIRED` and bank-transfer payments are refunded 100% (`payment_status = REFUNDED`) (FR-BOOK-03, §5.2 row 9).

### 2.3 TrustScore — Minor Infraction Handling (FR-RATE-01)
- TrustScore starts at **100** (range 0–100).
- **Deductions:**
  - Nurse cancels a booking **> 12 hours** before shift start: **−5 points**, no monetary penalty; the booking returns to `MATCHING` for replacement (§5.2 row 6).
  - Nurse cancels **≤ 12 hours** before shift start: **−20 points**, plus a monetary penalty of **20% of the booking value** deducted from the deposit wallet (the penalty becomes an Urgent Bonus for the replacement search) (§5.2 row 7).
  - A customer complaint is upheld against the nurse (dispute `RESOLVED_CUSTOMER`): **−25 points** (and deposit penalty per FR-DISP-01).
- **Recovery:** each completed job that reaches `SETTLED` with a rating ≥ 4 stars restores **+2 points**, capped at 100.
- **Threshold:** TrustScore **< 60** → the profile is automatically set to `SUSPENDED` (§2.3).

### 2.4 Major Infractions (Cross-Reference)
- **No-show** (nurse absent 30 minutes after shift start with no replacement found): the account is **BANNED immediately on the first offence**, plus a 50,000 VNĐ penalty (`NO_SHOW_PENALTY`) converted into a customer voucher (§5.2 row 8). No-show is a major infraction, not a TrustScore matter.
- Forged credentials and serious ethics violations also lead to `BANNED` (BR-21 §2.4).

### 2.5 Open Items
- [Not specified in SRS v2.0 — open item] A ranking formula *within* a radar wave (e.g., ordering push notifications by distance, then TrustScore, then availability) is not defined by SRS v2.0; within a wave, the first claim decides (§2.1).
- [Not specified in SRS v2.0 — open item] Consequences for a nurse who repeatedly ignores radar pushes or lets direct requests lapse (the old baseline's unconfirmed-assignment counters) are not specified; only cancellations after acceptance carry TrustScore deductions.

---

## 3. Traceability & Dependencies

- **SRS References:** §2.3 (profile lifecycle & TrustScore suspension), §4.2 FR-SEARCH-01, §4.3 FR-BOOK-03, §4.6 FR-RATE-01 / FR-DISP-01, §5.1 (`MIN_NURSE_DEPOSIT`, `NO_SHOW_PENALTY`), §5.2 rows 6–9, §10 RTM TC-MATCH-01 / TC-MATCH-02 / TC-RATE-01
- **Related Rules:** BR-08 (matching engine mechanics), BR-14 (deposit gate & blocks), BR-21 (profile lifecycle)
