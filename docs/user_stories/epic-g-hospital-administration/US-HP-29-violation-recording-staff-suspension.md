# User Story US-HP-29: Violation Recording, Adjudication & Staff Lock/Unlock

> **Epic:** EPIC G — Hospital Administration & Dispatch  
> **Bounded Context:** `Hospital Operations`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-29`
- **Story Title:** Violation Recording, Adjudication & Staff Lock/Unlock
- **Bounded Context:** `Hospital Operations`
- **Primary Persona:** Hospital Administrator
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** BR-01, BR-02 · Q-43 · BR-18 F6 · Activity Flow 12

---

## 💡 Real-World Context & Problem Statement

1. **Enforcing clinical and operational discipline:** If a nurse abandons a scheduled shift without authorization, the system must temporarily suspend them from the dispatch matching pool to protect patients.
2. **24-hour auto-unlock for unconfirmed shift abandonments:** If Hospital Administration does not confirm the penalty justification within 24 hours, the account is automatically unlocked to prevent wrongful employment lockout, while preserving violation logs.
3. **Platform separation of powers:** The software platform enforces technical matching blocks, but never unilaterally levies monetary fines or terminates employment on hospital staff.

---

## 📖 User Story Statement

> As a **Hospital Administrator**,  
> I want to review automated violation events, adjudicate staff penalties, and manage account locks/unlocks,  
> So that operational discipline is upheld while maintaining human administrative authority.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Immutable Timestamped Violation Event Logging
- **Given** an operational infraction under BR-01, BR-02, or BR-18 (e.g. shift abandonment),
- **When** captured by the system,
- **Then** the violation is recorded as an immutable event with timestamp and sliding window count (e.g. 3 violations in 30 days).

### AC-02: 24-Hour Auto-Unlock for Unconfirmed Temporary Suspensions
- **Given** a nurse account temporarily suspended for shift abandonment,
- **When** 24 hours elapse without Hospital Admin confirming the penalty justification,
- **Then** the system automatically lifts the temporary lock and logs both the lock and unlock events.

### AC-03: Platform Applies Technical Constraints Only
- **Given** any staff violation event,
- **When** processed by the system,
- **Then** the software enforces only configured technical constraints (matching suspension); disciplinary and financial penalties remain strictly with hospital administration.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP29-01` | Violation event & sliding window counter | Functional | Violation logged with timestamp; window counter updated |
| `TC-USHP29-02` | 24-hour auto-unlock for unconfirmed suspension | Functional | Account unlocked at 24:00 mark with complete audit trail |
| `TC-USHP29-03` | Admin manual adjudication of penalty | Functional | Admin confirms or dismisses penalty with documented notes |
