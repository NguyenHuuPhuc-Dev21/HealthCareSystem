# BR-16: Mid-Session Abort & Early Termination

> **Group:** Group C — Care Visit Execution  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** FR-SHIFT-02, FR-SHIFT-04, FR-SHIFT-05, FR-DISP-01, FR-DISP-02, SRS §2.2, §5.2 rows 4–5  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **Early Endings Are Normal, Not Violations:** Shifts end early for benign reasons (a task-based service finishes ahead of schedule) and for serious ones (medical emergency, unsafe environment, a patient condition that was misreported at booking). SRS v2.0 settles benign early endings on the work actually done, **with no penalty percentage**, and routes contested endings through the dispute workflow — it does not use a partial-billing ratio table.
2. **No Partial-Settlement State in MVP:** In the MVP, an early-ended shift is closed as `COMPLETED` and settled in full under the rules below. `payment_status = PARTIALLY_SETTLED` exists **only** as an outcome of Phase-2 dispute adjudication (FR-DISP-02) and is never produced by an early termination itself.

---

## 2. Rule Specifications

### 2.1 Customer Stops the Shift After Check-In (SRS §5.2 row 4)

Applies when the booking is `IN_PROGRESS` and the customer asks to end early, not due to any fault of the nurse:

- The customer pays **100% of the price for the time actually worked**, with a **minimum billable time of 1 hour**.
- **Task-based services:** if all tasks of the service are completed in full, the **full service price** is payable even if the shift finishes earlier than scheduled (FR-SHIFT-04).
- **100% of the unused time is refunded** to the customer — transfer bookings only; a cash booking has no prepaid amount to refund.
- An early stop under this rule is **not** treated as a cancellation: no penalty applies to either side, and **no `PARTIALLY_SETTLED` state arises**.

### 2.2 Early Finish by Task Completion (FR-SHIFT-04)

When a task-based service is completed in full ahead of schedule, the nurse checks out normally (BR-22) and the booking is paid at the **full service price**. Finishing early by completing the work is a normal completion, never a penalized "mid-shift stop".

### 2.3 Condition Mismatch / Customer Misreporting (FR-SHIFT-02)

Within the first 30 minutes after check-in, the nurse verifies the patient's actual condition against the booking declaration (BR-07 §2.2). If the customer misreported the condition (e.g., bedridden or infectious status not declared — "khai gian tình trạng"):

- The nurse may **request a surcharge correction** (e.g., the heavy-patient surcharge `SURCHARGE_HEAVY_PATIENT = 15%` where the patient is ≥ 80 kg or `BEDRIDDEN`), **or**
- The nurse may **refuse/stop the shift with no penalty** (no deposit deduction, no TrustScore deduction).
- The event is flagged on the shift record (`shift_logs.condition_mismatch_reported = true`) and is an explicit dispute ground for both sides (FR-DISP-01; see BR-11, BR-19).
- The pay treatment of a shift refused at start-of-shift for misreporting (beyond the no-penalty guarantee) is **[Not specified in SRS v2.0 — open item]**.

### 2.4 Medical Emergency Stop (FR-SHIFT-05, SRS §5.2 row 5)

- If the patient deteriorates during the shift, the emergency protocol of BR-23 applies first (call 115, basic first aid, SOS alert); money handling never delays the response.
- Where the patient is transferred to emergency/ICU care or dies (with supporting documentation), the cancellation is **penalty-free**: **100% of unused amounts are refunded** (transfer bookings), and if the nurse has already travelled, the platform pays the nurse the fixed **50,000 VNĐ** travel support (config `ICU_TRAVEL_SUPPORT`) from the operations fund.

### 2.5 Nurse Safety Stop (Unsafe Environment)

A nurse who faces an unsafe environment leaves immediately and raises the SOS/Admin alert per BR-23. SRS v2.0 defines no separate automatic pay rule for a safety stop: the financial outcome is decided through the dispute workflow (FR-DISP-01) — `RESOLVED_NURSE` settles the booking in full to the nurse (see BR-11, BR-18). Any more specific automatic rule is **[Not specified in SRS v2.0 — open item]**.

### 2.6 What No Longer Exists (Superseded Hospital-Baseline Mechanics)

The following hospital-baseline mechanics are **abolished** and must not be implemented: per-item partial-billing ratios (50%/0% tables), the provisional fee freeze with Admin "maintain-or-reduce" review, linked child orders for the remainder of care, and any percentage penalty on the unused portion of an early-stopped shift.

> **Baseline inconsistency flagged:** The SRS §10 RTM acceptance text for TC-CANCEL-01 still mentions a "30% penalty on remaining hours" for an in-progress cancellation. This contradicts SRS §5.2 row 4 ("no penalty applies"), which is the governing policy and is what this rule follows. The RTM wording should be corrected — **[Open item]**.

---

## 3. Traceability & Dependencies

- **SRS References:** FR-SHIFT-02, FR-SHIFT-04, FR-SHIFT-05, FR-DISP-01, FR-DISP-02; SRS §2.2 (payment axis), §5.2 rows 4–5; configs `SURCHARGE_HEAVY_PATIENT`, `ICU_TRAVEL_SUPPORT`
- **APIs:** `POST /api/v1/bookings/:id/check-out`; `POST /api/v1/bookings/:id/disputes`
- **Related Rules:** BR-07 (check-in & first-30-minutes duties), BR-22 (check-out report), BR-23 (emergency protocol), BR-11 / BR-18 (dispute outcomes), BR-04 (refund schedule)
