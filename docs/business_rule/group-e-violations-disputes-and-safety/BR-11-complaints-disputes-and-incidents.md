# BR-11: Complaints, Dispute Resolution & Incident Escalation

> **Group:** Group E — Violations, Disputes & Safety  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-17 (30-day complaint filing limit), Q-24 (Liability and insurance for home incidents), Q-32 (Rotational Admin appeals)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Structured Dispute Resolution:** Establish clear timeframes for patient grievances regarding clinical conduct or service quality.
2. **Neutral Multi-Tier Arbitration:** Prevent hospital conflicts of interest through independent secondary appeals and platform-level arbitration.

---

## 2. Rule Specifications

### 2.1 Complaint Submission Deadlines (Q-17)
- **Standard Filing Window:** Must be submitted within **30 days** of visit completion.
  - *Exception:* Fee-line billing disputes must be submitted within **24 hours** of invoice issuance (BR-04, F1a/F1b).
- Overdue non-serious complaints are rejected with written explanation.
- **Overdue Serious Complaints:** Complaints alleging patient safety violations, sexual harassment, physical violence, or clinical fraud are accepted regardless of expiration.

### 2.2 Hospital Adjudication SLAs
- Complaints regarding nurse conduct are transmitted **verbatim** to the hospital.
- **Hospital Adjudication SLA:** **3 business days**; reminder issued if unaddressed.
- If overdue $> 5	ext{ business days}$: The SaaS Platform Admin assumes jurisdiction, concluding within 3 business days and returning binding findings (BR-18 F3).

### 2.3 Serious Safety Incidents & Immediate Suspension
- If a complaint alleges serious misconduct or physical danger: The nurse's account is **temporarily suspended immediately**.
- Hospital Admin must review and confirm or lift the suspension within **4 hours**.

### 2.4 Independent Re-Adjudication / Appeals (Q-32)
- Each party (patient or nurse) is entitled to **one appeal**, submitted within 5 business days.
- **Strict Separation of Deciders:** The appeal arbiter must be independent of the first-instance decider:
  - *1st Ruling by Hospital Admin:* Appealed to SaaS Platform Admin.
  - *1st Ruling by Platform Admin (substituting for hospital):* Appealed to Chief Hospital Administrator.
  - *Platform Complaints (UC99):* Appealed to an independent rotational Platform Admin (Q-32).
- Overdue appeal review defaults to maintaining the initial ruling (BR-18 F4).

### 2.5 In-Home Physical Incidents (UC134, Q-24)
- Physical safety incidents occurring in the home are recorded as distinct emergency events and handled immediately under safety and police liaison protocols, completely decoupled from administrative complaint timelines.
- Ratings and reviews are optional; leaving a rating is never a prerequisite for filing a formal complaint.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC51–UC53, UC98–UC101, UC134
- **Activity Flows:** Flow 12 (Dispute Resolution & Complaints)
- **Governing Decisions:** Q-17, Q-24, Q-32
