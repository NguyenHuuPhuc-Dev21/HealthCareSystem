# BR-07: Departure, Geofenced Check-In & Shift Abandonment

> **Group:** Group C — Care Visit Execution  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-43 (24h auto-unlock for unconfirmed shift abandonment)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Physical Presence Verification:** Home visits require verified proof of on-site arrival to prevent fraud and ensure patient safety.
2. **Preventing Shift Abandonment ("Bom ca"):** Nurses who fail to depart or disappear without notice leave vulnerable patients unattended and must face swift administrative safeguards.

---

## 2. Rule Specifications

### 2.1 Departure Deadlines & ETA Computation
- **Mandatory Departure Deadline ($T_{	ext{depart}}$):**
  - *Advance Booking:* Scheduled Appointment Time minus Estimated Travel Duration (calculated dynamically at $T-1	ext{h}$).
  - *On-Demand Booking:* Deposit completion timestamp $+ 10	ext{ minutes}$.
  - *Following Reassignment:* Assignment acceptance timestamp $+ 10	ext{ minutes}$.
- **Estimated Time of Arrival (ETA):**
  $$	ext{ETA} = T_{	ext{depart}} + 	ext{Estimated Travel Duration}$$

### 2.2 Dual-Factor Valid Check-In
A check-in is legally valid if and only if **both conditions** are verified:
1. **Geofence Proximity:** Nurse device GPS coordinates are within the configured geofence radius of the patient's care address.
2. **Dynamic In-App Code:** The nurse enters the dynamic verification code displayed in real time on the patient's mobile app (BR-20).

**Contingency Check-In (Technical Failure):**
- In the event of GPS or network failure: Nurse captures a timestamped photo on-site, the patient confirms directly in their mobile app, and Hospital Admin conducts a post-audit within 24 hours.

### 2.3 Nurse Tardiness Protocols
- If the nurse has not checked in by **$	ext{ETA} + 15	ext{ minutes}$**, the patient is offered three choices:
  1. **Wait:** Extend wait time (maximum 2 extensions $	imes 15	ext{ minutes}$).
  2. **Request Replacement Nurse:** Trigger immediate fast reassignment (Flow 06).
  3. **Cancel:** Immediate cancellation with **100% deposit refund**.

### 2.4 Shift Abandonment ("Bom ca") & 24h Auto-Unlock (Q-43)
- An assignment is classified as **Shift Abandonment ("Bom ca")** if:
  - The nurse has not started moving 10 minutes past $T_{	ext{depart}}$, OR
  - Background location sharing is disabled for $> 10	ext{ minutes}$ after departure.
- **Immediate System Enforcement:**
  - Shift matching privileges are **temporarily suspended immediately**.
  - Order is routed to reassignment (Flow 06).
  - **Automated 24-Hour Auto-Unlock:** If Hospital Admin fails to confirm the penalty justification within 24 hours, the account lock is automatically lifted (BR-02, Q-43); formal violation review continues until the 72-hour milestone (BR-18 F6).

### 2.5 Patient Absence on Arrival
- If the nurse arrives on-site within geofence, but the patient/family is absent and unreachable for **15 minutes**, the nurse reports absence via UC89.
- **Zero violation is logged against the nurse**; the patient forfeits the visit fee per BR-04.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC38, UC40, UC77, UC89
- **Activity Flows:** Flow 06 (Replacement), Flow 07A (Check-In), Flow 07B (Visit Execution)
- **Technical Note:** Governs background location tracking and geofencing architecture in the Nurse Mobile App.
