# BR-02: Shift Cancellation & Major Operational Infractions

> **Group:** Group E — Violations, Disputes & Safety  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-37 (Excessive tardiness equivalence), Q-43 (24h auto-unlock for shift abandonment)  
> **Counter Separation:** Tracks major violations independently from BR-01 minor infractions.  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Protecting Clinical Shift Reliability:** Last-minute cancellations or abandoned visits leave patients without critical post-surgical care or clinical therapy.
2. **Fair Administrative Due Process:** Balance prompt protective suspensions with automated release safeguards (24h auto-unlock) to prevent indefinite, unjustified staff employment lockouts.

---

## 2. Rule Specifications

### 2.1 Lead-Time Penalty Tiers
$$	ext{Lead Time} = 	ext{Scheduled Appointment Time} - 	ext{Cancellation Timestamp}$$
*(For on-demand bookings, Lead Time is calculated against ETA; cancellation after deposit is always $< 1	ext{h}$).*

- **Lead Time $\ge 12	ext{ hours}$:** Audit log entry recorded; minor deduction to nurse reputation score.
- **$1	ext{ hour} \le 	ext{Lead Time} < 12	ext{ hours}$:** Reduced revenue share percentage applied to the nurse's **next 3 completed visits** (default: $-15$ percentage points, e.g., $80\% ightarrow 65\%$, configurable per hospital).
- **Lead Time $< 1	ext{ hour}$ or Shift Abandonment ("Bom ca"):** Immediate protective suspension from shift matching; incident escalated to Hospital Admin.

### 2.2 24-Hour Auto-Unlock for Shift Abandonment (Q-43)
- If a nurse is temporarily suspended due to shift abandonment ("Bom ca"), the lock **lifts automatically after 24 hours if Hospital Admin has not confirmed the penalty justification**.
- Investigation of the violation remains active in Flow 06 up to the 72-hour milestone (BR-18 F6). Both the initial suspension and the 24h auto-unlock event are logged in the nurse's compliance dossier.

### 2.3 Excessive Tardiness Escalation (Q-37)
- Arriving $> 	ext{ETA} + 15	ext{ minutes}$ while still completing care: Logged with reputation point deduction.
- **Arriving $> 	ext{ETA} + 30	ext{ minutes}$ or repeating tardiness 3 times in 30 days:** Treated as equivalent to a $1	ext{h}–12	ext{h}$ cancellation and added to the 3-strike counter below (Q-37); adjudicated post-visit in Flow 06.

### 2.4 Three-Strike Cumulative Policy
- A nurse may accumulate a maximum of **3 major violations within a 30-day rolling window**.
- **The 4th violation triggers indefinite matching suspension** and escalation to Hospital Admin for formal labor disciplinary proceedings (UC79).

### 2.5 Single Adjudication & Force Majeure Exemption
- Violations are evaluated **exactly once per order** during the Hospital Admin review step in Flow 06.
- If verified as **Force Majeure** (severe accident, verified medical emergency via UC88): Zero violation is recorded, and the temporary lock is lifted immediately.
- The platform enforces technical matching blocks and metrics only; labor termination and salary deductions remain strictly within hospital authority.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC72, UC77–UC79, UC88, UC116
- **Activity Flows:** Flow 06 (Replacement & Adjudication)
- **Governing Decisions:** Q-37, Q-43
