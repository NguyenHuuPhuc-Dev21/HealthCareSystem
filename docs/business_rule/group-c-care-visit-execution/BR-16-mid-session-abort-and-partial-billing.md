# BR-16: Mid-Session Abort & Early Termination

> **Group:** Group C — Care Visit Execution  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-08 (Partial billing ratios), Q-35 (Default fee retention on timeout), Q-36 (Child orders), Q-40 (Minimum visit fee floor), Q-46 (Penalizing false unsafe declarations)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Clear Boundary Between Start and Abort:** Address unforeseen in-home events (medical emergencies, violence, intoxication, uncooperative patients) while preventing evasion of minimum visit costs.
2. **Equitable Partial Billing:** Calculate fees fairly based on completed procedural milestones while protecting visiting staff safety.

---

## 2. Rule Specifications

### 2.1 Scope of Mid-Session Abort (Q-40)
- Applies strictly when the nurse has **checked in, initiated care (UC41), and completed at least one procedure item**.
- If zero clinical items were performed (even if the nurse clicked "Start"): Treated as "Primary service infeasible" (Flow 07B/08); starting and immediately stopping does not bypass the minimum home-visit fee (Q-40).

### 2.2 Authorized Abort Initiators & Grounds
- **Nurse-Initiated:** Medical emergency, unsafe environment, uncooperative/hostile patient, or physical incapacity of the nurse.
- **Patient/Family-Initiated:** Request to cease treatment (confirmed via mobile app or in-app verification code).

### 2.3 Emergency vs. Unsafe Environment Protocols
- **Medical Emergency:** Nurse triggers SOS (UC92), dials 115, and remains with the patient providing first aid until emergency medical handover.
- **Unsafe Environment:** Nurse evacuates the premises immediately, triggers SOS from a safe distance, and notifies Hospital Dispatch.

### 2.4 Partial Item Billing Schedule (Q-08)
- **Completed Items:** Billed at **100%** of catalog price.
- **Incomplete / Disrupted Items:**
  - *Patient Request / Uncooperative:* Billed at **50%** of that item's price.
  - *Patient Clinical Incompatibility (Non-emergency):* Incomplete item billed at **0%**.
  - *Acute Medical Emergency (115):* Incomplete item billed at **0%**; **NO minimum home-visit fee charged** (hospital absorbs transit costs).
  - *Nurse / Hospital Fault:* Incomplete item billed at **0%**; patient offered a replacement nurse to complete remainder.
  - *Unsafe Environment for Nurse:* Incomplete item billed at **0%**; **NO minimum home-visit fee charged**.

### 2.5 Billing Execution & Hospital Review (Q-35, Q-46)
- The nurse must submit an emergency care report detailing the termination timestamp, justification, patient status, and handover details.
- Billing runs immediately upon session stop based on the nurse-selected reason; **for unsafe environment or emergency reasons, on-site payment collection is prohibited**—the patient confirms within 24 hours via gateway.
- Hospital Admin reviews the incident within **24 hours** (UC128) and is authorized **only to maintain or reduce** the provisional fee. Overdue review defaults to the provisional fee (BR-18 F9, Q-35).
- **Post-Audit on "Unsafe Environment" (Q-46):**
  - *Truthful Declaration:* No violation for nurse; patient evaluated for service blocking (Flow 12).
  - *Fraudulent Declaration:* **1 major violation recorded against nurse** (Q-46), escalated for disciplinary action.

### 2.6 Linked Child Orders for Remainder of Care (Q-36)
- If the patient requests a replacement nurse to complete interrupted procedures, the remainder is created as a linked **Child Order**:
  - Requires **zero advance deposit** (deposit settled in parent order).
  - Balance settled upon child order conclusion; cancellation generates no refund (Q-36).

---

## 3. Traceability & Dependencies

- **Use Cases:** UC41, UC43, UC92, UC127, UC128
- **Activity Flows:** Flow 15 (Mid-Session Termination), Flow 06 (Replacement), Flow 08 (Billing & Settlement)
- **Governing Decisions:** Q-08, Q-35, Q-36, Q-40, Q-46
