# User Story US-HP-28: Admin Handles Booking Disputes (FR-DISP-01 Workflow)

> **Epic:** EPIC G — Administration: Disputes, Violations & Sanctions  
> **Bounded Context:** `Platform Administration`, `Payment`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-28`
- **Story Title:** Admin Handles Booking Disputes (FR-DISP-01 Workflow)
- **Bounded Context:** `Platform Administration`, `Payment`
- **Primary Persona:** Medical Admin / Operator (Admin Portal)
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-DISP-01 · FR-DISP-02 (Phase 2) · FR-CHAT-01 · SRS §2.2 (dispute axis) · SRS §7 (`disputes`) · SRS §8 `POST /api/v1/bookings/:id/disputes`, `PATCH /api/v1/admin/disputes/:id/resolve` · SRS §10 TC-DISP-01 / TC-DISP-02

---

## 💡 Real-World Context & Problem Statement

1. **Marketplace disputes are about a specific shift, not hospital fee lines:** Either side may claim the other failed — the nurse left early, care procedures were wrong, the customer misreported the patient's condition. Because transfer payments are held by the platform until 24 hours after check-out, a timely dispute can freeze the money before it is released.
2. **Adjudication must run on system evidence, not assertions:** GPS and check-in/out logs, the shift log and care report, and the in-app chat/call history (kept as evidence under FR-CHAT-01) give the Admin an objective record for the booking in question.

---

## 📖 User Story Statement

> As a **Platform Admin**,  
> I want to receive, review, and adjudicate booking disputes opened by either the customer or the nurse, using the booking's system evidence,  
> So that held money is released or refunded according to a documented, evidence-based ruling.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Either Party Can Open a Dispute Inside the Window
- **Given** a booking from `IN_PROGRESS` up to 24 hours after check-out,
- **When** the customer or the nurse submits a dispute via `POST /api/v1/bookings/:id/disputes` with a reason (left early, wrong care procedure, poor attitude, customer misreported the condition, …), a description, and up to 5 photo/video evidence files,
- **Then** a `disputes` record is created, `dispute_status` becomes `OPEN`, the held amount is frozen immediately, and the automatic settlement job for that booking is stopped (FR-DISP-01).

### AC-02: Evidence-Based Review (UNDER_REVIEW)
- **Given** an open dispute,
- **When** the Admin takes the case (`dispute_status = UNDER_REVIEW`),
- **Then** the Admin can review the booking's GPS log, check-in/out times, shift log and care report, prescription records, and the full in-app chat/call history (FR-CHAT-01); during the dispute window the nurse's expired medical-record access may be re-granted on a time-limited basis with an `audit_logs` entry (FR-PRIV-01).

### AC-03: Ruling — Customer Prevails (RESOLVED_CUSTOMER)
- **Given** a reviewed dispute where the customer is right,
- **When** the Admin resolves it via `PATCH /api/v1/admin/disputes/:id/resolve`,
- **Then** `dispute_status = RESOLVED_CUSTOMER`, the customer is refunded 100% (`payment_status = REFUNDED`) for transfer bookings, and the nurse is sanctioned per policy (TrustScore deduction and deposit-wallet penalty, see US-HP-29). For cash bookings (no money is held), the penalty/compensation owed to the customer is deducted from the nurse's deposit wallet (`deposit_balance`).

### AC-04: Ruling — Nurse Prevails (RESOLVED_NURSE)
- **Given** a reviewed dispute where the nurse is right,
- **When** the Admin resolves it,
- **Then** `dispute_status = RESOLVED_NURSE` and the nurse's pay is released in full (`payment_status = SETTLED`) under the FR-PAY-02 settlement rules.

### AC-05: Partial Settlement Is Phase 2 Only
- **Given** a dispute where both parties share responsibility,
- **When** the Admin handles it in the MVP,
- **Then** no partial split is applied; split outcomes (`RESOLVED_PARTIAL` / `PARTIALLY_SETTLED`, FR-DISP-02) are available only in Phase 2.

### AC-06: No Settlement While a Dispute Is Open
- **Given** a booking whose `dispute_status = OPEN` at hour 20 after check-out,
- **When** the 24-hour settlement job runs,
- **Then** the job must not release the disputed held amount (SRS §10 TC-DISP-01).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP28-01` | Open a dispute within the window with evidence | Functional | Dispute created (`OPEN`); escrow frozen; settlement job stopped for the booking |
| `TC-USHP28-02` | Settlement job runs while dispute is open (SRS TC-DISP-01) | Functional / Financial | No release of the disputed amount at the 24-hour mark |
| `TC-USHP28-03` | Resolve for the customer (SRS TC-DISP-02) | Functional / Financial | Funds move from held balance to a 100% customer refund (`REFUNDED`); nurse sanctioned per US-HP-29 |
| `TC-USHP28-04` | Resolve for the nurse | Functional / Financial | Nurse paid in full; booking `SETTLED` |
| `TC-USHP28-05` | Dispute opened after the 24-hour window | Functional | Submission rejected as out of window |
| `TC-USHP28-06` | Cash booking resolved for the customer | Functional / Financial | Compensation deducted from the nurse's `deposit_balance`; no escrow movement |
