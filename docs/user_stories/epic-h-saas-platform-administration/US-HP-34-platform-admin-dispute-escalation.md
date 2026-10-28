# User Story US-HP-34: Admin Adjudicates Escalated Disputes & Audits Decisions

> **Epic:** EPIC H — Platform Administration: Escalation & Audit  
> **Bounded Context:** `Platform Administration`, `Payment`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-34`
- **Story Title:** Admin Adjudicates Escalated Disputes & Audits Decisions
- **Bounded Context:** `Platform Administration`, `Payment`
- **Primary Persona:** Admin (platform-level adjudication)
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-DISP-01 · FR-DISP-02 (Phase 2) · FR-ADMIN-01 · SRS §7 (`disputes`, `audit_logs`) · SRS §8 `PATCH /api/v1/admin/disputes/:id/resolve`

---

## 💡 Real-World Context & Problem Statement

1. **Some disputes cannot end at first-level handling:** A ruling may be contested by the losing party, a case may involve forged prescriptions, suspected fraud, or large amounts, or the first handling may itself be questioned. The platform needs a final adjudication level whose decision closes the case.
2. **Power at this level demands an audit trail:** Every escalated ruling — and every sensitive act around it, such as re-granting access to a medical record or changing a configuration — must be written to `audit_logs` with the actor, the action, and the before/after values, so decisions can be reviewed after the fact (SRS §7, table `audit_logs`).

---

## 📖 User Story Statement

> As a **Platform Admin handling an escalated case**,  
> I want to adjudicate escalated disputes with access to the complete booking dossier and to have every decision and sensitive action recorded in the audit log,  
> So that the hardest cases receive a final, transparent, and reviewable ruling.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Complete Escalation Dossier
- **Given** a dispute escalated beyond first-level handling (US-HP-28),
- **When** the Admin opens the case,
- **Then** the dossier contains the booking and its price breakdown, the dispute history with all submitted evidence (up to 5 photo/video files per submission), GPS and check-in/out logs, the shift log and care report, the prescription record where relevant, the in-app chat/call history (FR-CHAT-01), and the prior handling notes and ruling.

### AC-02: Final Ruling With the FR-DISP-01 Outcomes
- **Given** a complete dossier,
- **When** the Admin issues the escalated ruling via `PATCH /api/v1/admin/disputes/:id/resolve`,
- **Then** the ruling applies the standard outcomes — `RESOLVED_CUSTOMER` (100% refund for transfer bookings / deposit-wallet compensation for cash bookings, plus nurse sanctions per US-HP-29) or `RESOLVED_NURSE` (full release, booking `SETTLED`) — and split outcomes (`RESOLVED_PARTIAL` / `PARTIALLY_SETTLED`) remain Phase 2 only (FR-DISP-02). The ruling, its rationale, and the deciding Admin (`resolved_by`, `resolution_note`, `resolved_at` on the `disputes` record) are stored with the case.

### AC-03: Every Decision & Sensitive Action Is Audit-Logged
- **Given** any adjudication or sensitive administrative action,
- **When** it is performed,
- **Then** an `audit_logs` entry is written with the actor, `action_type` (e.g. `RESOLVE_DISPUTE`, `VIEW_MEDICAL_RECORD`, `APPROVE_GPHN`, `UPDATE_CONFIG`, `DELETE_PATIENT_DATA`), target table/record, old and new values, IP address, and timestamp; audit entries are append-only evidence for later review of Admin decisions.

### AC-04: Audit Review of Past Decisions
- **Given** a closed dispute or a questioned administrative action,
- **When** an Admin reviews the audit trail,
- **Then** the full sequence of views, grants, configuration changes, and rulings for the case can be reconstructed from `audit_logs` and the `disputes` record.

### Open Items
- SRS v2.0 defines a single `ADMIN` role (`users.role = PATIENT | NURSE | ADMIN`) and does not specify a separate Super Admin tier, the formal escalation triggers/deadlines between handling levels, or a ruling SLA for escalated cases — these are **[Not specified in SRS v2.0 — open item]** and are not carried over from the superseded hospital-baseline version.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP34-01` | Open an escalated dispute dossier | Functional | Booking, evidence, logs, chat/call history, and prior ruling all available |
| `TC-USHP34-02` | Issue a final ruling on an escalated dispute | Functional / Financial | Outcome applied per FR-DISP-01; `resolved_by`, `resolution_note`, `resolved_at` stored |
| `TC-USHP34-03` | Audit logging of the ruling | Compliance | `audit_logs` entry with `RESOLVE_DISPUTE`, actor, old/new values, IP, timestamp |
| `TC-USHP34-04` | Reconstruct a case from the audit trail | Compliance | Full action sequence for the booking/dispute retrievable in order |
