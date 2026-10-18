# BR-21: Two-Step Staff Profile Credentialing & Verification

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-50 (Staff profile lifecycle states finalized)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Clear Division of Legal Liability:** In a multi-tenant hospital SaaS platform, the hospital is legally responsible for medical practitioner licensing and clinical qualifications. The SaaS platform validates administrative and procedural completeness without asserting medical accreditation.
2. **Preventing Unqualified Dispatch:** Medical staff must satisfy rigorous professional credentialing and two-step verification before appearing in any automated dispatch matching pool.

---

## 2. Rule Specifications

### 2.1 Staff Profile Lifecycle State Machine (Q-50)
Every healthcare staff profile progresses through a defined, immutable state machine:
- `Draft` (`Ban_nhap`)
- `Pending Hospital Confirmation` (`Cho_BV_xac_nhan`)
- `Pending Platform Approval` (`Cho_nen_tang_duyet`)
- `Approved` (`Da_duyet`)

**Auxiliary and Exception States:**
- `Requires Supplemental Information` (`Yeu_cau_bo_sung`): 7-day SLA for staff to submit required documents. If overdue, transitions to `Expired` (`Het_han`).
- `Rejected` (`Bi_tu_choi`): Staff member can revise and submit as a new profile version.
- **Active Operational States:** Once approved, accounts can transition to:
  - `Active` (`Hoat_dong`)
  - `Temporarily Suspended` (`Tam_khoa`)
  - `Practice License Expired` (`Het_han_CCHN`)
  - `Deactivated` (`Ngung_hoat_dong`)

### 2.2 Two-Step Credentialing Protocol
- **Step 1 (Hospital Medical Confirmation):** The hospital verifies medical qualifications, diplomas, and the Certificate of Practice (CCHN), assuming full clinical and legal liability (UC139).
- **Step 2 (Platform Administrative Review):** The SaaS Platform Administrator inspects procedural completeness, mandatory data fields, and operational platform criteria (UC7, UC12). The SaaS platform **does not certify or warrant** medical license validity.

### 2.3 Strict Dispatch Eligibility Prerequisites
A nurse or doctor is eligible to accept shifts or on-duty assignments if and only if **all five criteria** are concurrently satisfied:
1. Profile state is `Approved` (`Da_duyet`).
2. Account is `Active` (`Hoat_dong`).
3. Mandatory Two-Factor Authentication (2FA) is activated.
4. Practice License (CCHN) is active and unexpired.
5. Profile is not under temporary suspension (`Tam_khoa`).

### 2.4 Daily Automated Practice License (CCHN) Scanning
- A background scheduler scans staff practice license expiration dates daily at 00:00.
- Automatic reminders are sent **30 days prior** to license expiration.
- Upon reaching the expiration timestamp, the system automatically revokes shift acceptance privileges and updates the profile state to `Het_han_CCHN`.

### 2.5 Audit Logging & Prohibited AI Involvement
- All state changes are recorded in an append-only audit trail capturing: operator ID, role, timestamp, old state, new state, profile version, and explicit justification notes.
- **AI is strictly prohibited** from approving staff profiles or assessing whether a nurse is qualified to practice.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC5–UC8, UC10–UC12, UC69, UC81, UC139
- **Activity Flows:** Flow 01 (Staff Lifecycle & Credentialing)
- **Governing Decisions:** Q-50 (Lifecycle state machine definitions)
