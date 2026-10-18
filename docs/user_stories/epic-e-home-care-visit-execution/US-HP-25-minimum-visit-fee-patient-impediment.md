# User Story US-HP-25: Minimum Home-Visit Fee When Service Cannot Be Performed Due to Patient

> **Epic:** EPIC E — Home Care Visit Execution  
> **Bounded Context:** `Care Session`, `Payment & Deposit`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-25`
- **Story Title:** Minimum Home-Visit Fee When Service Cannot Be Performed Due to Patient
- **Bounded Context:** `Care Session`, `Payment & Deposit`
- **Primary Persona:** Nurse, Hospital Admin
- **Target Release:** Pilot Q-23 (Release 1)
- **Decision Dependency:** **Decision Q-03 pending exact amount & fee structure**—technical mechanism implemented; value retrieved dynamically from hospital configuration upon PO/Accounting sign-off.
- **Traceability:** UC38 · BR-12, BR-18 F3 · Q-03 · Activity Flow 07A

---

## 💡 Real-World Context & Problem Statement

1. **Patient absence or refusal after nurse arrival:** When a nurse travels to the patient's residence but cannot execute clinical procedures due to patient absence or refusal, nurse travel time and transportation costs must still be compensated.
2. **Fair fee retention and deposit reconciliation:** The hospital charges a configured minimum home-visit fee deducted from the collected deposit, refunding any remaining balance to the patient.

---

## 📖 User Story Statement

> As a **Hospital Administrator or Dispatcher**,  
> When a nurse arrives on-site but services cannot proceed due to patient-side impediments, I want the system to charge the configured minimum home-visit fee and refund any surplus deposit,  
> So that nurse travel expenses are fairly covered while maintaining transparent accounting.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Minimum Visit Fee Assessment (BR-12 / BR-18 F3)
- **Given** a nurse on-site where service is impeded by patient-side causes (patient absent, refused entry),
- **When** the session is finalized under this category,
- **Then** the system deducts the hospital's configured minimum home-visit fee from the deposit.

### AC-02: Surplus Deposit Reconciliation & Automated Refund
- **Given** a collected deposit exceeding the minimum visit fee,
- **When** financial reconciliation runs,
- **Then** the minimum fee is retained by the hospital and the surplus balance is refunded to the patient.

### AC-03: Effective-Dated Fee Configuration (Q-03)
- **Given** hospital pricing configuration,
- **When** administrative rates for minimum visit fees are updated,
- **Then** new rates apply strictly to future incidents without retroactively modifying historical records.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP25-01` | Assess minimum fee on patient no-show | Functional | Minimum visit fee deducted; remainder refunded |
| `TC-USHP25-02` | Deposit equal to or less than minimum fee | Functional | Entire deposit retained; balance flagged per BR-18 |
| `TC-USHP25-03` | Audit trail of impediment closure | Compliance | Full logs, on-site timestamps, and reasons permanently saved |
