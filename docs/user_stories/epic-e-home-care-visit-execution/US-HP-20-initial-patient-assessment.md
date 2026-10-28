# User Story US-HP-20: Nurse Records Initial Vital Signs & Confirms Patient Condition at Shift Start

> **Epic:** EPIC E — Shift Execution  
> **Bounded Context:** `Shift Execution`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-20`
- **Story Title:** Nurse Records Initial Vital Signs & Confirms Patient Condition at Shift Start
- **Bounded Context:** `Shift Execution`
- **Primary Persona:** Nurse
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-SHIFT-02 · RISK-04 · SRS §4.2 (non-invasive vital-sign monitoring) · SRS §7 (`shift_logs.vital_signs_log`)

---

## 💡 Real-World Context & Problem Statement

1. **A baseline measurement anchors the whole shift:** Vital signs recorded at shift start (pulse, temperature, blood pressure, SpO2) are the reference against which end-of-shift readings in the check-out care report (US-HP-22) and any emergency escalation (US-HP-26) are judged.
2. **The declared condition is not always the real condition:** A customer may under-report the patient's state (e.g. bedridden or infectious). The first 30 minutes after check-in are the nurse's protected window to verify the actual condition, record the start-of-shift handover, and flag any mismatch before accepting the shift as booked (FR-SHIFT-02, RISK-04).

---

## 📖 User Story Statement

> As a **Nurse who has just checked in**,  
> I want to record the patient's initial vital signs and confirm the patient's actual condition within the first 30 minutes of the shift,  
> So that the shift log has a verified clinical baseline and any misreported condition is flagged before care proceeds.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Initial Vital Signs Recorded in the Shift Log
- **Given** a booking in `execution_status = IN_PROGRESS` after check-in,
- **When** the nurse measures the patient at shift start,
- **Then** the nurse records pulse, temperature, blood pressure, and SpO2 into the booking's `shift_logs.vital_signs_log`, synchronised in realtime via WebSocket (FR-SHIFT-02).

### AC-02: Condition Confirmation Within the First 30 Minutes
- **Given** the first 30 minutes after `checkin_time`,
- **When** the nurse verifies the patient against the declared profile (mobility status, infectious-disease flag, care needs),
- **Then** the nurse confirms the condition in the app and the start-of-shift handover record is stored with the shift log (RISK-04).

### AC-03: Condition Mismatch Report
- **Given** the actual condition differs from what the customer declared (e.g. the patient is bedridden or infectious although declared otherwise),
- **When** the nurse reports the mismatch in the app,
- **Then** `shift_logs.condition_mismatch_reported = true` is recorded with the nurse's note, and the nurse may request a surcharge correction (e.g. the heavy/bedridden-patient surcharge, `SURCHARGE_HEAVY_PATIENT = 15%`) or refuse the shift without penalty (see US-HP-24).

### AC-04: Baseline Available for the Rest of the Shift
- **Given** initial vital signs recorded at shift start,
- **When** the nurse, customer, or Admin views the shift log during the shift,
- **Then** the start readings are visible as the baseline for ongoing entries, the end-of-shift readings in the care report, and the latest-vitals snapshot attached to any SOS alert (FR-SHIFT-05).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP20-01` | Record initial vital signs after check-in | Functional | Pulse, temperature, BP, SpO2 saved to `shift_logs.vital_signs_log` with timestamps |
| `TC-USHP20-02` | Confirm patient condition within 30 minutes | Functional | Condition confirmation + start-of-shift handover stored on the shift log |
| `TC-USHP20-03` | Report a condition mismatch | Functional | `condition_mismatch_reported = true`; surcharge-correction / no-penalty refusal options offered |
| `TC-USHP20-04` | Realtime sync of shift-log entries | Functional | Entries appear via WebSocket without manual refresh |
