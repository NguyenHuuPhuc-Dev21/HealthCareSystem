# User Story US-HP-24: Unsafe-Environment Session Stop Declaration

> **Epic:** EPIC E — Home Care Visit Execution  
> **Bounded Context:** `Care Session`, `Hospital Operations`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-24`
- **Story Title:** Unsafe-Environment Session Stop Declaration
- **Bounded Context:** `Care Session`, `Hospital Operations`
- **Primary Persona:** Nurse
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC37 · BR-11 · Activity Flow 07A

---

## 💡 Real-World Context & Problem Statement

1. **Healthcare personnel safety in private homes:** Hostility, verbal/physical abuse, intoxicated household members, infectious biohazards, or dangerous animals jeopardize nurse safety.
2. **Immediate abort without penalization:** Nurses must have an unhindered mechanism to abort the session immediately, record justification, and trigger hospital dispatch intervention without fear of automated penalty.

---

## 📖 User Story Statement

> As a **Nurse**,  
> I want to immediately abort a home-care session if I encounter a hostile or unsafe environment and document the justification,  
> So that my personal safety is safeguarded and hospital leadership is instantly mobilized.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Immediate Session Stop Execution
- **Given** an active visit session,
- **When** the nurse triggers the safety abort action,
- **Then** the visit immediately halts and transitions to "Stopped Due to Safety" (`DA_DUNG_VI_AN_TOAN`).

### AC-02: Mandatory Safety Incident Justification & Dispatch Notification
- **Given** a safety abort trigger,
- **When** submitted,
- **Then** the nurse enters an incident summary, and the system instantly dispatches an urgent alert to Hospital Dispatch.

### AC-03: Financial Freeze Pending Investigation
- **Given** a session halted for safety,
- **When** the visit is closed,
- **Then** all financial settlements and deposit forfeitures are frozen pending administrative investigation.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP24-01` | Execute safety abort action | Functional / Safety | Session halts immediately; status marked `DA_DUNG_VI_AN_TOAN` |
| `TC-USHP24-02` | Urgent dispatch alert notification | Functional | High-priority safety incident delivered to Hospital Dispatch |
| `TC-USHP24-03` | Financial settlement hold | Functional | Invoice generation frozen pending administrative review |
