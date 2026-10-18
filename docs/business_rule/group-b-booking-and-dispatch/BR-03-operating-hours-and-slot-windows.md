# BR-03: Operating Hours & Service Windows

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-22 (Operational windows and daily shift caps awaiting field validation)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Ensuring Service Delivery Feasibility:** Home-care dispatch operates primarily after standard hospital outpatient hours. Bookings scheduled outside operating hours promise unfulfillable clinical visits.
2. **Fatigue Management:** Clear shift limits protect visiting nurses from clinical fatigue during evening house calls.

---

## 2. Rule Specifications

### 2.1 Standard Operational Windows (Q-22)
- **Weekdays (Monday–Friday):** `17:00 – 21:30`.
- **Weekends & Public Holidays:** `07:00 – 21:30`.
- SaaS Platform Admin defines the outer platform boundary; hospitals configure specific operational schedules within this window.

### 2.2 Nurse "Available / Idle" State Restrictions
- Nurses can only toggle their status to "Available / Idle" (`Dang_ranh`) within active operational hours.
- At `21:30` daily, the system automatically shuts off the "Available" status for all nurses.

### 2.3 Booking Mode Availability
- **On-Demand / Instant Booking:** Permitted exclusively during operational hours.
- **Advance Booking:** Patients may book in advance at any time, but visit slots must fall strictly within valid operational hours.

### 2.4 Latest Service Appointment Start Time
- The latest allowable visit start time is calculated dynamically:  
  $$	ext{Latest Start Time} = 21:30 - 	ext{Service Duration}$$
- *Example:* A 90-minute wound care procedure must start no later than `20:00`.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC9, UC19, UC24, UC109
- **Activity Flows:** Flow 04 (Advance Booking), Flow 05 (On-Demand Dispatch)
- **Governing Decisions:** Q-22 (Operational schedule limits)
