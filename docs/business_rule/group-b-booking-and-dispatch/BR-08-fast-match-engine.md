# BR-08: Fast Match Engine for On-Demand Bookings

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Scope Notice:** Fast matching is excluded from Pilot Q-23 (advance booking only); this rule defines future on-demand dispatch behavior.  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Automated Rapid Dispatch:** Eliminate manual dispatch delays by matching on-demand care requests with available nearby nurses in real time.
2. **Clinical Safety Safeguards:** Algorithmic speed must never compromise medical qualification standards or clinical order requirements.

---

## 2. Rule Specifications

### 2.1 Hard Eligibility Filters
The engine applies strict binary filters before ranking candidate nurses:
- Nurse status is actively toggled to "Available / Idle" (`Dang_ranh`).
- Belongs to the same hospital facility.
- Possesses verified clinical skill qualifications for the requested service.
- Patient address falls within geographic radius and feasible travel time.
- Matches patient gender preference and preferred nurse requests.
- If the service requires medical orders, the patient profile must have a validated, unexpired prescription on file (BR-15).

### 2.2 Candidate Ranking Algorithm
- Candidates passing all hard filters are ranked based on:
  1. Priority Score (incorporating attendance, punctuality, and violation history).
  2. Geographic Distance / Estimated Transit Time.
  3. Patient Review Rating.
- **AI serves only as a ranking assistant**; AI is strictly prohibited from overriding hard eligibility filters.

### 2.3 Sequential Assignment Protocol
- The system automatically offers the shift sequentially to the highest-ranked nurse, with a **5-minute window** to accept ("Order Accepted").
- **Total matching window is capped at $\le 15	ext{ minutes}$**.
- If no nurse accepts within 15 minutes, the system notifies the patient (UC87) and halts; the system **never transfers orders to other hospitals automatically**.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC24, UC25, UC30–UC33, UC37, UC85, UC87
- **Activity Flows:** Flow 05 (On-Demand Dispatch)
