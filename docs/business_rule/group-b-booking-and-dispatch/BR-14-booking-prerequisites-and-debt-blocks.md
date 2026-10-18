# BR-14: Booking Prerequisites & Debt Restrictions

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Credit Risk & Bad Debt Containment:** Accounts with unpaid invoices beyond the 24-hour settlement window must be prevented from accumulating additional hospital debt.
2. **Hoarding & Schedule Conflict Prevention:** Prevent users from monopolizing multiple slots and ensure individual care recipients do not have overlapping visit schedules.

---

## 2. Rule Specifications

### 2.1 Outstanding Debt Lock (`Cong_no`)
- If an account has any order remaining in "Pending Payment" (`Cho_thanh_toan`) exceeding **24 hours** without an active dispute, the account is placed in **"Outstanding Debt" (`Cong_no`)** status (BR-04).
- An account in `Cong_no` is **strictly blocked from creating new booking orders for ALL profiles** under that account until the balance is fully settled via the payment gateway.

### 2.2 Maximum Active Bookings Cap
- A single care recipient profile can hold a maximum of **3 active uncompleted bookings** simultaneously (configurable per hospital).

### 2.3 Strict Schedule Collision Buffer
- The system prohibits overlapping appointments for the same patient profile.
- Buffer collision window:
  $$	ext{Blocked Window} = [	ext{Start Time}, 	ext{Start Time} + 	ext{Service Duration} + 30	ext{ minutes buffer}]$$

### 2.4 Child Orders Exemption (BR-16)
- Ancillary "child orders" generated to finish incomplete care following a mid-session abort (BR-16):
  - Do NOT count against the 3-booking cap.
  - Are permitted to overlap the parent order schedule.
  - Require no advance deposit.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC18, UC19, UC120
- **Activity Flows:** Flow 04 (Advance Booking), Flow 05 (On-Demand Dispatch), Flow 09 (Rescheduling)
