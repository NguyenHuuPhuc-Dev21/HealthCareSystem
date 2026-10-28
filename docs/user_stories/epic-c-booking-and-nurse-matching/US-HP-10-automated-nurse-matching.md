# User Story US-HP-10: Matching via Radar Push Waves + Job Board

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-10`
- **Story Title:** System Matches via Radar Push Waves + Job Board; Nurse Claims/Accepts
- **Bounded Context:** `Booking & Matching`
- **Primary Persona:** Customer; Nurse (Tier 1 / Tier 2)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-BOOK-03 · FR-SCHED-01 · FR-SEARCH-01 · FR-PAY-03 (deposit gate) · SRS §7 `bookings.matching_mode` (`RADAR_DISPATCH` | `JOB_BOARD`)

---

## 💡 Real-World Context & Problem Statement

1. **Urgent and planned bookings need different mechanics:** A procedure needed within hours cannot wait for nurses to browse a board, while a shift booked days ahead should not blast push notifications. SRS v2.0 therefore separates two matching mechanisms instead of mixing them: Radar dispatch for urgent work, Job Board broadcast for advance work — plus direct selection, where the customer picks a nurse from search results and invites them first.
2. **Claiming must be safe against double-booking and unqualified claims:** Only ACTIVE nurses with the required tier, real availability (including a 60-minute travel buffer between shifts and registered time-off) and a fully funded deposit wallet may claim; the first valid claim wins atomically.

---

## 📖 User Story Statement

> As a **Customer**, I want the system to find a qualified nurse for my booking automatically — by radar push for urgent jobs or via the Job Board for advance jobs — and as a **Nurse**, I want to claim or accept jobs I am eligible for,  
> So that bookings are confirmed quickly without manual dispatch, and never to a nurse who is unqualified, unavailable or under-deposited.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Radar Dispatch Waves for Urgent Bookings (≤ 6 Hours Ahead)
- **Given** a task-based or urgent booking (starting within ≤ 6 hours) in MATCHING,
- **When** radar dispatch runs,
- **Then** wave 1 (minutes 0–5) pushes the job to eligible nurses within a 5 km radius, and if nobody accepts, wave 2 (minutes 5–15) automatically expands the radius to 10 km; the first nurse to accept wins the job via Redis Lock / `SELECT FOR UPDATE`, moving the booking to CONFIRMED and locking the nurse's schedule.

### AC-02: Job Board Broadcast for Advance Bookings (> 6 Hours Ahead)
- **Given** a booking starting more than 6 hours ahead,
- **When** matching runs,
- **Then** the job is posted on the Job Board tab of eligible nurses for claiming; if the customer selected a specific nurse via profile search (FR-SEARCH-01), the job is offered to that nurse directly first, with a 15-minute response window before it is broadcast to the board.

### AC-03: Eligibility Gate for Every Claim
- **Given** any nurse attempting to claim or accept a job through either mechanism,
- **When** eligibility is evaluated,
- **Then** the nurse must be ACTIVE (`profile_status` is the single source of truth), hold the tier required by the service (invasive ⇒ TIER_2_SPECIALIST), be free in `nurse_availabilities` with no conflicting CONFIRMED/IN_PROGRESS booking inside the 60-minute travel buffer and no registered time-off, and have `deposit_balance ≥ 300,000 VND` (FR-PAY-03) — otherwise the claim is rejected (HTTP 403 for tier/deposit failures).

### AC-04: Matching Timeout
- **Given** a booking still in MATCHING,
- **When** 30 minutes before the shift start (or 30 minutes after posting, for urgent jobs) no nurse has accepted,
- **Then** the booking moves to `execution_status = EXPIRED` and any prepaid amount is refunded 100% (`payment_status = REFUNDED`) per §5.2 row 9.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-MATCH-01` (SRS §10) | Nurse with a time-off block or a conflicting confirmed shift (< 60 min buffer) | Functional | Nurse never appears in the matching candidate set |
| `TC-MATCH-02` (SRS §10) | Radar job unclaimed after 5 minutes within 5 km | Functional | Notification radius automatically expands to 10 km |
| `TC-WALLET-01` (SRS §10) | Nurse with `deposit_balance < 300,000 VND` attempts to claim | Security / AuthZ | Claim blocked (HTTP 403) with a prompt to top up the deposit first |
| `TC-USHP10-01` | Two nurses claim the same Job Board job simultaneously | Functional / Concurrency | Exactly one claim succeeds; the booking is CONFIRMED to that nurse only |
| `TC-USHP10-02` | Direct-selection nurse does not respond within 15 minutes | Functional | Job is broadcast to the Job Board for all eligible nurses |
