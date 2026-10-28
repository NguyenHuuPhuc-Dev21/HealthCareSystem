# User Story US-HP-07: Customer Declares the Care Recipient's Condition at Booking

> **Epic:** EPIC B — Patient Profile & Condition Declaration  
> **Bounded Context:** `Patient Profile`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-07`
- **Story Title:** Customer Declares the Care Recipient's Condition at Booking; On-Site Mismatches Reported by the Nurse
- **Bounded Context:** `Patient Profile`
- **Primary Persona:** Customer; Nurse (on-site verification)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-AUTH-03 · FR-BOOK-01 · FR-BOOK-02 · FR-SHIFT-02 · SRS §7 `shift_logs.condition_mismatch_reported`

---

## 💡 Real-World Context & Problem Statement

1. **No automated triage exists in the new model:** SRS v2.0 contains **no AI-based or rule-based symptom classification/screening engine** — the four-group symptom classification of the superseded hospital baseline is removed. What the system relies on instead is an honest condition declaration by the customer (mobility, medical history, infectious status on the care-recipient profile) plus the service catalogue's hard tier/invasive gating.
2. **Declarations can be wrong or understated:** A customer may under-declare — e.g. not disclosing that the recipient is bedridden or infectious. The safety net is human and on-site: within the first 30 minutes after check-in, the nurse verifies the recipient's actual condition against the declaration and reports any mismatch through the shift log.

---

## 📖 User Story Statement

> As a **Customer**,  
> I want to declare my care recipient's condition (mobility, medical history, infectious status) when booking, and as a **Nurse** I want to report any mismatch I find on site,  
> So that the right tier of nurse and the right price are applied, and a mis-declared condition is corrected — or the shift refused without penalty — before care proceeds.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Condition Declaration Captured at Booking
- **Given** a customer creating a booking,
- **When** they select the care-recipient profile and service,
- **Then** the booking carries the profile's declared condition (mobility status, medical history, infectious-disease flag, weight), which is shown to the assigned nurse for the shift.

### AC-02: No Automated Classification Step
- **Given** any booking flow in SRS v2.0 scope,
- **When** the customer submits the condition declaration,
- **Then** the system performs no AI/rule-based symptom classification and assigns no triage tier; eligibility is governed only by the service catalogue (prohibited services blocked; invasive services require TIER_2_SPECIALIST plus a doctor's order — FR-BOOK-01, FR-BOOK-02).

### AC-03: On-Site Mismatch Report by the Nurse
- **Given** a nurse who has checked in and, within the first 30 minutes, finds the recipient's actual condition materially different from the declaration (e.g. bedridden or infectious status concealed),
- **When** the nurse files the mismatch report in the shift log (`condition_mismatch_reported`),
- **Then** the nurse may request a surcharge update for the corrected condition or refuse the shift **without penalty** (FR-SHIFT-02).

### AC-04: Declaration Drives the Heavy-Patient Surcharge
- **Given** a declaration with weight ≥ 80 kg or mobility BEDRIDDEN,
- **When** the booking is priced,
- **Then** the +15% heavy-patient surcharge is included from the start (FR-BOOK-01), so an accurate declaration avoids any on-site price correction.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP07-01` | Booking flow audit for classification behaviour | Functional / Compliance | No classification/triage step exists; booking proceeds on declaration + service-catalogue gating only |
| `TC-USHP07-02` | Nurse reports a concealed bedridden/infectious condition within 30 minutes of check-in | Functional | Mismatch recorded in `shift_logs`; surcharge-update request or penalty-free refusal available to the nurse |
| `TC-USHP07-03` | Accurate heavy-patient declaration at booking | Functional | +15% surcharge applied at pricing; no on-site price correction needed |
