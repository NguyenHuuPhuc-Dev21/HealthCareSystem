# User Story US-HP-15: Outstanding Balance & 24h "Pending Payment" State

> **Epic:** EPIC D — Deposit, Payment & Refund  
> **Bounded Context:** `Payment & Deposit`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-15`
- **Story Title:** Outstanding Balance & 24h "Chờ thanh toán" State
- **Bounded Context:** `Payment & Deposit`
- **Primary Persona:** Patient, Hospital Admin
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC17 · BR-10, BR-18 · Activity Flow 10

---

## 💡 Real-World Context & Problem Statement

1. **Final invoices must reflect on-site clinical reality:** The final balance equals total approved service charges and confirmed add-on supplies minus the prepaid deposit.
2. **24-hour settlement window before administrative action:** Patients must have 24 hours in "Pending Payment" (`CHO_THANH_TOAN`) status to review line items, file fee-line disputes if needed, or settle payment electronically before escalation.

---

## 📖 User Story Statement

> As a **Patient**,  
> I want to review my final itemized bill (reflecting deducted deposit and confirmed supplies) and have a 24-hour payment window,  
> So that I can verify service charges and pay the remaining balance with complete billing clarity.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Final Settlement Balance Calculation
- **Given** a concluded care session with submitted reports,
- **When** the system generates the post-visit invoice,
- **Then** the remaining balance due equals `Total Approved Charges - Deposit Paid`.

### AC-02: 24-Hour Settlement Lifecycle & Dispute Eligibility
- **Given** an issued post-visit invoice,
- **When** entering `CHO_THANH_TOAN` status,
- **Then** the patient has 24 hours to settle via the gateway or initiate a fee-line dispute (US-HP-28).

### AC-03: Post-24h Administrative Follow-up
- **Given** an outstanding invoice unpaid after 24 hours with no active dispute,
- **When** the timeout fires,
- **Then** the system notifies Hospital Administration for manual debt management per financial rule BR-18.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP15-01` | Compute final invoice balance | Functional | Correct balance after deducting deposit and adding confirmed items |
| `TC-USHP15-02` | 24-hour payment timeout | Functional | Escalates to Hospital Admin follow-up queue after 24 hours |
| `TC-USHP15-03` | Balance payment settlement | Functional | Invoice status moves to `DA_THANH_TOAN` upon gateway confirmation |
