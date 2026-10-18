# User Story US-HP-02: Relative Consent via Email Link

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-02`
- **Story Title:** Relative Consent via Email Link
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Family Member / Legal Representative
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC2, UC4 · BR-17 · Activity Flows 02, 04

---

## 💡 Real-World Context & Problem Statement

1. **Patients often cannot interact with technology directly:** Booking and informed consent are frequently executed by family members. If a hospital coordinator clicks "agree" on their behalf, the consent carries zero legal validity in dispute arbitration.
2. **Consent must be tied to specific terms and timestamps:** Blanket consent is legally insufficient—the system must record precisely who consented, for which specific order/profile, to what version of terms, and at what exact time.

---

## 📖 User Story Statement

> As a **Family Member or Legal Representative**,  
> I want to receive a secure link via email to review the booking summary and personally confirm legal consent for the patient's care profile,  
> So that third-party proxy bookings are formally substantiated without any hospital staff consenting on my behalf.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Scoped & Expiring Consent Link
- **Given** an order or care profile requiring representative consent,
- **When** the system dispatches a consent link via email,
- **Then** the link opens exclusively the specific consent context for that patient and expires according to configured timeouts.

### AC-02: Direct User Action & Immutable Audit Logging
- **Given** a representative opening a valid consent link,
- **When** they confirm legal consent,
- **Then** the system logs the authenticated email, timestamp, and terms version; hospital coordinators have no technical capability to click consent on their behalf.

### AC-03: Representation Status Self-Declaration
- **Given** a patient who is a minor or incapacitated,
- **When** the account owner/representative confirms consent,
- **Then** they must explicitly attest to their legal representation status per BR-17; the platform does not independently verify age or biological relationship.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP02-01` | Open consent link & submit confirmation | Functional | Consent recorded with email, timestamp, and content version |
| `TC-USHP02-02` | Expired or reused consent link | Security | Expired or already-used link is rejected; no consent recorded |
| `TC-USHP02-03` | Proxy consent attempt by coordinator | Security / AuthZ | No proxy consent operation exists in Coordinator role permissions |
