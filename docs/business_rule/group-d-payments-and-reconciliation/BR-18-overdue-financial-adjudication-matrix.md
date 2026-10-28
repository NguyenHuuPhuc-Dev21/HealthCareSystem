# BR-18: SLA Penalties & Financial Adjudication Outcomes

> **Group:** Group D — Payments, Refunds & Reconciliation  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** SRS §5.2 (SLA matrix), FR-DISP-01, FR-DISP-02, FR-PAY-02, FR-PAY-03, FR-RATE-01, SRS §2.2, §2.3  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version. **The F1a–F9 overdue adjudication matrix is abolished in full** (see §2.6).

---

## 1. Context & Business Intent

1. **Deterministic Outcomes, Human Adjudication:** In SRS v2.0 every financial consequence comes from exactly two sources: the **deterministic SLA matrix** (SRS §5.2), which fires automatically on objective events (who cancelled, when, who no-showed), and **Admin dispute adjudication** (FR-DISP-01), which decides contested facts. There is no third source.
2. **No Timeout-Default Decisions:** Unlike the hospital baseline, no financial outcome is ever decided by an administrator's silence. The only automatic money movements are the SLA matrix itself and the fixed timers of BR-04 (15-minute payment expiry; 24-hour settlement when no dispute exists).

---

## 2. Rule Specifications

### 2.1 SLA Penalty & Compensation Matrix (SRS §5.2)

Δt = time between the cancellation event and the scheduled shift start.

| # | Scenario | Money Outcome | TrustScore / Status |
| :--- | :--- | :--- | :--- |
| 1 | Customer cancels, Δt > 12h | 100% refund to customer | — |
| 2 | Customer cancels, 2h ≤ Δt ≤ 12h | 80% refund; 15% to nurse, 5% to platform | — |
| 3 | Customer cancels, Δt < 2h, not checked in | 50% refund; 40% to nurse, 10% to platform | — |
| 4 | Customer stops shift after check-in | Pay actual hours (min 1h); unused time refunded 100% (transfer only); **no penalty** | Not a cancellation (BR-16) |
| 5 | Customer cancels — medical force majeure (ICU/death, documented) | 100% refund of unused amounts; platform pays nurse 50,000 VNĐ travel support (`ICU_TRAVEL_SUPPORT`) if already travelled | No penalty |
| 6 | Nurse cancels, Δt > 12h | Customer made whole via re-matching (booking returns to `MATCHING`) | **−5 TrustScore**; no deposit fine |
| 7 | Nurse cancels, Δt ≤ 12h | **20% of shift value** deducted from deposit (`PENALTY_DEDUCT`); the full fine becomes an **Urgent Bonus** added to the booking and pushed into SOS Dispatch to attract a replacement | **−20 TrustScore** |
| 8 | Nurse no-show, no replacement found (30 min after start) | 100% refund (transfer); **50,000 VNĐ** deposit fine (`NO_SHOW_PENALTY`) converted in full into a customer voucher | **BANNED** immediately (BR-02) |
| 9 | Payment timeout (15 min) / matching timeout | Booking `EXPIRED`; 100% refund of any amount held | No penalty |

Refund rows apply to transfer bookings; for cash bookings no refund arises (nothing was prepaid), while nurse deposit fines in rows 7–8 still apply in full (SRS §5.2 applicability note).

### 2.2 Dispute Adjudication Outcomes (FR-DISP-01, FR-DISP-02)

While a dispute is `OPEN`, the booking's escrow is frozen and the settlement worker is blocked (BR-11). Admin adjudication (`dispute_status`) produces exactly these financial outcomes:

| Outcome | Money Effect | Notes |
| :--- | :--- | :--- |
| `RESOLVED_CUSTOMER` (customer upheld) | Transfer booking: **100% refund** (`payment_status = REFUNDED`). Cash booking: the penalty/compensation owed to the customer is deducted from the **nurse's deposit wallet** (no escrow exists to refund from) | Nurse: **−25 TrustScore** (upheld violation, FR-RATE-01) plus any deposit fine set by the ruling |
| `RESOLVED_NURSE` (nurse upheld) | Booking settles **100%** to the nurse (`payment_status = SETTLED`, 85/15 split per BR-04/BR-05) | Escrow freeze lifted |
| `RESOLVED_PARTIAL` — **Phase 2 only** (FR-DISP-02) | Admin enters a split ratio (e.g., 40% refund / 60% release); `payment_status = PARTIALLY_SETTLED` | **Not available in the MVP.** In MVP, partial outcomes arise only from the deterministic rows of §2.1 (e.g., row 4 actual-hours settlement), never from adjudication |

### 2.3 Penalty Deduction Mechanics (`PENALTY_DEDUCT`, FR-PAY-03)

- All SLA fines against a nurse (rows 7–8, dispute-imposed fines) are deducted from `deposit_balance` as `PENALTY_DEDUCT` transactions — the deposit wallet's **only** permitted use.
- **Shortfall → debt:** if the fine exceeds the deposit balance, the remainder is booked as debt and offset against the nurse's later income (SRS §5.2 row 7, FR-PAY-03).
- A deduction that leaves `deposit_balance < 300,000 VNĐ` locks the nurse out of new bookings (`SUSPENDED`) until topped up (BR-04 §2.2).

### 2.4 Commission Debt Is Not a Penalty (FR-PAY-02)

An unpaid cash-booking commission is a **debt to the platform**, handled completely separately from penalties: it is never taken from the deposit wallet or the available balance, it accrues no deposit deduction, and its only sanction is suspension from new bookings once **24 hours** have passed since check-out, lifted on payment (BR-05 §2.3).

### 2.5 TrustScore Effects (FR-RATE-01)

Financial adjudication interacts with the nurse's TrustScore as follows: starts at **100**; **−5** early cancellation (>12h); **−20** late cancellation (≤12h); **−25** violation upheld in a dispute; **+2** recovery per settled shift rated ≥ 4 stars (cap 100). **TrustScore < 60 → profile `SUSPENDED`** (see BR-02, R-L03).

### 2.6 Abolished: The F1a–F9 Overdue Matrix

The hospital baseline's overdue adjudication matrix (F1a–F9) — auto-waivers of unpaid fee lines, auto-approved refund exceptions, escalation ladders between Hospital Admin and Platform Admin, abuse-flag-dependent default reversals, and manual-refund workflows — **does not exist in SRS v2.0** and must not be implemented. SRS v2.0 contains no administrator-timeout default for any contested amount: a contested amount waits for an Admin ruling under FR-DISP-01, with escrow frozen in the meantime.

---

## 3. Traceability & Dependencies

- **SRS References:** SRS §5.2 (all rows), §5.1 (configs `NO_SHOW_PENALTY`, `ICU_TRAVEL_SUPPORT`, `MIN_NURSE_DEPOSIT`); FR-DISP-01, FR-DISP-02, FR-PAY-02, FR-PAY-03, FR-RATE-01; SRS §2.2 (dispute axis), §2.3
- **APIs:** `PATCH /api/v1/admin/disputes/:id/resolve`; `POST /api/v1/bookings/:id/disputes`
- **Related Rules:** BR-04 (settlement & refunds), BR-05 (commission), BR-02 (infractions & sanctions), BR-11 (dispute workflow), BR-16 (early-stop settlement)
