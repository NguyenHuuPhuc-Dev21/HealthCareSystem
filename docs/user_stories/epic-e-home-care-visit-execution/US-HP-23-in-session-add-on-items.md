# User Story US-HP-23: In-Session Add-On Lines with Patient Confirmation

> **Epic:** EPIC E — Home Care Visit Execution  
> **Bounded Context:** `Care Session`, `Payment & Deposit`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-23`
- **Story Title:** In-Session Add-On Lines with Patient Confirmation
- **Bounded Context:** `Care Session`, `Payment & Deposit`
- **Primary Persona:** Nurse, Patient
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC35 · BR-10 · Activity Flow 07A

---

## 💡 Real-World Context & Problem Statement

1. **Unanticipated clinical needs arise on-site:** Additional wound dressing packs, antiseptic solutions, or secondary procedures often become medically necessary during the visit.
2. **Unilateral billing additions provoke dispute and fraud allegations:** Nurses must not be allowed to unilaterally inflate the bill; any in-session add-on line item must sit in "Pending Confirmation" (`CHO_XAC_NHAN`) until verified by the patient or family.

---

## 📖 User Story Statement

> As a **Nurse**,  
> I want to record in-session add-on medical supplies or ancillary services with mandatory patient in-app confirmation,  
> So that additional supplies used during care are billed transparently with mutual consent.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Propose Add-On Item in "Pending Confirmation" Status
- **Given** an active visit session,
- **When** the nurse adds a supply or ancillary service from the hospital price catalog,
- **Then** the line item is created with status `CHO_XAC_NHAN`.

### AC-02: Patient Direct In-App Confirmation
- **Given** an add-on item in `CHO_XAC_NHAN`,
- **When** the patient confirms the item in their mobile app (or verifies via on-site confirmation code),
- **Then** the line item transitions to `DA_XAC_NHAN` and is included in the final settlement invoice.

### AC-03: Exclusion of Unconfirmed Items from Invoice
- **Given** an item rejected by the patient or left unconfirmed,
- **When** the final session invoice is generated,
- **Then** the item is excluded from billing calculations and logged as discarded.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP23-01` | Nurse proposes add-on supply item | Functional | Line item created with status `CHO_XAC_NHAN` |
| `TC-USHP23-02` | Patient confirms add-on item | Functional | Item moves to `DA_XAC_NHAN` and is billed on final invoice |
| `TC-USHP23-03` | Patient declines add-on proposal | Functional | Item discarded and excluded from billing |
