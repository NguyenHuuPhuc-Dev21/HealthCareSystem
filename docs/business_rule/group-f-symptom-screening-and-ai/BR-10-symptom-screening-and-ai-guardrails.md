# BR-10: Symptom Screening, 4-Tier Triage & AI Guardrails

> **Group:** Group F — Symptom Screening & AI  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-21 (Physician triage fallback SLA), Q-26 (AI accuracy validation criteria)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Clinical Decision Support, Not Autonomous Diagnosis:** Symptom screening assists clinical triage; it does not replace a licensed physician.
2. **Preventing Catastrophic Home Dispatch:** Patients exhibiting acute danger signs must be routed to emergency hospital facilities rather than home care.

---

## 2. Rule Specifications

### 2.1 Deterministic Four-Tier Triage Model
Symptom screening maps user-reported inputs strictly into one of four clinical tiers:
1. **Tier 1 (Routine / No Warning Indicators):** No warning signs identified from entered data; routine home-care booking proceeds.
2. **Tier 2 (Requires Early Clinical Evaluation):** Clinical indicators require review; an on-duty hospital physician contacts the patient prior to appointment confirmation.
3. **Tier 3 (Emergency Warning / Life-Threatening):** Routine home-care booking is **strictly blocked**; emergency instructions (dial 115) and the SOS trigger are presented (BR-23).
4. **Tier 4 (Inconclusive / Insufficient Information):** Follow-up clarifying questionnaire is prompted. If AI produces high uncertainty or errors, the case is routed to an on-duty physician.

### 2.2 Pre-Session Symptom Updates
- Advance booking patients are **not mandated to re-screen** before a visit.
- Patients may optionally submit updated symptoms up to **$T-1	ext{h}$** (UC119, UC22).
- Updated symptoms are evaluated under identical triage rules.
- **Safety Monotonicity:** Patients are permitted only to add symptoms; the system **never permits downgrading symptoms below danger thresholds**.

### 2.3 Screening Engine Timeout Fallback (Q-21)
- If the automated triage engine encounters an error or timeout during booking: An on-duty hospital physician must classify the symptoms within **10 minutes** (Q-21).
- If overdue: The patient is prompted to contact the hospital facility directly.

### 2.4 Post-Session Clinical Risk Analysis (Flow 13)
- For post-visit risk analytics: If the AI engine fails to return findings after **3 retries within 30 minutes**, or if the hospital disables AI:
  - The visit is treated as high clinical risk by default.
  - An attending physician reviews all care reports manually.

### 2.5 Strict AI Behavioral Guardrails & Prohibitions
AI functions strictly as an assistive calculation tool; legal medical accountability rests with hospital physicians (Q-26). **The AI engine is strictly prohibited from:**
1. Issuing a definitive medical diagnosis.
2. Prescribing drugs, altering dosages, or authorizing surgical procedures.
3. Approving staff credentials or certifying nurse practice qualifications.
4. Modifying physician-approved care plans.
5. Adjudicating financial settlements, refunds, or complaint disputes.
6. Accessing patient data outside authorized runtime scopes.
- **Display Transparency:** Every AI output must explicitly display its purpose, algorithmic limitations, confidence/uncertainty score, and an immediate link to human physician consultation.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC20–UC23, UC54, UC68, UC119
- **Activity Flows:** Flow 04 (Booking), Flow 07A (Screening), Flow 13 (Risk Analytics)
- **Governing Decisions:** Q-21, Q-26
