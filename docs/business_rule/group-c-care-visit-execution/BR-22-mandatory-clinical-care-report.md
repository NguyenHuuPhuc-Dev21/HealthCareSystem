# BR-22: Mandatory Clinical Care Report

> **Group:** Group C — Care Visit Execution  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** FR-SHIFT-02, FR-SHIFT-04, FR-PRIV-01, FR-PAY-02, FR-RATE-01, SRS §2.2, §7 (`shift_logs`)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **The Care Report Is the Completion Gate:** In SRS v2.0 a shift is not "done" when the nurse leaves — it is done when the nurse checks out **and** submits the care report. The report is what starts settlement, opens the dispute window, closes medical-record access, and unlocks two-sided ratings.
2. **One Minimal, Uniform Report:** SRS v2.0 defines a single minimal mandatory content set for every shift, recorded in `shift_logs`, instead of hospital service-specific clinical templates. Vital signs are captured at the start of the shift (initial condition confirmation) and again at the end (check-out report), giving every booking a before/after clinical record.

---

## 2. Rule Specifications

### 2.1 Realtime Care Log During the Shift (FR-SHIFT-02)

- Within the **first 30 minutes after check-in**, the nurse confirms the patient's condition and begins the log with the **start-of-shift vital signs**.
- Throughout the shift, the nurse records **vital signs** (pulse, temperature, blood pressure, SpO2) and **care activities** into the booking's `shift_logs` record (`vital_signs_log`, `care_activities_log` — JSONB), synchronized in realtime via WebSocket.
- Emergency events during the shift are recorded in the same record (`emergency_incident_log`; see BR-23).

### 2.2 Check-Out & the Mandatory Minimal Report (FR-SHIFT-04)

Check-out (`POST /api/v1/bookings/:id/check-out`) requires the nurse to submit:

1. **Actual end time** of the shift (recorded as `checkout_time`).
2. **Final (end-of-shift) vital signs.**
3. **List of tasks/services actually performed.**
4. **Handover notes** for the family/next caregiver.

The system then sets `execution_status = COMPLETED`. Per SRS §2.2, `COMPLETED` is defined as "checked out **and** the full care log submitted" — **there is no path to `COMPLETED` without the report**, and no administrative override exists in SRS v2.0.

### 2.3 Clocks and Gates Started by Check-Out

Submitting the check-out report starts four downstream mechanisms simultaneously:

| Mechanism | Rule | Effect of `checkout_time` |
| :--- | :--- | :--- |
| Settlement cooling period | FR-PAY-02 (`SETTLEMENT_COOLING_HOURS = 24`) | Transfer bookings auto-settle 24h after check-out if no dispute (BR-04) |
| Dispute window | FR-DISP-01 | Either side may dispute until 24h after check-out (BR-11) |
| Medical-record access closure | FR-PRIV-01 | The nurse's access to the patient's record for this booking closes **12 hours after check-out** (Admin may re-grant time-limited access, audit-logged, for dispute handling) |
| Two-sided ratings | FR-RATE-01 | Ratings open at `COMPLETED` — they do **not** wait for settlement (BR-19) |

### 2.4 Evidence & Retention Role

- The care report and the full `shift_logs` record are primary evidence in dispute adjudication (FR-DISP-01: Admin reviews GPS log, check-in/out times, the care log, and in-app chat history).
- Access to medical records is audit-logged (`audit_logs`, action `VIEW_MEDICAL_RECORD`). Medical records are retained for a maximum of **24 months** and are subject to the data-subject deletion/anonymization rights of Decree 13/2023/NĐ-CP (FR-PRIV-01).

### 2.5 Superseded Hospital-Baseline Mechanics

The hospital baseline's report-escalation timeouts (reminder at >2h overdue, suspension at >24h overdue) and its per-service clinical form templates signed off by a hospital clinical board (old Q-49) are **not part of SRS v2.0** and are not carried over. In SRS v2.0 the enforcement is structural — no report, no completion, no settlement. A separate overdue-report penalty/escalation SLA beyond this structural gate is **[Not specified in SRS v2.0 — open item]**.

---

## 3. Traceability & Dependencies

- **SRS References:** FR-SHIFT-02, FR-SHIFT-04, FR-PRIV-01, FR-PAY-02, FR-RATE-01, FR-DISP-01; SRS §2.2, §7 (`shift_logs`, `audit_logs`)
- **APIs:** `POST /api/v1/bookings/:id/check-out`
- **Related Rules:** BR-07 (check-in evidence), BR-16 (early termination), BR-04 (settlement), BR-11 (dispute evidence)
