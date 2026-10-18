# User Story US-HP-34: Platform Admin Decision on Escalated F1b Complaints

> **Epic:** EPIC H — SaaS Platform Administration  
> **Bounded Context:** `Platform Administration`, `Payment & Deposit`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-34`
- **Story Title:** Platform Admin Decision on Escalated F1b Complaints
- **Bounded Context:** `Platform Administration`, `Payment & Deposit`
- **Primary Persona:** Platform Admin
- **Target Release:** Pilot Q-23 (Release 1)
- **Decision Dependency:** Default rule if Platform Admin does not rule within deadline is currently noted in `use_case_v8.1` as *"Proposal – Pending PO Confirmation"*; story captures this open point without inventing arbitrary code defaults.
- **Traceability:** BR-18 F1b · Q-44

---

## 💡 Real-World Context & Problem Statement

1. **Deadlocks between hospital administration and patients:** When a hospital fails to resolve a paid fee dispute within SLA, the multi-tenant SaaS Platform Admin acts as the ultimate neutral arbiter.
2. **Comprehensive audit dossier required for arbitration:** The Platform Admin requires full access to booking logs, timestamps, care reports, and prior hospital correspondence to make a binding ruling.

---

## 📖 User Story Statement

> As a **SaaS Platform Admin**,  
> I want to adjudicate escalated F1b billing disputes within 3 business days with access to full historical dossiers,  
> So that cross-tenant financial conflicts are resolved definitively and transparently.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Complete Escalation Context Dossier
- **Given** an F1b complaint overdue at the hospital (US-HP-28),
- **When** escalated to Platform Admin,
- **Then** the dossier contains the itemized fee line, dispute history, timestamps, care reports, and previous hospital administrative notes.

### AC-02: 3-Business-Day Ruling SLA with Recorded Rationale
- **Given** a valid escalated complaint,
- **When** the Platform Admin renders an arbitration ruling,
- **Then** the decision is issued within 3 business days, recording the decider identity, rationale, and governing rule in the audit log.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP34-01` | Review escalated dispute dossier | Functional | Full historical timestamps, care reports, and notes available |
| `TC-USHP34-02` | Issue binding arbitration ruling | Functional | Ruling rendered within 3 business days with full audit log |
