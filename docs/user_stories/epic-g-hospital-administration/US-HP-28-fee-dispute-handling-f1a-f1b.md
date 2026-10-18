# User Story US-HP-28: Fee-Line Complaint Handling — F1a/F1b Branches

> **Epic:** EPIC G — Hospital Administration & Dispatch  
> **Bounded Context:** `Hospital Operations`, `Payment & Deposit`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-28`
- **Story Title:** Fee-Line Complaint Handling — F1a/F1b Branches
- **Bounded Context:** `Hospital Operations`, `Payment & Deposit`
- **Primary Persona:** Hospital Administrator
- **Target Release:** Pilot Q-23 (Release 1)
- **Decision Dependency:** Default action following Platform Admin decision on branch F1b is noted in `use_case_v8.1` as *"Proposal – Pending PO Confirmation"*; story adheres strictly to baseline v8.1 specification until PO confirms otherwise.
- **Traceability:** BR-18 F1a/F1b · Q-44 · Activity Flows 08, 12

---

## 💡 Real-World Context & Problem Statement

1. **Differentiation between paid vs. unpaid disputed fee lines:**
   - **Branch F1a (Unpaid Fee Lines):** Patient disputes an unpaid fee item. If the hospital fails to adjudicate within the 5-day SLA, the fee line is auto-waived by the system.
   - **Branch F1b (Paid Fee Lines):** Patient disputes a previously paid fee item within 24 hours of payment. Approved refunds must be executed manually via UC90 accompanied by accounting vouchers—fee lines already collected are never automatically zeroed out in code.
2. **Preventing indefinite dispute deadlock:** Unresolved F1b hospital disputes escalate to Platform Admin arbitration.

---

## 📖 User Story Statement

> As a **Hospital Administrator**,  
> I want to adjudicate patient fee-line disputes categorized into Branch F1a (unpaid lines) and Branch F1b (paid lines) under strict SLA rules,  
> So that billing complaints are resolved equitably without indefinite balance freezing.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Branch F1a — Auto-Waiver of Overdue Unpaid Disputed Lines
- **Given** a disputed unpaid fee line,
- **When** the dispute exceeds the 5-day hospital adjudication SLA,
- **Then** the system automatically waives the fee line and logs the decision under business rule F1a.

### AC-02: Branch F1b — Manual Refund via UC90 for 24h Paid Line Disputes
- **Given** a paid fee line disputed within 24 hours of payment,
- **When** the Hospital Administrator approves the dispute,
- **Then** the refund is executed manually via UC90 with attached voucher references; the fee line is not silently zeroed out in database code.

### AC-03: Branch F1b — Overdue Escalation to Platform Admin
- **Given** an F1b complaint unresolved at the hospital past the review deadline,
- **When** the deadline expires,
- **Then** the case automatically escalates to Platform Admin for final ruling within 3 business days (US-HP-34).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP28-01` | F1a 5-day adjudication timeout | Functional / BR-18 | Unpaid fee line is automatically waived after 5 days |
| `TC-USHP28-02` | F1b approved refund voucher processing | Functional | Refund logged manually via UC90 with documentation |
| `TC-USHP28-03` | F1b timeout escalation to Platform Admin | Functional | Overdue complaint escalates to SaaS Platform Admin queue |
