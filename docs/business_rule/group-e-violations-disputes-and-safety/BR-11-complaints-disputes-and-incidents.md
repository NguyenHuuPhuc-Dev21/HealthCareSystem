# BR-11: Complaints, Dispute Resolution & Incident Escalation

> **Group:** Group E — Violations, Disputes & Safety  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** FR-DISP-01, FR-DISP-02, FR-CHAT-01, FR-PRIV-01, FR-RATE-01, SRS §2.2 (dispute axis), §7 (`disputes`, `conversations_messages`)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **One Dispute Channel, Tied to the Money:** In SRS v2.0 a complaint about a shift is a **booking dispute** (FR-DISP-01): it opens against a specific booking, immediately freezes that booking's escrow, and ends in a deterministic Admin ruling. There is no separate hospital complaint bureaucracy, no 30-day filing window, and no multi-level appeals ladder.
2. **Evidence Is Built Into the Product:** Because all communication is in-app with masked numbers (FR-CHAT-01) and every shift produces GPS/selfie evidence and a care log (BR-07, BR-22), adjudication works from system records rather than competing recollections.

---

## 2. Rule Specifications

### 2.1 Opening a Dispute (FR-DISP-01)

- **Who:** Either side — customer or nurse.
- **Window:** From the moment the booking is `IN_PROGRESS` until **24 hours after check-out**. (This is the same 24 hours as the settlement cooling period: opening a dispute is precisely what stops automatic settlement.)
- **Input:** A reason (e.g., nurse left early, care-process violation, poor attitude, customer misreported the patient's condition), a detailed description, and **up to 5 photo/video evidence files**.
- **Immediate effect:** `dispute_status = OPEN`; the booking's escrow funds are **frozen at once** and the automatic settlement worker (cronjob) is blocked for that booking.

### 2.2 Admin Review (FR-DISP-01)

- Admin takes the dispute into `UNDER_REVIEW` and examines the system evidence: **GPS log, check-in/check-out times, the medical care log (`shift_logs`), and the in-app chat/call history** (`conversations_messages`, retained as evidence per FR-CHAT-01).
- Access note: the nurse's own access to the patient record closes 12 hours after check-out (FR-PRIV-01); during dispute handling Admin may re-grant time-limited access, recorded in `audit_logs`.

### 2.3 Adjudication Outcomes (FR-DISP-01; BR-18 §2.2)

| Outcome (`dispute_status`) | Financial effect |
| :--- | :--- |
| `RESOLVED_CUSTOMER` — customer upheld | Transfer booking: **100% refund** (`payment_status = REFUNDED`); nurse receives a TrustScore deduction (−25 for an upheld violation) and a deposit fine. **Cash booking** (no escrow exists): the penalty/compensation owed to the customer is deducted from the nurse's **deposit wallet** |
| `RESOLVED_NURSE` — nurse upheld | Booking settles **100%** to the nurse (`payment_status = SETTLED`, normal 85/15 for transfer bookings) |
| `RESOLVED_PARTIAL` — **Phase 2 only** (FR-DISP-02) | Admin sets a split ratio → `payment_status = PARTIALLY_SETTLED`. **Not available in the MVP** |

### 2.4 Incidents Are Not Disputes

Medical emergencies and safety incidents during a shift are handled **immediately** under the SOS protocol (BR-23 / FR-SHIFT-05) and recorded in `shift_logs.emergency_incident_log`; they are never queued behind dispute timelines. An incident may afterwards ground a dispute under §2.1 (e.g., over pay for the interrupted shift), which is then adjudicated on the incident log and the other system evidence.

### 2.5 Ratings Are Not Disputes (FR-RATE-01)

Two-sided ratings open at `COMPLETED` regardless of disputes (BR-19 §2.1). A low rating is feedback; only a dispute under §2.1 can freeze or move money, and filing a dispute does not require leaving a rating.

### 2.6 Superseded Hospital-Baseline Mechanics & Open Items

**Abolished:** the 30-day complaint filing limit (old Q-17), hospital adjudication SLAs (3 business days) with platform takeover on timeout, the independent re-adjudication/appeals ladder with rotating arbiters (old Q-32), and immediate-suspension-on-allegation with a 4-hour hospital review.

**Open item:** SRS v2.0 defines **no appeal or re-adjudication process** after an Admin ruling — **[Not specified in SRS v2.0 — open item]**.

---

## 3. Traceability & Dependencies

- **SRS References:** FR-DISP-01, FR-DISP-02, FR-CHAT-01, FR-PRIV-01, FR-RATE-01; SRS §2.2 (dispute axis: NONE / OPEN / UNDER_REVIEW / RESOLVED_CUSTOMER / RESOLVED_NURSE / RESOLVED_PARTIAL), §7 (`disputes`, `conversations_messages`, `audit_logs`)
- **APIs:** `POST /api/v1/bookings/:id/disputes`; `PATCH /api/v1/admin/disputes/:id/resolve`
- **Related Rules:** BR-18 (financial outcomes & penalty mechanics), BR-02 (sanctions), BR-23 (incident protocol), BR-22 (care-log evidence), BR-19 (customer-side grounds)
