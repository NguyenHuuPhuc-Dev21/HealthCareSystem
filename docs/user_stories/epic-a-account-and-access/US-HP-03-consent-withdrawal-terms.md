# User Story US-HP-03: Consent Withdrawal & New-Terms Consent

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-03`
- **Story Title:** Consent Withdrawal & New-Terms Consent
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Account Owner (Patient / Legal Representative)
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC106, UC138 · Q-47 · Activity Flows 02, 03

---

## 💡 Real-World Context & Problem Statement

1. **Irrevocable consent poses severe legal liability:** If users cannot withdraw consent, hospitals and platforms face legal risk for continuing to process personal health information after patient revocation.
2. **Terms of service evolve over time:** Imposing updated terms on users who have not consented to the new version creates contentious legal grounds in case of dispute.

---

## 📖 User Story Statement

> As an **Account Owner**,  
> I want to withdraw previously granted consent (with clear warning of downstream consequences) and be invited to re-consent via a dedicated workflow whenever platform terms change,  
> So that my rights regarding my personal health data remain genuinely actionable.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Consent Withdrawal Logging & Consequence Enforcement
- **Given** an active, effective consent record,
- **When** the account owner withdraws it via Flow 02,
- **Then** the system records the withdrawal timestamp, displays operational consequences prior to final confirmation, and blocks dependent operations per regulations.

### AC-02: Mandatory Re-Consent for Updated Terms
- **Given** an updated platform terms-of-service version released,
- **When** the user next signs in,
- **Then** the system prompts for consent via Flow 03 (UC138); until accepted, the new terms do not govern the account.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP03-01` | Withdraw consent action | Functional | Consent status transitions to Withdrawn with timestamp & audit log |
| `TC-USHP03-02` | Block processes dependent on withdrawn consent | Functional / Security | Dependent workflows blocked immediately upon revocation |
| `TC-USHP03-03` | Consent workflow for updated terms | Functional | Accounts that haven't agreed remain governed by prior version |
