# BR-17: Data Processing Consent Lifecycle

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-15 (Omit auto-transfer at 18 in MVP), Q-47 (Terms re-consent thresholds)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Individual Informed Consent per Profile:** A user account may manage multiple family care profiles. Each individual profile must possess a separate, legally binding consent record.
2. **Revocable Consent Rights:** Patients and legal representatives must be able to withdraw consent at any time without punitive systemic hurdles, with transparent explanations of operational consequences.

---

## 2. Rule Specifications

### 2.1 Consent Acquisition Mechanisms
- **Autonomous Adults:** If the patient is a competent adult relative, they must **personally consent via a secure link sent directly to their verified email**. Hospital dispatchers cannot consent on their behalf.
- **Minors & Dependent Individuals:** If the patient is a child or incapacitated, the account owner enters relationship details and birth date, attests legal representation, and consents on their behalf. The platform does not verify age or civil relationships (BR-20).

### 2.2 Consent Revocation Workflow (UC106)
- An account owner can revoke consent at any time, requiring verification via email OTP (or via email link for adult relatives).
- **Immediate Impacts:**
  - Blocks all new booking requests for that profile.
  - Terminates non-essential personal data processing.
- **Handling of Active Bookings (UC129):**
  - *Nurse has not yet departed:* Booking is cancelled immediately; **100% of deposit is refunded** (Flow 09).
  - *Nurse departed or visit in session:* The visit must either be completed or terminated under mid-session stop rules (Flow 15).
  - *Financial Settlement:* Data required to finalize accounting and billing for ongoing visits continues to be processed until final settlement.
  - *Historical Data:* Archived data is queued for the statutory data erasure workflow (Flow 14).

### 2.3 Updated Terms of Service & Re-Consent (Q-47)
- **Material Changes:** Substantial amendments to data processing terms prompt mandatory re-consent upon the user's next sign-in or booking flow (UC138, Flow 03).
  - If re-consent is withheld: The user is restricted to view-only mode; existing bookings execute under the previously agreed terms version.
- **Non-Material Changes:** Minor grammatical or technical updates are delivered as informational notifications, considered accepted through continued usage.

### 2.4 Removal of Automatic Profile Transfer at Age 18 (Q-15)
- The platform **does not automatically transfer** profile ownership when a dependent reaches age 18 (UC130 and UC132 removed from baseline).
- The individual must register their own independent account. The original account owner may unlink or request erasure of the dependent profile (Flow 14).

---

## 3. Traceability & Dependencies

- **Use Cases:** UC2, UC4, UC106, UC129, UC138
- **Activity Flows:** Flow 02 (Profile Creation), Flow 03 (Authentication), Flow 14 (Consent Revocation & Erasure)
- **Governing Decisions:** Q-15 (No auto-transfer at 18), Q-47 (Material terms threshold)
