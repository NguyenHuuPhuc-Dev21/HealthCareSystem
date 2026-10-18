# User Story US-HP-07: Symptom Entry & Four-Group Classification

> **Epic:** EPIC B — Patient Profile & Symptom Screening  
> **Bounded Context:** `Patient Profile & Screening`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-07`
- **Story Title:** Symptom Entry & Four-Group Classification
- **Bounded Context:** `Patient Profile & Screening`
- **Primary Persona:** Patient
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC21, UC22 · BR-15 · Activity Flow 04

---

## 💡 Real-World Context & Problem Statement

1. **Not all medical symptoms are safe for home nursing:** Admitting acute emergency patients to routine home-care dispatch creates severe life safety hazards and hospital liability.
2. **Subjective triage leads to inconsistent decisions:** The same symptom profile must consistently yield deterministic triage results tied to a traceable, versioned clinical rule set.

---

## 📖 User Story Statement

> As a **Patient**,  
> When booking an appointment, I want to input my current symptoms and receive a 4-tier triage classification with corresponding clinical guidance,  
> So that I know whether my case is accepted for home nursing, requires medical review, or demands emergency hospital admission.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Deterministic 4-Tier Classification with Versioned Rules
- **Given** an entered set of patient symptoms,
- **When** evaluated by the screening engine,
- **Then** the result maps strictly to one of 4 triage tiers, and the screening log records the applied `rule_version`.

### AC-02: Emergency Tier Blocks Standard Booking
- **Given** a screening result classified into the Emergency tier,
- **When** results are displayed,
- **Then** the system presents emergency instructions (calling 115 / SOS) and blocks continuation of the routine home-care booking flow.

### AC-03: Repeatable, Version-Controlled Screening Records
- **Given** an order with an existing screening result from initial booking,
- **When** the patient enters updated symptoms later (per US-HP-12),
- **Then** the system creates a new screening record linked to the order without overwriting or destroying historical records.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP07-01` | Evaluate 4-tier symptom triage | Functional | Test symptom sets map to expected tiers with recorded `rule_version` |
| `TC-USHP07-02` | Emergency symptom triage behavior | Functional / Safety | Emergency 115 guidance displayed; routine booking blocked |
| `TC-USHP07-03` | Repeat screening update | Functional | New screening record generated; prior record preserved intact |
