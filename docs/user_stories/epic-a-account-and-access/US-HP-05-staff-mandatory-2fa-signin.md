# User Story US-HP-05: Admin Portal Sign-In with Mandatory 2FA

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-05`
- **Story Title:** Admin Portal Sign-In with Mandatory 2FA
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Medical Admin / Platform Operator
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** SRS §2.1 (Medical Admin / Operator actor) · FR-ADMIN-01 · FR-AUTH-02 (Admin verification powers)

---

## 💡 Real-World Context & Problem Statement

1. **The Admin Portal is the platform's control room:** Admins verify GPHN credentials and assign tiers, adjudicate disputes that move money, edit `system_configs` pricing/SLA parameters and lock or unlock user accounts. A single compromised Admin credential would let an attacker approve fake licences or release escrow funds.
2. **The 2FA mandate is scoped to Admin only:** In SRS v2.0, customers and nurses sign in with phone + OTP (US-HP-01, US-HP-04) and are **not** subject to a mandatory second factor — the retired nurses and elderly customers who use the platform must not be burdened with staff-grade sign-in friction. The mandatory 2FA of this story therefore applies to the Admin Portal, not to nurses as in the superseded hospital baseline.

---

## 📖 User Story Statement

> As a **Medical Admin / Platform Operator**,  
> I want to sign in to the Admin Portal with my credentials plus a mandatory second factor,  
> So that the functions which verify licences, move money and change platform configuration cannot be reached with a stolen password alone.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Second Factor Required Before Any Admin Session
- **Given** a valid Admin account,
- **When** the Admin signs in to the Admin Portal with correct primary credentials,
- **Then** the system requires successful second-factor verification before issuing an authenticated Admin session; no Admin function (credential verification, dispute resolution, config changes, account locking) is reachable before that step completes.

### AC-02: Nurses and Customers Are Not Subject to Mandatory 2FA
- **Given** a nurse or customer account,
- **When** they sign in on the Nurse Web/Mobile App or Patient Web/App,
- **Then** sign-in completes with phone number + OTP only; no mandatory second factor is enforced for these roles.

### AC-03: Failed Second Factor Blocks Access and Is Logged
- **Given** an Admin sign-in attempt,
- **When** the second factor fails or is not completed,
- **Then** no session is issued and the failed attempt is recorded for security review.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP05-01` | Admin sign-in without completing the second factor | Security | Blocked at the 2FA step; no Admin session token granted |
| `TC-USHP05-02` | Nurse and customer sign-in | Functional | Sign-in succeeds with phone + OTP only; no 2FA prompt enforced |
| `TC-USHP05-03` | Repeated failed 2FA attempts | Security | Attempts logged; account not accessible via the failed attempts |

> **Open items:** the second-factor channel (authenticator app, SMS OTP or other) and the Admin account-recovery procedure are [Not specified in SRS v2.0 — open item].
