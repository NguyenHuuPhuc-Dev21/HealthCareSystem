# BR-13: Advance Booking, Nurse Selection & Rescheduling

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-19 (Default consent on reassignment under review), Q-22 (Shift caps per day)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Structured Scheduling Lifecycle:** Give patients the autonomy to select preferred nurses while providing hospitals with clear scheduling foresight (up to 14 days).
2. **Equitable Workload & Disruption Protection:** Balance nurse shift distributions and provide automated reassignment workflows when nurses become unexpectedly unavailable.

---

## 2. Rule Specifications

### 2.1 Booking Horizon & Shift Declaration
- Advance bookings can be scheduled **earliest 2 hours and latest 14 days** prior to the visit slot.
- Nurses must publish their open schedule blocks 14 days in advance (UC114). Requests submitted less than 2 hours in advance must use the Fast Match engine (BR-08).

### 2.2 Transparent Selection & Privacy Boundaries
- Patients only view nurses with verified open slots during the chosen time window. Nurse profiles display only professional credentials (certifications, experience, rating).
- Communication is conducted strictly via in-app channels (UC133; no phone numbers, BR-20).

### 2.3 Nurse Response Window & Deposit Countdown
- An assigned nurse has **30 minutes** to respond to a designated appointment request (the slot is temporarily held).
- If the nurse declines or times out, no violation is recorded; the patient is notified to select another nurse.
- Once the nurse accepts, the patient has **15 minutes** to pay the 30% deposit (BR-04). Timeout cancels the order and releases the schedule slot.

### 2.4 Shift Volume Limits & Anti-Monopolization (Q-22)
- **Weekends & Holidays:** Maximum **4 shifts / nurse / day**.
- **Weekdays:** Maximum **2 shifts / nurse / day** (due to the 4.5-hour operational evening window).
- Recommendation algorithms interleave newer nurses to avoid order concentration.

### 2.5 Automated Reminder & Confirmation Milestones
- **T−24h:** Automated appointment reminder sent to patient and nurse.
- **T−3h:** Mandatory re-confirmation prompt sent to assigned nurse (deadline at T−2h). If unconfirmed by T−2h, automated replacement is triggered (Flow 06).
- **T−2h:** Optional invitation sent to patient to update medical symptoms (BR-15). This update is **not mandatory**; skipping it never cancels the appointment. If updated symptoms trigger emergency criteria, the shift is blocked and deposit refunded 100%.

### 2.6 Nurse Replacement Workflow (Flow 06)
- When a nurse reports inability to fulfill a visit:
  - Remaining time $> 1	ext{ hour}$: Search available calendar slots ($> 3	ext{h}$) or idle nurses ($\le 3	ext{h}$).
  - Remaining time $\le 1	ext{ hour}$: Route immediately to Fast Match.
  - Replacement must match required clinical competencies, operational radius, and patient gender preferences.
- Patient choices upon replacement notification:
  1. Accept replacement.
  2. Select another nurse.
  3. Reschedule slot.
  4. Cancel for **100% deposit refund**.
- Patient response window: 15 minutes (extended to 30 minutes if $> 3	ext{h}$ remain). Timeout defaults to acceptance (Q-19).
- If no replacement is found by T−1h, the system attempts Fast Match for 15 minutes; if still unfulfilled, the order cancels with 100% deposit refund.

### 2.7 Patient-Initiated Rescheduling Rules (Flow 09)
- Permitted strictly for advance bookings with paid deposit and submitted **$> 2	ext{ hours}$ before the scheduled visit**.
- Maximum **2 rescheduling requests per order**; deposit is transferred intact.
- If the current nurse is unavailable for the new slot, the patient selects a replacement; the existing booking is retained until the new nurse confirms.
- If $\le 2	ext{ hours}$ remain, rescheduling is prohibited; only cancellation per BR-04 is allowed.
- *Exception:* Rescheduling selected as a response to nurse replacement (Flow 06, UC117) is exempt from the 2-hour cutoff and does not consume the 2-time limit.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC37, UC45, UC78, UC88, UC112–UC120, UC133
- **Activity Flows:** Flow 04 (Booking), Flow 06 (Replacement), Flow 09 (Rescheduling & Cancellation)
- **Governing Decisions:** Q-19 (Reassignment acceptance timeout), Q-22 (Shift limits per day)
