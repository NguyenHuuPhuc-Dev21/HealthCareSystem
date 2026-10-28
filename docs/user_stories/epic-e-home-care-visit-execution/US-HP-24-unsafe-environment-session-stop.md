# User Story US-HP-24: Nurse Stops a Shift for an Unsafe Environment or Condition Mismatch & Reports It

> **Epic:** EPIC E — Shift Execution  
> **Bounded Context:** `Shift Execution`, `Safety`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-24`
- **Story Title:** Nurse Stops a Shift for an Unsafe Environment or Condition Mismatch & Reports It
- **Bounded Context:** `Shift Execution`, `Safety`
- **Primary Persona:** Nurse
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-SHIFT-02 · FR-BOOK-02 · RISK-04 · SRS §5.2 rows 4–5 · SRS §7 (`shift_logs.condition_mismatch_reported`)

---

## 💡 Real-World Context & Problem Statement

1. **The nurse works alone in a private home:** Hostility, abuse, dangerous conditions, or a patient whose real state (bedridden, infectious) contradicts the booking declaration can make continuing the shift unsafe or clinically improper.
2. **Stopping must be protected, not punished:** SRS v2.0 gives the nurse explicit no-penalty exits — refuse a shift in the first 30 minutes when the declared condition was misreported (FR-SHIFT-02), reject a shift at check-in when the prescription is invalid (FR-BOOK-02) — and guarantees pay for work actually done when a shift ends early through no fault of the nurse (SRS §5.2 row 4).

---

## 📖 User Story Statement

> As a **Nurse**,  
> I want to stop a shift when the environment is unsafe or the patient's actual condition does not match the booking, and to report the reason with evidence in the app,  
> So that my safety is protected, I am not penalised for a stop that is not my fault, and I am paid for the work I actually performed.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Condition Mismatch Reported in the First 30 Minutes
- **Given** a checked-in shift where the patient's actual condition contradicts the customer's declaration (e.g. bedridden or infectious status misreported),
- **When** the nurse files the mismatch report (FR-SHIFT-02),
- **Then** `shift_logs.condition_mismatch_reported = true` is recorded, and the nurse may either request a surcharge correction (e.g. `SURCHARGE_HEAVY_PATIENT`) and continue, or refuse/stop the shift **without penalty** — no deposit deduction and no TrustScore deduction.

### AC-02: Invalid Prescription Rejection at Check-In
- **Given** an invasive-service booking where the original prescription is forged, expired, altered, or the medication on site does not match it,
- **When** the Tier 2 nurse submits "Reject shift — invalid prescription" with photo evidence via `POST /api/v1/bookings/:id/reject-invalid-prescription`,
- **Then** the booking is cancelled immediately, the nurse receives **no penalty** and is compensated for travel costs (FR-BOOK-02; SRS §10 TC-BOOK-02).

### AC-03: Unsafe-Environment Stop With Incident Report
- **Given** an in-progress shift that becomes unsafe for the nurse,
- **When** the nurse stops the shift in the app,
- **Then** the nurse records the reason and supporting evidence in the shift/incident log, the stop is timestamped, and the case is available to Admin as part of the booking record (with SOS available at any time if the situation is an emergency — US-HP-26).

### AC-04: Pay Treatment for an Early-Ended Shift (SRS §5.2 Row 4)
- **Given** a shift that ends early after check-in through no fault of the nurse (including a customer-requested early stop),
- **When** settlement is calculated,
- **Then** the nurse is paid 100% of the fee for the hours actually worked (minimum 1 hour); a task-based service whose tasks were fully completed is paid in full even if finished early; for transfer bookings the unused portion is refunded 100% to the customer; the early end is **not** treated as a cancellation and does **not** create a `PARTIALLY_SETTLED` state in the MVP.

### AC-05: Medical Force-Majeure Endings (SRS §5.2 Row 5)
- **Given** a shift that cannot proceed because the patient is transferred to emergency/ICU care or dies (with confirmation documents),
- **When** the booking is closed under this scenario,
- **Then** the customer is refunded 100% of the unused amount with no penalty, and a nurse who had already travelled receives the fixed travel support of 50,000 VNĐ (`ICU_TRAVEL_SUPPORT`).

### Open Items
- The exact settlement treatment for a nurse-initiated unsafe-environment stop occurring **after** the first 30 minutes (beyond the actual-work rule of §5.2 row 4 and the dispute workflow) is **[Not specified in SRS v2.0 — open item]**; contested cases are resolved through FR-DISP-01 (US-HP-28).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP24-01` | Report condition mismatch within 30 minutes | Functional | `condition_mismatch_reported = true`; surcharge-correction or no-penalty refusal offered |
| `TC-USHP24-02` | Reject shift for invalid prescription (SRS TC-BOOK-02) | Functional / Compliance | Booking `CANCELLED`; no deposit deduction; no TrustScore deduction; travel compensation applied |
| `TC-USHP24-03` | Stop shift for unsafe environment with report | Functional / Safety | Stop timestamped with reason and evidence in the shift/incident log |
| `TC-USHP24-04` | Early-ended shift settlement (SRS §5.2 row 4) | Functional | Nurse paid 100% of actual hours (min 1h); unused transfer amount refunded; no `PARTIALLY_SETTLED` created |
| `TC-USHP24-05` | ICU force-majeure closure (SRS §5.2 row 5) | Functional | 100% refund of unused amount; 50,000 VNĐ travel support paid to a nurse who travelled |
