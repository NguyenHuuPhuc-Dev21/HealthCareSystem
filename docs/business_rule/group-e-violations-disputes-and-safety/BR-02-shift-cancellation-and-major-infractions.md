# BR-02: Shift Cancellation & Major Operational Infractions

> **Group:** Group E — Violations, Disputes & Safety  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** SRS §5.2 (all rows), §2.3 (nurse profile lifecycle), FR-RATE-01, FR-PAY-03, FR-ADMIN-01, FR-AUTH-02  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **Shift Reliability Is the Product:** A marketplace for home care lives or dies on confirmed shifts actually happening. SRS v2.0 therefore prices cancellations deterministically by notice window (SRS §5.2) and reserves its harshest sanction — an immediate permanent ban — for the no-show.
2. **Sanctions Are Account Sanctions, Not Employment Actions:** Nurses are independent marketplace participants, not hospital employees. All consequences in this rule are platform consequences: deposit fines (`PENALTY_DEDUCT`), TrustScore changes, and `profile_status` transitions (`ACTIVE` ⇄ `SUSPENDED` → `BANNED`) executed by the system or by Admin (FR-ADMIN-01). There are no HR/disciplinary processes in this model.

---

## 2. Rule Specifications

### 2.1 Nurse Cancellation Tiers (SRS §5.2 rows 6–7)

Δt = time between the cancellation and the scheduled shift start.

| Tier | Condition | Fine | TrustScore | System Handling |
| :--- | :--- | :--- | :--- | :--- |
| Early cancellation | Δt > 12h | None (no deposit deduction) | **−5** | Booking returns to `MATCHING` for re-dispatch |
| Late cancellation | Δt ≤ 12h | **20% of shift value**, deducted from the deposit wallet (`PENALTY_DEDUCT`); shortfall booked as debt against later income | **−20** | The full fine becomes an **Urgent Bonus** added to the booking and pushed into **SOS Dispatch** to attract a replacement nurse |

### 2.2 Nurse No-Show — BANNED on First Offence (SRS §5.2 row 8)

If 30 minutes after the scheduled start the nurse has not arrived **and** SOS Dispatch finds no replacement:

- The nurse's profile is **BANNED immediately — on the first no-show**, with no graduated ladder.
- A **50,000 VNĐ** fine (config `NO_SHOW_PENALTY`) is deducted from the deposit wallet (shortfall → debt) and converted in full into a **customer voucher**.
- The customer is refunded **100%** (transfer bookings).

### 2.3 Major Infractions → BANNED (SRS §2.3)

The following move a nurse profile to `BANNED` (permanent), executed/confirmed by Admin (FR-ADMIN-01) and audit-logged:

- **No-show** (§2.2 above).
- **Forged credentials** — fabricated degree, GPHN, or identity documents.
- **Serious professional-ethics violations.**

### 2.4 TrustScore Ladder & Suspension (FR-RATE-01, SRS §2.3)

- TrustScore starts at **100** (range 0–100). Deductions: **−5** early cancellation, **−20** late cancellation, **−25** violation upheld in a dispute (BR-11). Recovery: **+2** per settled shift rated ≥ 4 stars, capped at 100.
- **TrustScore < 60 → `profile_status = SUSPENDED`** automatically.
- Other automatic `SUSPENDED` triggers (financial, not violations): deposit balance below 300,000 VNĐ after a penalty deduction; cash-booking commission unpaid 24h after check-out (see R-L03).
- **Reinstatement (`SUSPENDED → ACTIVE`):** topping up the deposit / paying the outstanding commission / completing retraining, followed by Admin review and unlock (SRS §2.3).

### 2.5 Not an Infraction: GPHN Expiry (FR-AUTH-02, SRS §2.3)

A GPHN (practice license) that expires before the nurse updates it is **not** a violation and carries no fine: the system automatically **demotes** the nurse from `TIER_2_SPECIALIST` to `TIER_1_BASIC` (the profile stays `ACTIVE` for non-invasive work). Invasive bookings already `CONFIRMED` with a service date after the expiry date are auto-cancelled **without penalty** and re-dispatched. When the nurse uploads a renewed GPHN and Admin approves it, the tier is automatically restored to `TIER_2_SPECIALIST`.

### 2.6 Customer-Side Cancellations

Customer cancellations are priced by SRS §5.2 rows 1–3 (refund 100% / 80% / 50% by notice window) and row 5 (medical force majeure: penalty-free, plus the 50,000 VNĐ `ICU_TRAVEL_SUPPORT` for a nurse who already travelled). The full refund schedule is specified in BR-04 §2.4; customer misconduct (misreporting, fraud) is covered by BR-19.

### 2.7 Superseded Hospital-Baseline Mechanics & Open Items

The following hospital-baseline mechanics are **abolished**: the 3-strike cumulative policy, the 24-hour auto-unlock for abandonment (old Q-43), revenue-share percentage reductions on future visits, and tardiness-equivalence counting (old Q-37).

**Open items:** SRS v2.0 does not define (a) a force-majeure exemption from nurse cancellation penalties, or (b) a customer remedy for nurse lateness short of the 30-minute no-show threshold — both are **[Not specified in SRS v2.0 — open item]** (see BR-07 §2.3).

---

## 3. Traceability & Dependencies

- **SRS References:** SRS §5.2 rows 1–9, §2.3 (profile lifecycle & tier demotion), §5.1 (configs `NO_SHOW_PENALTY`, `ICU_TRAVEL_SUPPORT`, `MIN_NURSE_DEPOSIT`); FR-RATE-01, FR-PAY-03, FR-ADMIN-01, FR-AUTH-02
- **APIs:** `PATCH /api/v1/admin/nurses/:id/verify` (tier/status governance by Admin)
- **Related Rules:** BR-04 (refund schedule & deposit wallet), BR-18 (penalty mechanics), BR-07 (no-show detection at check-in), BR-11 (dispute-upheld violations), R-L03 (account status policy)
