# User Story US-HP-10: Automatic Nurse Matching

> **Epic:** EPIC C — Booking & Nurse Matching  
> **Bounded Context:** `Booking & Matching`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-10`
- **Story Title:** Automatic Nurse Matching
- **Bounded Context:** `Booking & Matching`
- **Primary Persona:** Patient, Nurse
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** Activity Flow 05 · BR-05, BR-21

---

## 💡 Real-World Context & Problem Statement

1. **Manual telephone dispatch is slow, opaque, and error-prone:** An automated matching engine that aligns skill sets, shift availability, and travel feasibility is essential for timely patient care.
2. **Matching unqualified staff compromises clinical safety:** Nurses must possess verified active credentials (BR-21, UC139) and have zero schedule collisions.

---

## 📖 User Story Statement

> As a **Patient**,  
> I want the system to automatically match a qualified, available nurse for my booked appointment,  
> So that my appointment is scheduled reliably without telephone dispatch delays.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Matching Rules Enforcing Qualifications & Schedule Feasibility
- **Given** a valid booking request,
- **When** the matching engine runs,
- **Then** only nurses with matching service qualifications, verified 2-step activation, and no overlapping shifts are evaluated.

### AC-02: Nurse Acceptance Window & Shift Lock
- **Given** a candidate nurse selected by the matching algorithm,
- **When** notified of the shift opportunity,
- **Then** the nurse has a configured time window to accept; upon acceptance, the shift is locked to prevent double-booking.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP10-01` | Automated filter by skill and availability | Functional | Only qualified, available nurses are returned as candidates |
| `TC-USHP10-02` | Nurse shift acceptance timeout | Functional | Shift is released to alternative nurse if not accepted in time |
