# BR-22: Mandatory Clinical Care Report

> **Group:** Group C — Care Visit Execution  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-49 (Service-specific reporting forms and mandatory field specifications)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Longitudinal Medical Record Integrity:** Home nursing is an extension of hospital clinical care. Every visit must yield a structured, legally compliant care report.
2. **Universal Documentation Obligation:** Clinical reporting is non-negotiable. Even when patients submit no pre-visit symptoms, visiting nurses must thoroughly document the encounter.

---

## 2. Rule Specifications

### 2.1 Clinical Workflow Milestones
- **Visit Initiation:** Immediately following check-in, the nurse records baseline vital signs and physical observations using the standardized form designated for that service type.
- **In-Session:** Logs all clinical procedures, administered medications, materials, timestamps, and unexpected clinical events.
- **Distinct Status Milestones:**
  - `Concluded` (`Da_ket_thuc`): Nurse clicks "Conclude Session"; triggers immediate financial calculation.
  - `Completed` (`Hoan_tat`): Achieved **strictly when all mandatory report fields are validated**.
  - If mandatory fields are missing: Status is set to `Pending Report Completion` (`Cho_hoan_thien_bao_cao`). **No administrative exceptions exist** to mark a visit completed without a full report.

### 2.2 Reporting Escalation Timeouts
- **$> 2	ext{ hours}$ Overdue:** Automated notifications sent to the visiting nurse and Hospital Administrator.
- **$> 24	ext{ hours}$ Overdue:** The nurse's account is **temporarily suspended from receiving new shifts** until the report is fully filed.

### 2.3 Service-Specific Clinical Templates (Q-49)
- Reporting forms and mandatory field schemas are tailored per service type and signed off by the hospital clinical board (Q-49) (e.g., wound dimensions and exudate for wound care; infusion rate and volume for IV therapy).
- Report amendments require elevated authorization and generate audit logs recording the editor ID, timestamp, and clinical justification.
- Patient handovers (to replacement nurses, family members, or emergency 115 crews) must explicitly record handing-over and receiving parties and patient status at departure.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC41–UC44, UC127
- **Activity Flows:** Flow 07B (Visit Execution), Flow 15 (Early Termination)
- **Governing Decisions:** Q-49 (Clinical template schemas)
