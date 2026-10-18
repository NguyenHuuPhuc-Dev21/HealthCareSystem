# BR-01: Auto-Assignment Order Confirmation & Minor Infractions

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-05 (Hospital labor relation confirmation), Q-29 (Violation thresholds), Q-41/Q-45 (Cancellation after acceptance)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Accountability for On-Demand Availability:** When a nurse toggles "Available / Idle", they signal immediate field readiness. Ignoring or dropping auto-assignments disrupts patient dispatch.
2. **Proportional Minor Sanctions:** Provide gradual corrective measures (cooldowns, priority deductions) without imposing unilateral financial penalties on hospital staff.

---

## 2. Rule Specifications

### 2.1 Mandatory Acceptance for Idle Nurses
- For on-demand orders, **there is no rejection button**: keeping status set to "Available" implies clinical availability; assignments are automatic.
- The nurse has **5 minutes** to click "Order Accepted" (`Da_nhan_don`).
- If timeout expires: the assignment is revoked, "Available" status is automatically switched off, and the system re-assigns the shift to the next candidate.

### 2.2 Cancellation During Deposit Window (Q-41, Q-45)
- If a nurse clicks "Order Accepted" and then cancels within 5 minutes (while the patient is completing their deposit payment):
  - **1 violation is recorded immediately** (Q-41).
  - The deposit countdown timer is aborted, and a **new 15-minute matching round is opened** for the patient (Q-45).

### 2.3 Escalation for Unconfirmed Assignments (Q-29)
- **1st Unconfirmed Timeout:** Recorded as a warning; no formal violation logged.
- **Repeated 3 Times in a 30-Day Rolling Window:**
  - 1 formal minor violation recorded.
  - Unconfirmed counter reset to 0.
  - **20% deduction in dispatch priority score** for 30 days.
- **Escalation Thresholds:**
  - **2 violations / 30 days:** 24-hour suspension from receiving on-demand assignments.
  - **$\ge 3$ violations / 30 days:** Account locked from on-demand orders and dossier escalated to Hospital Admin (Q-29).

### 2.4 Exemption for Advance Booking Inquiries
- For advance booking requests (UC115), declining or letting the 30-minute response window lapse **does NOT count as a violation**; response rates are tracked only for ranking analytics.

### 2.5 Strict Zero Financial Penalty Rule (Q-05)
- The platform **never levies monetary fines** on nurses.
- The auto-assignment dispatch model requires prior hospital confirmation regarding local labor law compliance (Q-05).

---

## 3. Traceability & Dependencies

- **Use Cases:** UC31–UC33, UC115
- **Activity Flows:** Flow 05 (On-Demand Dispatch), Flow 06 (Nurse Replacement & Violations)
- **Governing Decisions:** Q-05 (Labor compliance), Q-29 (Escalation thresholds), Q-41, Q-45
