# BR-19: Patient Abuse Flagging & Anti-Gaming Controls

> **Group:** Group E — Violations, Disputes & Safety  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-42 (Counting unverified auto-waivers toward abuse score)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Protecting System Integrity from Opportunistic Exploitation:** Prevent malicious users from exploiting automated timeout waivers (BR-18) by filing habitual bad-faith disputes.
2. **Proportional Regulatory Impact:** Ensure abuse flags alter dispute adjudication fallbacks without denying patients access to essential healthcare bookings.

---

## 2. Rule Specifications

### 2.1 Abuse Metric Formulation (90-Day Rolling Window)
An account's abuse score accumulates occurrences across three categories over a 90-day rolling window:
$$	ext{Abuse Score} = N_{	ext{billing disputes}} + N_{	ext{refund exception requests}} + N_{	ext{unfounded complaints}}$$
- Amounts automatically waived or approved due to Hospital Admin timeout (F1a, F2) **are counted toward the abuse score** because they represent unverified financial write-offs (Q-42).

### 2.2 Flagging Threshold & Automated Clearance
- **Threshold:** $	ext{Abuse Score} \ge 2 ightarrow$ Account is assigned an **Abuse Flag** (`Co_lam_dung`).
- **Automated Removal:** The flag is lifted automatically when historical events age past the 90-day window, reducing the score to $< 2$. Platform Admin may clear the flag manually with documented justification.

### 2.3 Transparent Notification & Rebuttal Rights
- The account owner receives an automated notification upon being flagged, explaining the grounds and detailing an appeal rebuttal window of **7 days** to submit evidence to Platform Admin.

### 2.4 Functional Scope of Abuse Flag (BR-18 Interaction)
- **The flag ONLY modifies the fallback rules for expired administrative timeouts under BR-18**:
  - For standard patients, timeouts default in favor of the patient.
  - For flagged patients, timeouts escalate to Platform Admin or default to maintaining charges in favor of the hospital/nurse.
- **Strict Boundaries:**
  - The abuse flag **never blocks routine appointment bookings**.
  - The abuse flag is **never displayed to visiting nurses** to prevent clinical bias during care.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC36, UC51, UC93
- **Activity Flows:** Flow 08 (Billing), Flow 09 (Refunds), Flow 12 (Disputes)
- **Governing Decisions:** Q-42 (Abuse scoring metrics)
